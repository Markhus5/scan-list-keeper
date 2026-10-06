# Scan List Keeper

Barcode / serial-number list app for Samsung tablets (installable PWA), spun off from *Scanned Serial Numbers* in Shift Control.

- **Scanner app** (`index.html`): user enters a **Title**, **User** and optional **Notes** as the list heading, then scans away with a Bluetooth/USB scanner. Lists are kept on the tablet; users can **continue** an open list or **start another**.
- **Manager View** (`manager.html`): shows every list from every tablet in one table (pulled from a Google Sheet). Filter by user/date/status, search any serial, then **Copy for Excel** or **Download CSV**.

## Files

| File | Purpose |
|---|---|
| `index.html` | Scanner app |
| `manager.html` | Manager View |
| `manifest.json`, `sw.js`, `icons/` | PWA install + offline |
| `apps-script/Code.gs` | Google Sheet backend (not served by GitHub; paste into Apps Script) |

## 1. Put it on GitHub Pages

1. New repo, e.g. `scan-list-keeper` (public, like Reel Checker).
2. Upload everything in this folder (keep the `icons/` and `apps-script/` folders).
3. **Settings → Pages →** Source: *Deploy from a branch*, Branch: `main` / `(root)` → Save.
4. App: `https://<your-github-user>.github.io/scan-list-keeper/`
   Manager: `https://<your-github-user>.github.io/scan-list-keeper/manager.html`

## 2. Set up the Google Sheet (one time)

1. Create a Google Sheet, e.g. **Scan List Keeper Data**.
2. **Extensions → Apps Script**, delete the sample code, paste `apps-script/Code.gs`.
3. Change the two keys at the top:
   - `WRITE_KEY` – goes on the tablets (lets them send lists)
   - `MANAGER_KEY` – only you (lets Manager View read and delete)
4. **Deploy → New deployment → Web app** — *Execute as:* **Me**, *Who has access:* **Anyone** → Deploy → authorise → copy the URL ending in `/exec`.
5. The script creates two tabs automatically on first sync:
   - **Lists** – one row per list (Title, User, Notes, Tablet, Started, Updated, Status, Count)
   - **Scans** – one row per serial (ListID, Title, User, #, Serial, Scanned At, Tablet)

> After editing the script later: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy** (the URL stays the same).

## 3. Set up each tablet

1. Open the app URL in Chrome on the tablet → ⋮ → **Add to Home screen / Install**.
2. Tap ⚙ **Settings** → enter *Tablet name*, the `/exec` URL and the `WRITE_KEY` → **Test sync** → **Save**.
3. Faster for the next tablets: on the first tablet tap **Copy setup link**, send it (Teams/email) and open it on the other tablets — URL and key fill in automatically; just add the tablet name.

The top badge shows **Synced ✔**, **Syncing n…**, **Offline · n waiting** or **Sync error**. Scans are saved on the tablet first, so nothing is lost offline — they sync when Wi-Fi returns (retries every minute; tap the badge to force).

## 4. Manager View

Open `manager.html` on your PC → **Connection** → paste the `/exec` URL + `MANAGER_KEY` → **Save & load**.

- Click a row to see its serials; tick rows to export only those (none ticked = everything shown).
- **Copy for Excel** → click cell A1 in Excel → Ctrl+V. Columns: Title · User · Notes · Tablet · Started · # · Serial · Scanned at.
- **Download CSV** keeps long numeric serials and leading zeros intact.
- You can also just open the Google Sheet directly, or *File → Download → .xlsx*.

## Users

The **User** dropdown lists: Mark (test), Hen, Bao, Rocky, Dennis, Geraldine, Phung, Kim, Guest.
- **Guest** shows a name box → saved as `Guest – <name>` (or just `Guest`).
- **Mark (test)** lists get an orange **TEST** tag; tick **Hide test lists** in Manager View to keep them out of exports.
- To change the names, edit the `USERS` line near the top of the script in `index.html`, then bump `VERSION` in `sw.js`.

## Scanning behaviour

- Scanner must send **Enter** (or Tab) after each code — the default for most scanners.
- On-screen keyboard is hidden while scanning; tap **⌨ Type** to key a serial by hand.
- Duplicate in the same list → double low beep, red message, **not added** (switch to "warn only" in Settings).
- Serial already in a *different* list on that tablet → added, amber notice.
- **Undo last**, ✕ to remove a row, **Edit heading** to fix title/user, **Finish list** moves it to *Finished* (tap it to reopen).
- **Copy serials** (one per line) or **Copy for Excel** (heading block + #/Serial/Time table) for a single list straight from the tablet.

## Notes

- Deleting a list on a tablet does **not** remove it from the Google Sheet (manager keeps the record). Delete from Manager View if needed.
- **Backup lists / Restore backup** in Settings save the tablet's lists to a JSON file (e.g. before clearing Chrome data).
- After changing any file, bump `VERSION` in `sw.js` so installed tablets pick up the update.
- Excel tip when pasting: long numeric serials (12+ digits) may show as `1.23E+15` — format the Serial column as **Text** before pasting, or use the CSV.
