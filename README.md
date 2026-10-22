# Loop · zero to offer

Interview prep you read like a book and practise like a workout. Three books cover the syllabus: data structures and algorithms (40 chapters), low-level design and machine coding (38), and high-level design (48). Every chapter is half reading, half solving.

This first build has one complete chapter, **DSA chapter 9: Sliding window**, plus the engine every other chapter will use.

## What's here

- **Kindle-style reader:**
  - The chapter is split into pages; turn them by tapping the edges, swiping, or with the arrow keys, Page Up/Down and Space.
  - Two-page spread on wide screens.
  - The controls stay hidden until you tap the middle of the page.
  - Location and "minutes left", learned from your own reading speed.
  - Paper, Sepia, Night and High contrast themes, set in Literata.
  - An "Aa" menu for size, spacing, margins and typeface.
- **Memory aids:**
  - **Highlights and notes:** each highlight becomes a spaced-review card with its key word blanked out.
  - **X-Ray:** tap a concept word for its definition, its signature colour and glyph, and where else it appears.
  - Retrieval checkpoints, an interactive window explorer, and a live scale race between O(n·k) and O(n).
  - Explain-it-back with a model answer, and recap cards.
- **Problems:**
  - A ladder of seven problems: six coding problems and one code-review bug hunt.
  - Each one is set in the Tiffin world and links to the equivalent LeetCode problem, but the wording and tests are Loop's own.
  - **Workbench:** JavaScript or Python (Python runs in the browser through Pyodide), Run and Submit, then hidden tests and a scale test that separates O(n) from slower approaches. Hints come one at a time, and the walkthrough unlocks after an attempt.
- **Top questions:** 91 most-practised coding questions by pattern (the classic 75 plus 16 additions, numbers and difficulty fetched from LeetCode), 25 low-level design and 25 system-design questions with what a strong answer covers, and 14 behavioral questions with a private STAR story bank. Progress is ticked off locally.
- **More problems:** 24 in total, now also covering hashing, two pointers and prefix sums.
- **Practice:** re-solves on a 1/3/7/21-day schedule, mixed sets with titles hidden, timed rounds, and review cards.
- **Privacy:** no AI, no accounts and no backend. Progress lives in this browser's localStorage. The only outside requests are for Pyodide, from jsDelivr, when you pick Python.

## Run

```bash
npm install
npm run dev            # http://localhost:3002
npm run check:content  # proves every example, test, answer key and reference solution is right
node scripts/fetch-leetcode-meta.mjs  # refreshes the top-questions list from LeetCode
```

`check:content` needs `python3` for the Python reference solutions.

## Adding a chapter

1. Write `content/chapters/<slug>.mdx`. Chapter components (`Story`, `Term`, `Checkpoint`, `ProblemLadder`, `ExplainBack`, `Recap`, `Sources`, …) are available without imports.
2. Register it in `content/chapters/index.ts` and set `slug` and `available: true` in `content/syllabus.ts`.
3. Add problems under `content/problems/<chapter>/` (see `content/problem-types.ts`) and list them in `content/problems/index.ts`.
4. Add concepts to `content/concepts.ts` and checkpoints to `content/checkpoints.ts`. Use `compute` for any answer that can be calculated.
5. Run `npm run check:content`.
