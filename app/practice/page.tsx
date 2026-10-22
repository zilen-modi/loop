import TopBar from "@/components/ui/TopBar";
import Practice from "@/components/practice/Practice";

export const metadata = { title: "Practice" };

export default function PracticePage() {
  return (
    <>
      <TopBar />
      <main className="wrap" style={{ padding: "28px 20px 80px" }}>
        <h1 style={{ fontFamily: "var(--serif)", fontWeight: 500, fontSize: 28, margin: "0 0 4px" }}>Practice</h1>
        <p style={{ color: "var(--ink-2)", margin: "0 0 24px" }}>Short daily practice beats long cramming. Re-solve what&apos;s due, mix patterns, and review your cards.</p>
        <Practice />
      </main>
    </>
  );
}
