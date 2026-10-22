# Night log

The run started on 22 October 2026 at 23:50. The plan is Block 0 (responsive), then 1 (simulator engine), 2 (simulator UI), 3 (LLD builds), 4 (HLD labs), 5 (polish), then the overflow queue.

Legend: ✅ done · ⚠️ done with caveats · ⛔ stuck (partial work on a `wip/` branch)

Every item has to pass the same gate before it counts as done: tsc, lint, `check:content`, build, its own browser test, the regression suites, the responsive sweep and a screenshot review.

HLD progress: 2 / 48 chapters. LLD progress: 7 / 38 chapters.

| # | Item | Status | Commit | Notes |
|---|---|---|---|---|
| R1 | Responsive sweep (`responsive.cjs`): 13 routes plus open states × 8 viewports × Paper/Night; checks overflow, 40 px touch targets, 12 px text, covered controls, fixed bars | ✅ | 45bd13c | Self-test catches a planted overflow, tiny button and tiny text. The script lives in the scratchpad. |
| R2 | Fix every responsive failure | ✅ | 45bd13c | 544/544 states pass. Phones get a bottom tab bar, swipeable covers, filters behind a button, a sticky Run/Submit bar, and glossary terms that wrap. |
| 1 | Scenario-declared request flows, generic engine | ✅ | 628d7fd | Golden comparison with the old engine: 111/112 identical (the one difference is a more specific error message). Reference numbers pinned in `check:content`. |
| 2 | Six new components (object storage, search, WebSocket, stream, rate limiter, external provider) | ✅ | 628d7fd | `check:content` checks every component's fields and routes a flow through each one. |
| 3–10 | "Live system map" lab UI | ✅ | 5e60385 | Committed together (items 3–10 share one component tree). 48/48 browser checks. Found and fixed two real bugs: Chrome won't drag a `<button>`, and adding a box re-fit the view mid-drop. |
| 11 | LLD 14 Parking lot build and chapter | ✅ | d3f99c3 | 13 scenarios + 2 generated days (~96% of calls succeed); 5 mutants caught; JS and Python 8/8 in the browser. Added the mutant check to `check:content`. |
| 12 | LLD 20 LRU and LFU cache build and chapter | ✅ | 6f67064 | O(1) required: a slow-variant check shows the array version is correct but 1.8× over the limit, while the references take 91 ms (JS) and 362 ms (Python) in the browser. Python now gets 4× JS's limit on generated scenarios. The computed checkpoint caught my own wrong option set. |
| 13 | LLD 19 Rate limiter build and chapter | ✅ | 91e2928 | Exact integer refill; 13 scenarios + 3 generated; 6 mutants caught. The reference caught two mistakes in my scenario text (a 1506/1006 boundary, and a capacity that capped the fraction). |
| 14 | LLD 25 Key-value store with TTL and nested transactions | ✅ | 3119e85 | Undo logs + expiry min-heap; 13 scenarios + 2 generated; 6 mutants caught. Planned "snapshot" became `items(time)`, a sorted listing. |
