// Chapters with content, keyed by "book/slug". Each loads its MDX on demand.
export const chapterLoaders: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  "dsa/sliding-window": () => import("./sliding-window.mdx"),
};
