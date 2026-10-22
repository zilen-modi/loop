import type { DesignProblem } from "@/content/problem-types";

export const distributedRateLimiterLab: DesignProblem = {
  kind: "design",
  id: "distributed-rate-limiter",
  chapter: "distributed-rate-limiter",
  n: 1,
  title: "Rate limits across a fleet of gateways",
  level: "Medium",
  shape: "Shared counters · fail open or closed",
  rounds: ["System design"],
  scenarioId: "distributed-rate-limiter",
};
