# Weekly Grocery List

Static, no-build web app. Files: `index.html` (app), `data.js` (this week's data), `sw.js` (offline cache), `manifest.webmanifest` + `icon.svg` (add to home screen).

## Updating the week
1. Edit `data.js` (or regenerate it): set a NEW `weekId` (e.g. `"2026-10-28"`). A new weekId starts with fresh checks, added and removed items.
2. Update `dates`, `priceNote`, tax rates, `discount`, `categories`, `recipes`, `prep`, `snacks`.
3. Categories must be one of: Fruits & Veggies, Meat & Seafood, Dairy, Frozen Foods, Sauces & Spices, Snacks & Beverages, Breads & Grains, Other. Item fields: `name`, `qty`, `price` (each), optional `soda: true` (soda tax), optional `aisle` (sorts within category).
4. Commit and push to `main`; GitHub Pages redeploys in about a minute. The service worker is network-first, so the new data shows on next online load.

## Views
- **Category** view: Fruits & Veggies, Meat & Seafood, Dairy, Frozen Foods, Sauces & Spices, Snacks & Beverages, Breads & Grains, Other.
- **Store route** view (walking order): Other (toiletries, household, pet, non-food) first, then Fruits & Veggies, Breads & Grains, Meat & Seafood, Dairy, Sauces & Spices, Snacks & Beverages, Frozen Foods last. To change it, edit the `ROUTE` array in `index.html`.

Do not put personal info (names, health data, addresses, store or account numbers) in any file.
