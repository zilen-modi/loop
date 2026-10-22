import type { MDXComponents } from "mdx/types";
import { chapterComponents } from "@/components/chapter/mdx";

// Every MDX chapter can use the interactive pieces without importing them.
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...chapterComponents, ...components };
}
