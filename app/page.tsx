import TopBar from "@/components/ui/TopBar";
import Library from "@/components/library/Library";

export default function Home() {
  return (
    <>
      <TopBar />
      <main className="wrap" style={{ padding: "28px 20px 80px" }}>
        <Library />
      </main>
    </>
  );
}
