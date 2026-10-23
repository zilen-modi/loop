"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Repeat, Shuffle, Timer } from "lucide-react";
import { problems, problemById } from "@/content/problems";
import { cards, gradeCard, problemsProgress, type Card } from "@/lib/progress";
import { startQueue } from "@/lib/practice-queue";
import { useMounted } from "@/lib/use-mounted";

const DAY = 86_400_000;

export default function Practice() {
  const router = useRouter();
  const mounted = useMounted();
  const progress = problemsProgress.use();
  const allCards = cards.use();
  const now = Date.now();

  const due = mounted ? Object.entries(progress).filter(([, s]) => s.due && s.due <= now).map(([id]) => problemById(id)).filter(Boolean) : [];
  const upcoming = mounted ? Object.entries(progress).filter(([, s]) => s.due && s.due > now).sort((a, b) => a[1].due! - b[1].due!) : [];
  const dueCards = mounted ? Object.values(allCards).filter((c) => c.due <= now).sort((a, b) => a.due - b.due) : [];
  const codeProblems = problems.filter((p) => p.kind === "code");

  function startMixed() {
    const q = startQueue(codeProblems.map((p) => p.id));
    router.push(`/problems/${q[0]}?mode=mixed&from=${encodeURIComponent("/practice")}`);
  }

  function startTimed() {
    const pool = codeProblems.filter((p) => p.level !== "Easy" && progress[p.id]?.status !== "solved");
    const pick = (pool.length ? pool : codeProblems)[Math.floor(Math.random() * (pool.length || codeProblems.length))];
    router.push(`/problems/${pick.id}?mode=timed&from=${encodeURIComponent("/practice")}`);
  }

  const tile = (icon: React.ReactNode, title: string, body: string, action: React.ReactNode) => (
    <div className="card" style={{ padding: "16px 18px", display: "grid", gap: 8, alignContent: "start" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 500 }}>{icon}{title}</span>
      <span style={{ color: "var(--ink-2)", fontSize: 14, lineHeight: 1.55 }}>{body}</span>
      <span>{action}</span>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 32 }}>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 12 }}>
        {tile(<Repeat size={16} />, "Re-solve", due.length ? `${due.length} problem${due.length === 1 ? " is" : "s are"} due. Solving again from memory is what makes a pattern stick.` : "Problems you solve come back after 1, 3, 7 and 21 days, sooner if you needed help.", due[0] ? <Link className="btn small primary" href={`/problems/${due[0]!.id}?from=${encodeURIComponent("/practice")}`}>Start</Link> : <span style={{ color: "var(--ink-3)", fontSize: 13 }}>Nothing due</span>)}
        {tile(<Shuffle size={16} />, "Mixed set", "Problems in random order with their titles and patterns hidden, so you practise recognising the pattern yourself.", <button className="btn small" onClick={startMixed}>Start a mixed set</button>)}
        {tile(<Timer size={16} />, "Timed round", "One medium or hard problem on the clock, no hints until you pass or time runs out. Like the real thing.", <button className="btn small" onClick={startTimed}>Start the clock</button>)}
      </section>

      {upcoming.length > 0 && (
        <section>
          <h2 className="kicker" style={{ margin: "0 0 8px" }}>Coming up</h2>
          <div className="card">
            {upcoming.map(([id, s], i) => (
              <div key={id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", borderTop: i ? "1px solid var(--rule)" : undefined, fontSize: 14 }}>
                <span>{problemById(id)?.title}</span>
                <span style={{ color: "var(--ink-3)" }}>in {Math.max(1, Math.round((s.due! - now) / DAY))} day{Math.round((s.due! - now) / DAY) === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="cards-title">
        <h2 id="cards-title" className="kicker" style={{ margin: "0 0 8px" }}>Review cards · {dueCards.length} due</h2>
        {dueCards.length ? (
          <CardReview key={dueCards[0].id} card={dueCards[0]} left={dueCards.length} />
        ) : (
          <p style={{ color: "var(--ink-2)", fontSize: 14 }}>
            No cards due. Highlights you make while reading and chapter recap cards land here the next day.
          </p>
        )}
      </section>
    </div>
  );
}

function CardReview({ card, left }: { card: Card; left: number }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="card" style={{ padding: "22px 24px", maxWidth: 640 }}>
      <p className="kicker" style={{ margin: "0 0 10px" }}>{card.source} · {left} left</p>
      <p style={{ fontFamily: "var(--serif)", fontSize: 19, lineHeight: 1.55, margin: "0 0 16px", whiteSpace: "pre-wrap" }}>{card.front}</p>
      {shown && <p style={{ fontFamily: "var(--serif)", fontSize: 16.5, lineHeight: 1.6, margin: "0 0 16px", color: "var(--ink-2)", borderTop: "1px solid var(--rule)", paddingTop: 14, whiteSpace: "pre-wrap" }}>{card.back}</p>}
      {!shown ? (
        <button className="btn primary" onClick={() => setShown(true)} autoFocus>Show answer</button>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="group" aria-label="How well did you remember?">
          <button className="btn" onClick={() => gradeCard(card.id, "again")}>Forgot · again soon</button>
          <button className="btn primary" onClick={() => gradeCard(card.id, "good")} autoFocus>Remembered</button>
          <button className="btn" onClick={() => gradeCard(card.id, "easy")}>Easy</button>
        </div>
      )}
    </div>
  );
}
