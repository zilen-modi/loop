import TopBar from "@/components/ui/TopBar";
import ProblemList from "@/components/problems/ProblemList";

export const metadata = { title: "Problems" };

export default function ProblemsPage() {
  return (
    <>
      <TopBar />
      <main className="wrap" style={{ padding: "28px 20px 80px" }}>
        <h1 style={{ fontFamily: "var(--serif)", fontWeight: 500, fontSize: 28, margin: "0 0 4px" }}>Problems</h1>
        <p style={{ color: "var(--ink-2)", margin: "0 0 20px" }}>Every chapter ends with a ladder of problems, from easy to hard. They&apos;re all here too.</p>
        <ProblemList />
      </main>
    </>
  );
}
