import type { DesignProblem } from "@/content/problem-types";

export const chatProblem: DesignProblem = {
  kind: "design",
  id: "chat",
  chapter: "chat",
  n: 1,
  title: "Chat with your rider, live",
  level: "Hard",
  shape: "Connections, a registry, presence, ordering",
  rounds: ["System design"],
  scenarioId: "chat",
};
