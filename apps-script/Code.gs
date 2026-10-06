/**
 * Scan List Keeper — Google Sheet backend (Google Apps Script)
 *
 * 1. Create a new Google Sheet (e.g. "Scan List Keeper Data").
 * 2. Extensions → Apps Script → replace Code.gs with this file.
 * 3. Change the two keys below, then Save.
 * 4. Deploy → New deployment → type "Web app"
 *      Execute as: Me      Who has access: Anyone
 * 5. Copy the Web app URL (ends in /exec) into the tablets' Settings
 *    and into Manager View.
 *
 * Re-deploying after edits: Deploy → Manage deployments → Edit → Version: New version.
 */

const WRITE_KEY   = 'change-me-tablets';   // tablets use this to send lists
const MANAGER_KEY = 'change-me-manager';   // Manager View uses this to read/delete

const LISTS_SHEET = 'Lists';
const SCANS_SHEET = 'Scans';
const LIST_HEAD = ['ListID', 'Title', 'User', 'Notes', 'Tablet', 'Started', 'Updated', 'Status', 'Count'];
const SCAN_HEAD = ['ListID', 'Title', 'User', '#', 'Serial', 'Scanned At', 'Tablet'];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.action === 'ping') {
      if (body.key !== WRITE_KEY && body.key !== MANAGER_KEY) return out_({ ok: false, error: 'Wrong key' });
      return out_({ ok: true });
    }
    if (body.action === 'upsert') {
      if (body.key !== WRITE_KEY && body.key !== MANAGER_KEY) return out_({ ok: false, error: 'Wrong write key' });
      return withLock_(() => upsert_(body.list));
    }
    if (body.action === 'delete') {
      if (body.key !== MANAGER_KEY) return out_({ ok: false, error: 'Manager key required' });
      return withLock_(() => remove_(body.id));
    }
    return out_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  const p = e.parameter || {};
  if (p.key !== MANAGER_KEY) return out_({ ok: false, error: 'Wrong manager key' });
  if (p.action === 'lists') return out_({ ok: true, lists: readAll_() });
  return out_({ ok: true });
}

/* ---------------- helpers ---------------- */

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function sheet_(name, head) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function upsert_(l) {
  if (!l || !l.id) return out_({ ok: false, error: 'Missing list' });
  const items = Array.isArray(l.items) ? l.items : [];

  // ---- Lists sheet: one row per list
  const ls = sheet_(LISTS_SHEET, LIST_HEAD);
  const row = [l.id, l.title || '', l.user || '', l.notes || '', l.device || '',
    toDate_(l.created), toDate_(l.updated), l.status || 'open', items.length];
  const found = ls.getRange('A:A').createTextFinder(l.id).matchEntireCell(true).findNext();
  const r = found ? found.getRow() : ls.getLastRow() + 1;
  ls.getRange(r, 2, 1, 4).setNumberFormat('@');
  ls.getRange(r, 6, 1, 2).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  ls.getRange(r, 1, 1, row.length).setValues([row]);

  // ---- Scans sheet: one row per serial
  const sc = sheet_(SCANS_SHEET, SCAN_HEAD);
  const last = sc.getLastRow();
  const data = last > 1 ? sc.getRange(2, 1, last - 1, SCAN_HEAD.length).getValues() : [];
  const mine = [];
  data.forEach((r, i) => { if (r[0] === l.id) mine.push(i); });

  const newRows = items.map((it, i) => [l.id, l.title || '', l.user || '', i + 1, String(it.sn), toDate_(it.t), l.device || '']);

  // Fast path: list only grew (normal scanning) and heading unchanged → append the new serials.
  const prefixSame = mine.length <= items.length && mine.every((di, k) =>
    String(data[di][4]) === String(items[k].sn) &&
    String(data[di][1]) === String(l.title || '') && String(data[di][2]) === String(l.user || '') &&
    String(data[di][6]) === String(l.device || ''));

  if (prefixSame) {
    const add = newRows.slice(mine.length);
    if (add.length) writeRows_(sc, sc.getLastRow() + 1, add);
  } else {
    // Rewrite: drop this list's rows, then append the full current list.
    const keep = data.filter(r => r[0] !== l.id);
    if (last > 1) sc.getRange(2, 1, last - 1, SCAN_HEAD.length).clearContent();
    const all = keep.concat(newRows);
    if (all.length) writeRows_(sc, 2, all);
  }
  return out_({ ok: true, count: items.length });
}

function writeRows_(sh, startRow, rows) {
  [2, 3, 5, 7].forEach(c => sh.getRange(startRow, c, rows.length, 1).setNumberFormat('@')); // text: keeps leading zeros / stops auto-dates
  sh.getRange(startRow, 6, rows.length, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  sh.getRange(startRow, 1, rows.length, SCAN_HEAD.length).setValues(rows);
}

function remove_(id) {
  const ls = sheet_(LISTS_SHEET, LIST_HEAD);
  const f = ls.getRange('A:A').createTextFinder(id).matchEntireCell(true).findNext();
  if (f) ls.deleteRow(f.getRow());
  const sc = sheet_(SCANS_SHEET, SCAN_HEAD);
  const last = sc.getLastRow();
  if (last > 1) {
    const data = sc.getRange(2, 1, last - 1, SCAN_HEAD.length).getValues();
    const keep = data.filter(r => r[0] !== id);
    if (keep.length !== data.length) {
      sc.getRange(2, 1, last - 1, SCAN_HEAD.length).clearContent();
      if (keep.length) writeRows_(sc, 2, keep);
    }
  }
  return out_({ ok: true });
}

function readAll_() {
  const ls = sheet_(LISTS_SHEET, LIST_HEAD);
  const sc = sheet_(SCANS_SHEET, SCAN_HEAD);
  const lRows = ls.getLastRow() > 1 ? ls.getRange(2, 1, ls.getLastRow() - 1, LIST_HEAD.length).getValues() : [];
  const sRows = sc.getLastRow() > 1 ? sc.getRange(2, 1, sc.getLastRow() - 1, SCAN_HEAD.length).getValues() : [];
  const byId = {};
  const lists = lRows.filter(r => r[0]).map(r => {
    const l = { id: String(r[0]), title: r[1], user: r[2], notes: r[3], device: r[4],
      created: iso_(r[5]), updated: iso_(r[6]), status: r[7], items: [] };
    byId[l.id] = l;
    return l;
  });
  sRows.forEach(r => {
    const l = byId[String(r[0])];
    if (l) l.items.push({ n: r[3], sn: String(r[4]), t: iso_(r[5]) });
  });
  lists.forEach(l => l.items.sort((a, b) => a.n - b.n).forEach(i => delete i.n));
  return lists;
}

function toDate_(v) { const d = new Date(v); return isNaN(d) ? '' : d; }
function iso_(v) { return v instanceof Date ? v.toISOString() : (v ? String(v) : ''); }
