import TopBar from "@/components/ui/TopBar";
import TopQuestions from "@/components/top/TopQuestions";

export const metadata = { title: "Top questions" };

export default function TopPage() {
  return (
    <>
      <TopBar />
      <main className="wrap" style={{ padding: "28px 20px 80px" }}>
        <h1 style={{ fontFamily: "var(--serif)", fontWeight: 500, fontSize: 28, margin: "0 0 4px" }}>Top questions</h1>
        <p style={{ color: "var(--ink-2)", margin: "0 0 22px" }}>The questions that come up again and again, in coding, low-level design, system design and behavioral rounds.</p>
        <TopQuestions />
      </main>
    </>
  );
}
