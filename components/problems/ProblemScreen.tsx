"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { problemById } from "@/content/problems";
import { applyTheme, settings } from "@/lib/settings";
import Workbench, { type BenchMode } from "./Workbench";
import BugHunt from "./BugHunt";
import { nextInQueue } from "@/lib/practice-queue";

function Screen({ id }: { id: string }) {
  const search = useSearchParams();
  const theme = settings.use().theme;
  useEffect(() => applyTheme(theme), [theme]);
  const p = problemById(id)!;
  const from = search.get("from") || "/problems";
  const mode = (search.get("mode") as BenchMode) || "normal";
  const next = mode === "mixed" ? nextInQueue(id) : undefined;

  if (p.kind === "bug-hunt") {
    const ref = problemById(p.referenceProblemId);
    if (!ref || ref.kind !== "code") return null;
    return <BugHunt key={id} problem={p} reference={ref} from={from} />;
  }
  return <Workbench key={id} problem={p} from={from} mode={mode} next={next} />;
}

export default function ProblemScreen({ id }: { id: string }) {
  return (
    <Suspense>
      <Screen id={id} />
    </Suspense>
  );
}
