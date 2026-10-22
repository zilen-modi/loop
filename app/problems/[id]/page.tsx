import { notFound } from "next/navigation";
import { problems, problemById } from "@/content/problems";
import ProblemScreen from "@/components/problems/ProblemScreen";

export function generateStaticParams() {
  return problems.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: problemById(id)?.title ?? "Problem" };
}

export default async function ProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!problemById(id)) notFound();
  return <ProblemScreen id={id} />;
}
