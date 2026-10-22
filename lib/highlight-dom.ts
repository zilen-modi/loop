// DOM helpers for highlights. A highlight is stored as character offsets inside one top-level
// block of the chapter, so it survives re-pagination, font changes and reloads.

const TEXT_BLOCKS = "p, ul, ol, h1, h2, h3, blockquote, .story";

export const isTextBlock = (el: Element) => el.matches(TEXT_BLOCKS);

function textNodes(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text);
  return out;
}

/** Character offset of (node, offset) within block's text. */
export function offsetIn(block: Element, node: Node, offset: number): number {
  if (node.nodeType !== Node.TEXT_NODE) {
    // Selection boundary between elements: count text before the child at `offset`.
    const child = node.childNodes[offset];
    let total = 0;
    for (const t of textNodes(block)) {
      if (child && (child === t || child.contains(t) || child.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING)) break;
      total += t.length;
    }
    return total;
  }
  let total = 0;
  for (const t of textNodes(block)) {
    if (t === node) return total + offset;
    total += t.length;
  }
  return total;
}

/** Removes every highlight mark, restoring plain text. */
export function clearMarks(root: Element) {
  root.querySelectorAll("mark[data-hl]").forEach((m) => {
    const parent = m.parentNode!;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    parent.normalize();
  });
}

/** Wraps [start, end) of block's text in <mark data-hl=id>. */
export function wrapRange(block: Element, start: number, end: number, id: string, hasNote: boolean) {
  let pos = 0;
  for (const t of textNodes(block)) {
    const len = t.length;
    const s = Math.max(start - pos, 0);
    const e = Math.min(end - pos, len);
    pos += len;
    if (e <= s) continue;
    if (t.parentElement?.closest("mark[data-hl]")) continue;
    let target = t;
    if (s > 0) target = target.splitText(s);
    if (e - s < target.length) target.splitText(e - s);
    const mark = document.createElement("mark");
    mark.dataset.hl = id;
    if (hasNote) mark.className = "has-note";
    target.parentNode!.insertBefore(mark, target);
    mark.appendChild(target);
    if (pos >= end) break;
  }
}
