"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { problemById } from "@/content/problems";
import { applyTheme, settings } from "@/lib/settings";
import Workbench, { type BenchMode } from "./Workbench";
import BugHunt from "./BugHunt";
import BuildBench from "./BuildBench";
import { nextInQueue } from "@/lib/practice-queue";

// The design canvas (React Flow) is only needed for design labs, so it loads on demand.
const DesignLab = dynamic(() => import("./DesignLab"), { loading: () => <div className="bench" /> });

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
  if (p.kind === "build") return <BuildBench key={id} problem={p} from={from} />;
  if (p.kind === "design") return <DesignLab key={id} problem={p} from={from} />;
  return <Workbench key={id} problem={p} from={from} mode={mode} next={next} />;
}

export default function ProblemScreen({ id }: { id: string }) {
  return (
    <Suspense>
      <Screen id={id} />
    </Suspense>
  );
}
