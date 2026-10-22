import type { DesignProblem } from "@/content/problem-types";

export const notificationSystemLab: DesignProblem = {
  kind: "design",
  id: "notification-system",
  chapter: "notification-system",
  n: 1,
  title: "Order updates, without losing one",
  level: "Medium",
  shape: "Queues, retries and idempotency",
  rounds: ["System design"],
  scenarioId: "notification-system",
};
