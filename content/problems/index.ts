import type { CodeProblem, Problem } from "@/content/problem-types";
import { busiestStretch } from "./sliding-window/busiest-stretch";
import { riderBonus } from "./sliding-window/rider-bonus";
import { uniqueDishes } from "./sliding-window/unique-dishes";
import { surgeZones } from "./sliding-window/surge-zones";
import { coverMenu } from "./sliding-window/cover-menu";
import { peakLoad } from "./sliding-window/peak-load";
import { reviewCalmStretch } from "./sliding-window/review-calm-stretch";

export const problems: Problem[] = [busiestStretch, riderBonus, uniqueDishes, surgeZones, coverMenu, peakLoad, reviewCalmStretch];

export const problemById = (id: string) => problems.find((p) => p.id === id);
export const codeProblemById = (id: string) => problems.find((p): p is CodeProblem => p.id === id && p.kind === "code");
export const problemsForChapter = (chapter: string) => problems.filter((p) => p.chapter === chapter).sort((a, b) => a.n - b.n);
