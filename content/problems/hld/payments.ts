import type { DesignProblem } from "@/content/problem-types";

export const paymentsProblem: DesignProblem = {
  kind: "design",
  id: "payments",
  chapter: "payments",
  n: 1,
  title: "Every rupee, exactly once",
  level: "Hard",
  shape: "Idempotency, double entry, reconciliation",
  rounds: ["System design"],
  scenarioId: "payments",
};
