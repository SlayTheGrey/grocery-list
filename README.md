# Weekly Grocery List

Static, no-build web app. Files: `index.html` (app), `data.js` (this week's data), `sw.js` (offline cache), `manifest.webmanifest` + `icon.svg` (add to home screen).

## Updating the week
1. Edit `data.js` (or regenerate it): set a NEW `weekId` (e.g. `"2026-10-28"`). A new weekId starts with fresh checks, added and removed items.
2. Update `dates`, `priceNote`, tax rates, `discount`, `categories`, `recipes`, `prep`, `snacks`.
3. Categories must be one of: Fruits & Veggies, Meat & Seafood, Dairy, Frozen Foods, Sauces & Spices, Snacks & Beverages, Breads & Grains, Other. Item fields: `name`, `qty`, `price` (each), optional `soda: true` (soda tax), optional `aisle` (sorts within category).
4. Commit and push to `main`; GitHub Pages redeploys in about a minute. The service worker is network-first, so the new data shows on next online load.

## Walmart links
Each item can have `url` and `urlType` in `data.js`. Use `urlType: "product"` with a real `https://www.walmart.com/ip/...` URL to show a **Walmart ↗** button; anything else shows **Search ↗** (a Walmart search link). Items without `url`, including ones you add in the app, get a search link built from their name. Links open in a new tab and do not toggle the checkbox. Never guess product IDs.

`walmart-links.json` maps item names to real product URLs from past carts; reuse it when building a new week's `data.js`.

## Views
- **Category** view: Fruits & Veggies, Meat & Seafood, Dairy, Frozen Foods, Sauces & Spices, Snacks & Beverages, Breads & Grains, Other.
- **Store route** view (walking order): Other (toiletries, household, pet, non-food) first, then Fruits & Veggies, Breads & Grains, Meat & Seafood, Dairy, Sauces & Spices, Snacks & Beverages, Frozen Foods last. To change it, edit the `ROUTE` array in `index.html`.

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
