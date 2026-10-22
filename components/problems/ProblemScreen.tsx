"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { problemById } from "@/content/problems";
import { applyTheme, settings } from "@/lib/settings";
import type { BenchMode } from "./Workbench";
import { nextInQueue } from "@/lib/practice-queue";

// Each screen loads on demand: the editor (CodeMirror) and the design canvas (React Flow) are only
// needed by the problem kinds that use them.
const loading = () => <div className="bench" />;
const Workbench = dynamic(() => import("./Workbench"), { loading });
const BugHunt = dynamic(() => import("./BugHunt"), { loading });
const BuildBench = dynamic(() => import("./BuildBench"), { loading });
const DesignLab = dynamic(() => import("./DesignLab"), { loading });

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
