# Work-day schedule (v58)

## Relay state
- Kind: `schedule`, id: `work`, value: weekday codes the person works, in Mon–Sun order, e.g. `["Tue","Wed","Sat"]`. `[]` means no work days; `null` clears the entry (default schedule).
- Stored per week like the other kinds (LWW by `ts`), so each week starts with no schedule unless one is set.
- Write (same endpoint, headers and auth as the app's other ops):

```
POST https://grocery-relay.pantry-relay-4821.workers.dev/state/ops?week=2026-11-02
Headers: X-App-Pin: <family PIN>   Origin: https://slaythegrey.github.io   Content-Type: application/json
Body: {"ops":[{"k":"schedule","id":"work","v":["Tue","Wed","Sat"],"ts":<epoch ms>}]}
```
- Read: `GET /state?week=…` returns `state.schedule.work = {"v":[…],"ts":…}`.
- The relay worker accepts `schedule` (added Nov 3, 2026).

## App
- Settings → "Work days": 7 toggles. Each toggle saves `localStorage["grocery-workdays"]` (works offline) and queues the op above. Relay state replaces the local copy when it syncs.
- `schedule.js`: a pure function `Schedule.assign(workDays, recipes)` that returns `{active, map:{recipeId:day}, noCook, moved, prepDay}`. `Schedule.prep(lines, res)` moves prep lines that start with a work day to the nearest day off.
  - Dinners stay put if their day is a day off. A dinner whose day is a work day moves to a day off: perishable dinners (raw chicken, ground beef, shrimp) go to the earliest free day off, and others go to the nearest free day off. If there are more dinners than days off, two dinners share a day (cook one ahead). Batch, sheet-pan and slow-cooker dinners avoid days that already have a dinner.
  - If no days or all 7 days are selected, the default schedule is used.
- Wired into: the Tonight card (on a work day it shows "No cooking: reheat or zero-prep lunch"), recipe day order and labels (rDay), the prep checklist, and todayRecipe. The Cooked toggle is unchanged.
- Test: `node schedule.test.js`.
