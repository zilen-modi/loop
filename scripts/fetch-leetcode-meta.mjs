// Fetches number, title, difficulty and premium flag for each slug from LeetCode's public API,
// so the top-questions list never relies on memory. Writes content/top/leetcode-meta.json.
import { writeFileSync } from "node:fs";

const groups = {
  "Arrays and hashing": ["two-sum", "contains-duplicate", "valid-anagram", "group-anagrams", "top-k-frequent-elements", "product-of-array-except-self", "longest-consecutive-sequence", "encode-and-decode-strings", "subarray-sum-equals-k"],
  "Two pointers": ["valid-palindrome", "3sum", "container-with-most-water", "trapping-rain-water"],
  "Sliding window": ["best-time-to-buy-and-sell-stock", "longest-substring-without-repeating-characters", "longest-repeating-character-replacement", "minimum-window-substring", "sliding-window-maximum"],
  "Stack": ["valid-parentheses", "min-stack", "daily-temperatures"],
  "Binary search": ["find-minimum-in-rotated-sorted-array", "search-in-rotated-sorted-array", "koko-eating-bananas", "median-of-two-sorted-arrays"],
  "Linked list": ["reverse-linked-list", "merge-two-sorted-lists", "reorder-list", "remove-nth-node-from-end-of-list", "linked-list-cycle", "merge-k-sorted-lists", "lru-cache"],
  "Trees": ["invert-binary-tree", "maximum-depth-of-binary-tree", "same-tree", "subtree-of-another-tree", "lowest-common-ancestor-of-a-binary-search-tree", "binary-tree-level-order-traversal", "validate-binary-search-tree", "kth-smallest-element-in-a-bst", "construct-binary-tree-from-preorder-and-inorder-traversal", "binary-tree-maximum-path-sum", "serialize-and-deserialize-binary-tree"],
  "Tries": ["implement-trie-prefix-tree", "design-add-and-search-words-data-structure", "word-search-ii"],
  "Heaps": ["kth-largest-element-in-an-array", "task-scheduler", "find-median-from-data-stream"],
  "Backtracking": ["combination-sum", "word-search"],
  "Graphs": ["number-of-islands", "clone-graph", "pacific-atlantic-water-flow", "course-schedule", "rotting-oranges", "graph-valid-tree", "number-of-connected-components-in-an-undirected-graph", "accounts-merge", "word-ladder", "network-delay-time", "alien-dictionary"],
  "Intervals": ["insert-interval", "merge-intervals", "non-overlapping-intervals", "meeting-rooms", "meeting-rooms-ii"],
  "Dynamic programming": ["climbing-stairs", "house-robber", "house-robber-ii", "longest-palindromic-substring", "palindromic-substrings", "decode-ways", "coin-change", "maximum-product-subarray", "word-break", "longest-increasing-subsequence", "unique-paths", "longest-common-subsequence", "edit-distance", "combination-sum-iv"],
  "Greedy": ["maximum-subarray", "jump-game"],
  "Matrix": ["set-matrix-zeroes", "spiral-matrix", "rotate-image"],
  "Bit manipulation": ["number-of-1-bits", "counting-bits", "reverse-bits", "missing-number", "sum-of-two-integers"],
};

// The 75 from the widely shared "Blind 75" list; everything else is an addition.
const blind75 = new Set(["two-sum","best-time-to-buy-and-sell-stock","contains-duplicate","product-of-array-except-self","maximum-subarray","maximum-product-subarray","find-minimum-in-rotated-sorted-array","search-in-rotated-sorted-array","3sum","container-with-most-water","sum-of-two-integers","number-of-1-bits","counting-bits","missing-number","reverse-bits","climbing-stairs","coin-change","longest-increasing-subsequence","longest-common-subsequence","word-break","combination-sum-iv","house-robber","house-robber-ii","decode-ways","unique-paths","jump-game","clone-graph","course-schedule","pacific-atlantic-water-flow","number-of-islands","longest-consecutive-sequence","alien-dictionary","graph-valid-tree","number-of-connected-components-in-an-undirected-graph","insert-interval","merge-intervals","non-overlapping-intervals","meeting-rooms","meeting-rooms-ii","reverse-linked-list","linked-list-cycle","merge-two-sorted-lists","merge-k-sorted-lists","remove-nth-node-from-end-of-list","reorder-list","set-matrix-zeroes","spiral-matrix","rotate-image","word-search","longest-substring-without-repeating-characters","longest-repeating-character-replacement","minimum-window-substring","valid-anagram","group-anagrams","valid-parentheses","valid-palindrome","longest-palindromic-substring","palindromic-substrings","encode-and-decode-strings","maximum-depth-of-binary-tree","same-tree","invert-binary-tree","binary-tree-maximum-path-sum","binary-tree-level-order-traversal","serialize-and-deserialize-binary-tree","subtree-of-another-tree","construct-binary-tree-from-preorder-and-inorder-traversal","validate-binary-search-tree","kth-smallest-element-in-a-bst","lowest-common-ancestor-of-a-binary-search-tree","implement-trie-prefix-tree","design-add-and-search-words-data-structure","word-search-ii","top-k-frequent-elements","find-median-from-data-stream"]);

const q = `query q($s:String!){question(titleSlug:$s){questionFrontendId title difficulty isPaidOnly}}`;
const out = [];
const missing = [];
for (const [pattern, slugs] of Object.entries(groups)) {
  for (const slug of slugs) {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Referer: "https://leetcode.com" },
      body: JSON.stringify({ query: q, variables: { s: slug } }),
    });
    const j = await res.json();
    const m = j?.data?.question;
    if (!m) { missing.push(slug); continue; }
    out.push({ slug, pattern, id: Number(m.questionFrontendId), title: m.title, difficulty: m.difficulty, premium: m.isPaidOnly, classic: blind75.has(slug) });
    await new Promise((r) => setTimeout(r, 120));
  }
}
const inList = new Set(out.map((x) => x.slug));
const notGrouped = [...blind75].filter((s) => !Object.values(groups).flat().includes(s));
writeFileSync(new URL("../content/top/leetcode-meta.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(`fetched ${out.length}; missing: ${missing.join(", ") || "none"}; classic in list: ${out.filter((x) => x.classic).length}/75; classic not grouped: ${notGrouped.join(", ") || "none"}; dupes: ${out.length - inList.size}`);
