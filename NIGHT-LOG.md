# Night log

The run started on 22 October 2026 at 23:50. The plan is Block 0 (responsive), then 1 (simulator engine), 2 (simulator UI), 3 (LLD builds), 4 (HLD labs), 5 (polish), then the overflow queue.

Legend: ✅ done · ⚠️ done with caveats · ⛔ stuck (partial work on a `wip/` branch)

Every item has to pass the same gate before it counts as done: tsc, lint, `check:content`, build, its own browser test, the regression suites, the responsive sweep and a screenshot review.

HLD progress: 6 / 48 chapters. LLD progress: 10 / 38 chapters.

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
| 15 | HLD 6 Caching chapter | ✅ | 7784655 | Write strategies, stampedes, jitter, hot keys; a stampede figure; 3 computed checkpoints. |
| 16 | HLD 24 Distributed rate-limiter lab and chapter | ✅ | 9b335e3 | 9 checks; 5 wrong designs each fail their intended check (in `check:content` and in the browser). Added `wired()` to the graph so "store down" and "never linked" are told apart. |
| 17 | HLD 25 Notification-system lab and chapter | ✅ | 519b17b | 9 checks including a provider outage; drill now supports "tolerated" pauses (deliveries wait in the queue). |
| 18 | HLD 26 News-feed lab and chapter | ✅ | bb54b71 | Pull, push and hybrid each fail or pass for the right reason. The failure check caught a flaw in my own reference (2 LBs → needs 3). |
| 19 | Today view on the home page | ✅ | 68d1bc2 | Re-solves due, review cards due and "continue reading" across the three books, with empty states. 12/12 browser checks with seeded progress. |
| 20 | Final pass: accessibility, bundle, README | ✅ | e1d93f9 | Lazy-loaded problem screens: `/problems/[id]` first load 357 → 154 kB. Four colour tokens adjusted so every theme meets WCAG AA. Canvas reachable by keyboard (6/6 a11y checks). README explains adding a build and a lab. Full responsive sweep: 1376/1376 page states. |
| 21 | LLD 21 Vending machine build and chapter | ✅ | f0616c8 | State pattern, escrow and greedy change from the coins held; 5 mutants caught. The checks caught my scenario expecting ₹1 change from a machine with no ₹1 coins. |
| 22 | LLD 17 Movie-ticket booking build and chapter | ✅ | f0616c8 | All-or-nothing holds that expire by time, with no timers; races staged call by call; 5 mutants caught; SeatRace figure. |
| 23 | LLD 16 Elevator build and chapter | ✅ | f0616c8 | SCAN movement and a cost-based dispatcher in ticks; out-of-service cars hand their hall calls back; 5 mutants caught. Items 21–23 are in one commit because they share the registration files. |
| 24 | LLD 28 Stock-exchange order book build and chapter | ✅ | (this commit) | Price-time matching, market orders, cancel, depth; extension: modify (keep or lose your place) and icebergs. 13 scenarios + 3 generated, including a 40,000-call opening bell; 7 mutants caught. A slow variant that scans the whole book is correct but 7.5× over the limit. JS and Python 16/16 in the browser; BookLadder figure; 96/96 responsive states. |
