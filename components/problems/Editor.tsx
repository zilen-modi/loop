"use client";

import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { Compartment, EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { tags as t } from "@lezer/highlight";
import type { Lang } from "@/content/problem-types";

// Colours come from the theme tokens, so the editor matches Paper, Sepia, Night and High contrast.
const theme = EditorView.theme({
  "&": { backgroundColor: "var(--page)", color: "var(--ink)", height: "100%" },
  ".cm-content": { caretColor: "var(--ink)", padding: "10px 0" },
  ".cm-gutters": { backgroundColor: "var(--page-2)", color: "var(--ink-3)", border: "none" },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--accent) 6%, transparent)" },
  ".cm-activeLineGutter": { backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--ink-2)" },
  "&.cm-focused .cm-cursor": { borderLeftColor: "var(--ink)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": { backgroundColor: "var(--hl) !important" },
  ".cm-matchingBracket": { backgroundColor: "var(--accent-soft)", outline: "none" },
  "&.cm-focused": { outline: "none" },
});

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword], color: "var(--hue-violet)" },
  { tag: [t.number, t.bool, t.null], color: "var(--hue-amber)" },
  { tag: [t.string, t.special(t.string)], color: "var(--hue-teal)" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--ink-3)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName))], color: "var(--hue-blue)" },
  { tag: [t.operator, t.punctuation, t.bracket], color: "var(--ink-2)" },
]);

export default function Editor({ value, lang, onChange, label }: { value: string; lang: Lang; onChange: (v: string) => void; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const language = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          language.current.of(lang === "js" ? javascript() : python()),
          theme,
          syntaxHighlighting(highlight),
          EditorView.contentAttributes.of({ "aria-label": label }),
          EditorView.updateListener.of((u) => u.docChanged && onChangeRef.current(u.state.doc.toString())),
        ],
      }),
    });
    view.current = v;
    return () => v.destroy();
    // The editor is created once; language and value changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    view.current?.dispatch({ effects: language.current.reconfigure(lang === "js" ? javascript() : python()) });
  }, [lang]);

  // Replace the document when the caller switches problem or language.
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  return <div ref={host} className="editor-host" />;
}
