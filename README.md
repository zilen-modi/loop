# Loop · zero to offer

Interview prep you read like a book and practise like a workout. Three books cover the syllabus:
- data structures and algorithms (40 chapters);
- low-level design and machine coding (38);
- high-level design (48).

Every chapter is half reading, half solving.

Ready so far:
- **DSA 9:** Sliding window.
- **LLD 9, 14, 15, 19, 20, 25:** the machine-coding playbook, Parking lot, Splitwise, Rate limiter, LRU and LFU cache, Key-value store.
- **HLD 1, 6, 22, 24, 25, 26:** the interview framework, Caching, URL shortener, Distributed rate limiter, Notification system, News feed.

Every page works from a 320 px phone to a wide desktop.

## What's here

- **Kindle-style reader:**
  - The chapter is split into pages; turn them by tapping the edges, swiping, or with the arrow keys, Page Up/Down and Space.
  - Two-page spread on wide screens.
  - Controls stay hidden until you tap the middle of the page.
  - Location and "minutes left", learned from your own reading speed.
  - Paper, Sepia, Night and High contrast themes, all meeting WCAG AA contrast.
- **Memory aids:**
  - **Highlights and notes:** each highlight becomes a spaced-review card.
  - **X-Ray:** tap a concept word to see what it means and where else it appears.
  - Retrieval checkpoints (answers are computed, not typed).
  - Explain-it-back, and recap cards.
  - An interactive figure in every chapter.
- **Coding problems:**
  - Each is set in the Tiffin world, with its own wording and tests, and links to the LeetCode equivalent.
  - **Workbench:** JavaScript or Python (Python runs in the browser through Pyodide), visible and hidden tests, and a scale test that separates O(n) from slower approaches.
  - Code-review bug hunts.
- **Machine-coding bench:**
  - A timed build of one class against a spec, in JavaScript or Python.
  - Hidden scenarios drive it, including generated ones with thousands of calls.
  - When the core passes, the interviewer adds an extension.
  - Hints, a self-review checklist, and a reference design.
- **Design lab:**
  - Build an architecture on a live system map: drag components in, link them, set machine counts, make the key decisions.
  - The simulator runs the design at peak: load rings, traffic on every link, latency per hop and cost.
  - A scorecard checks each requirement.
  - A failure drill knocks out one machine at a time.
  - Interview mode adds a 45-minute clock and the framework as a checklist.
  - **Compare** saves designs by name and puts any two side by side; **Export** downloads a picture and Markdown notes.
- **Today, Practice and Top questions:**
  - Re-solves due across all three tracks, on a 1/3/7/21-day schedule.
  - Review cards.
  - Mixed sets and timed rounds.
  - The most-asked coding, design and behavioral questions.
- **Book contents:** a table per book, grouped by part: each chapter's status (Start, Reading, Finished, Soon) and its problems solved, with an "only ready chapters" filter.
- **Problems page:** a list, or a sortable table (type, book, chapter, level, status, attempts, last solved, next re-solve), with search and filters.
- **Search:** ⌘K (Ctrl K) anywhere, or the search button, finds chapters, sections, concepts, problems and top questions from a local index.
- **Privacy:** no AI, no accounts and no backend. Progress lives in this browser's localStorage. The only outside requests are for Pyodide, from jsDelivr, when you pick Python.

## Run

```bash
npm install
npm run dev            # http://localhost:3002
npm run check:content  # proves every example, test, answer key, reference solution and reference design is right
npm run gen:search     # rebuilds content/search-index.json after adding chapters, concepts or problems
node scripts/fetch-leetcode-meta.mjs  # refreshes the top-questions list from LeetCode
```

`check:content` needs `python3` for the Python reference solutions.

## Adding a chapter

1. Write `content/chapters/<slug>.mdx`. Chapter components (`Story`, `Term`, `Checkpoint`, `ProblemLadder`, `ProblemLink`, `ExplainBack`, `Recap`, `Sources` and the figures) are available without imports. Register new figures in `components/chapter/mdx.tsx`.
2. Register it in `content/chapters/index.ts` (`"<book>/<slug>"`) and set `slug` and `available: true` in `content/syllabus.ts`. Slugs must be unique across books.
3. Add concepts to `content/concepts.ts` and checkpoints to `content/checkpoints.ts`. Use `compute` for any answer that can be calculated.
4. Run `npm run gen:search`, then `npm run check:content` (it fails if the search index is out of date).

## Adding a machine-coding build

A build is a `BuildProblem` (see `content/problem-types.ts`); `content/problems/lld/parking-lot.ts` is a complete example.

1. **Spec:** a statement, core and extension requirements, an API table (JavaScript and Python names), and exact rules. If two people could read a rule differently, the hidden tests will catch one of them.
2. **References:** `solution.js` and `solution.py`, plus a `starter` that compiles but does nothing useful. Python method names are the camelCase names in snake_case.
3. **Scenarios:**
   - Hand-written lists of calls with expected results (`expect`) or `throws: true`. Mark a few `visible` for Run.
   - Include invalid-input cases that must leave the state unchanged.
   - Add `generated` scenarios: a seeded function that makes thousands of calls. Their expected results come from the JS reference.
4. **Proof that the tests have teeth:**
   - `mutants`: small edits to the JS reference that introduce plausible bugs. Each must fail at least one scenario.
   - For complexity requirements, a `slowVariant` that is correct but too slow, and must miss a time limit clearly.
5. **Guidance:** three hints, a design-review checklist, and a walkthrough.
6. List it in `content/problems/index.ts`, run `npm run gen:search`, then `npm run check:content`. It checks:
   - both references pass every scenario, and the starter fails the core;
   - every mutant is caught;
   - the slow variant misses its limit.

## Adding a design lab

A lab is a `DesignScenario` (see `lib/design/evaluate.ts`) in `content/designs/`, plus a `DesignProblem` in `content/problems/hld/`. `content/designs/notifications-lab.ts` is a complete example.

1. **Components** come from `lib/design/catalog.ts`. Add one there if you need it, with round, documented numbers.
2. **Flows:** each request type (a redirect, a post, a fan-out job) is a `route(graph, traffic)` function that returns the hops a request takes, or why it can't get through.
   - A hop's `share` scales the load: a cache hit stops 90% of reads before the database.
   - `onPath: false` adds load without latency (replication, cache invalidation).
   - The engine (`lib/design/engine.ts`) adds up load, utilisation, latency and traffic per link.
3. **Decisions:** the trade-offs to choose between, each option with its consequence.
4. **Criteria:** each `check(ctx)` returns pass/fail and a sentence; `focus` lists the boxes to highlight. Use `tolerates` for flows that may pause by design when a component fails.
5. **Designs:**
   - a `reference` design that passes everything;
   - a `naive` one;
   - named `wrong` designs, each failing one specific criterion.
6. Pin the reference's numbers (`pinned`) and register the scenario in `content/designs/index.ts`. Then run `npm run gen:search` and `npm run check:content`. It verifies:
   - the reference passes every check;
   - each wrong design fails its criterion;
   - the naive, empty and one-machine-each designs fail;
   - traffic adds up at every component;
   - the pinned numbers haven't moved.
