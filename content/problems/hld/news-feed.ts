import type { DesignProblem } from "@/content/problem-types";

export const newsFeedProblem: DesignProblem = {
  kind: "design",
  id: "news-feed",
  chapter: "news-feed",
  n: 1,
  title: "The food feed, with a celebrity chef",
  level: "Hard",
  shape: "Fan-out on write, read or both",
  rounds: ["System design"],
  scenarioId: "news-feed",
};
