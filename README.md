# Weekly Grocery List

Static, no-build web app. Files: `index.html` (app), `data.js` (this week's data), `sw.js` (offline cache), `manifest.webmanifest` + `icon.svg` (add to home screen).

## Updating the week
1. Edit `data.js` (or regenerate it): set a NEW `weekId` (e.g. `"2026-10-28"`). A new weekId starts with fresh checks, added and removed items.
2. Update `dates`, `priceNote`, tax rates, `discount`, `categories`, `recipes`, `prep`, `snacks`, `shoppingDayLunches` (intro + 4–5 zero-prep keto options from list items: name, desc, carbs, protein, keep). Keep it every week.
3. Categories must be one of: Fruits & Veggies, Meat & Seafood, Dairy, Frozen Foods, Sauces & Spices, Snacks & Beverages, Breads & Grains, Other. Item fields: `name`, `qty`, `price` (each), optional `soda: true` (soda tax), optional `aisle` (sorts within category).
4. Commit and push to `main`; GitHub Pages redeploys in about a minute. The service worker is network-first, so the new data shows on next online load.

## Walmart links
Each item can have `url` and `urlType` in `data.js`. Use `urlType: "product"` with a real `https://www.walmart.com/ip/...` URL to show a **Walmart ↗** button; anything else shows **Search ↗** (a Walmart search link). Items without `url`, including ones you add in the app, get a search link built from their name. Links open in a new tab and do not toggle the checkbox. Never guess product IDs.

`walmart-links.json` maps item names to real product URLs from past carts; reuse it when building a new week's `data.js`.

## Views
- **Category** view: Fruits & Veggies, Meat & Seafood, Dairy, Frozen Foods, Sauces & Spices, Snacks & Beverages, Breads & Grains, Other.
- **Store route** view (v29): sections are store zones (Toiletries & household → Back wall & frozen → Left wall → Center aisles → Produce), ordered by the `walkOrder` table in `aisle-map.json` (see below). If the map has no `walkOrder`, it falls back to the category `ROUTE` array in `index.html`.

Do not put personal info (names, health data, addresses, store or account numbers) in any file.
## Photos (add by photo)
The webhook cuts request bodies at about 4KB, so the Cloudflare relay keeps each photo in Workers KV (GROCERY_PHOTOS, 7-day expiry). It forwards `imageUrl` (`https://grocery-relay.pantry-relay-4821.workers.dev/photo/<id>`) plus `imageBytes` in place of the image, and trims `text` to 1500 characters. Fetching a photo requires the family PIN (`X-App-Pin` header or `?pin=`). On the box: `./fetch-photo.sh <imageUrl> out.jpg` (reads `GROCERY_APP_PIN` from the environment).

## data.js fields (all optional, backwards compatible)
- `weekId` (`YYYY-MM-DD`, start of the shopping week). The shared-state doc is keyed by it. Day dates on Recipes are computed from its first 10 characters. `nextWeek.weekId` is optional (otherwise weekId + 7 days).
- Item: `name, qty, price, url, aisle, soda` as before, plus:
  - `addedBy: "user"`: a user's own pick, counted under "Your additions", never toward the $200 planned budget.
  - `carried: true`: carried over from last week by Done shopping. Also a user addition.
  - `recipes: ["<recipe id>", ...]`: which recipes use this item. Recipe cards show "Items on the list for this recipe" and, when removal is pending, "These items would drop off: ...".
- Recipe: `title` (a "Mon: …" prefix still works), plus:
  - `id`: a stable slug, referenced by item `recipes`.
  - `day: "Mon".."Sun"`: groups recipes by day and highlights today. Recipes with no day go under "Extras". When `day` is missing, the title prefix is used.
- `staples: [{name, url, price, cat, soda?}]`: Staples quick-add list (from preferred-products.json). One tap adds the staple to the chosen list as a user addition, id `u:st:<slug>:<this|next>`, with no duplicates.
- `replies: [{id, ts, text, ref?}]`: assistant replies shown in Chat, newest first. `ts` is ISO or epoch ms; `ref` is an optional request rid. Each phone keeps an unread dot based on the newest `ts` it has seen (localStorage). Add a new entry per reply; never reuse an `id`.

## Shared state (relay) — reading it from the routine
`GET https://grocery-relay.pantry-relay-4821.workers.dev/state?week=<weekId>` with header `X-App-Pin` returns `{state:{<kind>:{<id>:{v,ts,by}}}}`. Ops are last-write-wins per (kind, id); `v:null` means cleared. Item ids are `g:<cat>:<index>` (this week), `n:<cat>:<index>` (next week), or `u:...` for added items.
- `checked`, `removed`, `aisle`, `chosen`, `cancelled`, `recipe` (recipe removals and picks): as before.
- `added`: `{name, qty, price, url, cat, list:"this"|"next", addedBy:"user", carried?, staple?, note?}`. **At rollover, fold every `added` item with `list:"next"` (including carried ones) into the new data.js as `addedBy:"user"`, or it will be lost.**
- `qty`: the new quantity (string/number) for that item id. It overrides the data.js qty; null means use the data.js value.
- `note`: free-text note for the item (max 300 chars). It may contain personal text, so never publish it.
- `cooked`: id = recipe id → `{v:"cooked"|"leftovers", title, list, at, by}`.
- `done`: id `this` → `{at, by, n}`, the last Done shopping (n = items carried). Done shopping clears checks and adds unchecked items as carried `added` items with id `u:carry:<item id>`. Those ids are deterministic, so two phones can't double-carry.

## Backups
`/workspace/grocery-app-backup.sh` (on the assistant's box) saves state for this and next week plus data.js to `/workspace/backups/grocery-<date>.json`. It commits a copy to `backups/` only when there are no notes or other free-text fields.

## List tab layout (v27)
- **＋ Add** opens one sheet with the item text, a 📷 photo with preview, and a This/Next week picker.
  - **Send to assistant** uses the relay, and photos are supported.
  - **I'll add it myself** (qty, category, price) → **Add directly** writes an `added` state op with `addedBy:"user"`, as before.
  - Staples quick-add is in the sheet, and also under **⋯ More**.
- Checked items always move to the bottom of their section, crossed out (v28 removed the Checked: Bottom/Hidden/Stay control and its per-phone setting). There is no Clear checks button; Done shopping clears checks.
- **⋯ More** holds Restore removed items (with a count badge), Staples, and PIN & appearance settings.
- Totals show Planned, Your additions and Estimated total. Subtotal, rollback and tax lines are under **Details**, and the math is unchanged.
- After the PIN is saved, Chat > Settings shows "PIN saved on this phone ✓" with Change/Forget PIN. A "Sync: check PIN" message opens Settings when tapped.

## Store route and aisle map (v32)
- v32: A8 added to `walkOrder` between A9 and A7 (center aisles back to front: A20, A16, A9, A8, A7, A6, A3). Back-wall order A30 → A33 → A34 confirmed from map pin positions. Dairy rule: butter, eggs, sour cream → A34.
- v31: `walkOrder` now follows the real path: A24 (toiletries) → back wall & frozen (A30, A33, A34) → left wall (A35, A36) → center aisles back to front (A20, A16, A9, A7, A6, A3) → produce (A1, AP10), then checkout. Zone headings: Toiletries & household, Back wall & frozen, Left wall (meat & cheese), Center aisles, Produce. Category anchors: Other A24, Frozen A30, Dairy A33 (rules: cheese A35, butter/eggs A34), Meat A36, Snacks/Drinks A20, Sauces/Spices A9, Produce and Bread A1.
- v30: walk adds AP10 (produce, after A1) and A16 (between A9 and A20). New `itemAnchors` rules (cat + name regex → aisle) are checked before `categoryAnchor` for items with no aisle; e.g. Dairy cheese → A35 (left wall), butter/eggs → A34.
- v29: `aisle-map.json` has an explicit `walkOrder` list: `{order, aisle, zone, note}` (orders step by 10 so new aisles fit between). Current walk: A24 → A1 → A36 → A35 → A34 → A33 → A3 → A6 → A7 → A9 → A20 → A30. To tweak, edit the `order` numbers; to add a newly observed aisle, add a row. `categoryAnchor` maps each category to an aisle: items with no known aisle (and aisles not in `walkOrder`) are placed right after their category's anchor (e.g. an unknown Meat item goes after A36). `path`/`pathOrder` are now generated from `walkOrder`. Checked items still go to the bottom of each section.
- `aisle-map.json` is served with the site (and cached by the service worker). It holds store aisle labels seen on walmart.com product pages for our store, plus product names and urls. It has no address or personal info.
  - `items`: keyed by `ip:<walmart product id>`, each `{url, name, cat, aisle, observed (date), confidence, source}`. `aisle` is null until it's seen.
  - `categories`: category → `[{aisle, items}]`, the aisles each item type has been seen on.
  - `path` / `pathOrder`: the inferred walking order of aisle labels. Sections follow the usual route (Other/household first … Frozen Foods last). Within a section, aisles are ordered by letter then number. **The order is a guess**, marked in `basis`.
- **Store route** view sorts each section by `pathOrder`. Items with no known aisle go last in their section, and checked items go to the very bottom. An item's aisle is its data.js `aisle` if set, otherwise the map entry for its product url. It shows as "Aisle X12". Category view is unchanged.
- Update with `node update-aisle-map.js` (the full usage is in the script header):
  - `--init data.js preferred-products.json` adds new items.
  - `--observe <url> <aisle>` / `--from obs.json` / `--html saved-page.html <url>` records aisles.
  - `--fetch N` makes a polite curl attempt and stops at Walmart's bot check.
  - `--todo` lists the urls that still need an aisle.
  - `--apply data.js` fills in missing item `aisle` fields.
  - Commit `aisle-map.json` afterwards.
