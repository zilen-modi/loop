import { notFound } from "next/navigation";
import Reader from "@/components/reader/Reader";
import { chapterLoaders } from "@/content/chapters";
import { books, findChapter } from "@/content/syllabus";

export function generateStaticParams() {
  return books.flatMap((b) => b.parts.flatMap((p) => p.chapters.filter((c) => c.available && c.slug).map((c) => ({ book: b.id, chapter: c.slug! }))));
}

export async function generateMetadata({ params }: { params: Promise<{ book: string; chapter: string }> }) {
  const { book, chapter } = await params;
  const found = findChapter(book, chapter);
  return { title: found ? found.chapter.title : "Chapter" };
}

export default async function ChapterPage({ params }: { params: Promise<{ book: string; chapter: string }> }) {
  const { book, chapter } = await params;
  const found = findChapter(book, chapter);
  const load = chapterLoaders[`${book}/${chapter}`];
  if (!found || !load) notFound();
  const { default: Content } = await load();
  return (
    <Reader chapterKey={`${book}/${chapter}`} title={found.chapter.title} bookTitle={found.book.title} chapterLabel={`Chapter ${found.chapter.n}`}>
      <Content />
    </Reader>
  );
}
