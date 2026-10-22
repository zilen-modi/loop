// Chapters with content, keyed by "book/slug". Each loads its MDX on demand.
export const chapterLoaders: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  "dsa/sliding-window": () => import("./sliding-window.mdx"),
  "lld/machine-coding-playbook": () => import("./machine-coding-playbook.mdx"),
  "lld/splitwise": () => import("./splitwise.mdx"),
  "hld/interview-framework": () => import("./interview-framework.mdx"),
  "hld/url-shortener": () => import("./url-shortener.mdx"),
};
