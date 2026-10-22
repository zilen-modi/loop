import type { CodeProblem, Problem } from "@/content/problem-types";
import { busiestStretch } from "./sliding-window/busiest-stretch";
import { riderBonus } from "./sliding-window/rider-bonus";
import { uniqueDishes } from "./sliding-window/unique-dishes";
import { surgeZones } from "./sliding-window/surge-zones";
import { coverMenu } from "./sliding-window/cover-menu";
import { peakLoad } from "./sliding-window/peak-load";
import { reviewCalmStretch } from "./sliding-window/review-calm-stretch";
import { pairForBill } from "./hashing/pair-for-bill";
import { orderRun } from "./hashing/order-run";
import { sameIngredients } from "./hashing/same-ingredients";
import { mirrorCode } from "./two-pointers/mirror-code";
import { widestBay } from "./two-pointers/widest-bay";
import { balancedTriples } from "./two-pointers/balanced-triples";
import { rooftopRain } from "./two-pointers/rooftop-rain";
import { rangeTotals } from "./prefix-sums/range-totals";
import { netStock } from "./prefix-sums/net-stock";
import { othersOutput } from "./prefix-sums/others-output";
import { splitwise } from "./lld/splitwise";
import { parkingLot } from "./lld/parking-lot";
import { lruLfu } from "./lld/lru-lfu";
import { rateLimiter } from "./lld/rate-limiter";
import { kvStore } from "./lld/kv-store";
import { urlShortenerLab } from "./hld/url-shortener";
import { distributedRateLimiterLab } from "./hld/distributed-rate-limiter";

export const problems: Problem[] = [
  // Chapter 3 · Hashing
  pairForBill, orderRun, sameIngredients,
  // Chapter 8 · Two pointers
  mirrorCode, widestBay, balancedTriples, rooftopRain,
  // Chapter 9 · Sliding window
  busiestStretch, riderBonus, uniqueDishes, surgeZones, coverMenu, peakLoad, reviewCalmStretch,
  // Chapter 10 · Prefix sums
  rangeTotals, netStock, othersOutput,
  // Low-level design · chapters 14, 15, 19, 20 and 25
  parkingLot,
  splitwise,
  rateLimiter,
  lruLfu,
  kvStore,
  // System design · chapters 22 and 24
  urlShortenerLab,
  distributedRateLimiterLab,
];

export const problemById = (id: string) => problems.find((p) => p.id === id);
export const codeProblemById = (id: string) => problems.find((p): p is CodeProblem => p.id === id && p.kind === "code");
export const problemsForChapter = (chapter: string) => problems.filter((p) => p.chapter === chapter).sort((a, b) => a.n - b.n);

/** Loop problems by the LeetCode number they mirror, for linking from the top-questions list. */
export const problemByLeetCode = (id: number) => problems.find((p): p is CodeProblem => p.kind === "code" && p.reference.label === `LeetCode ${id}`);
