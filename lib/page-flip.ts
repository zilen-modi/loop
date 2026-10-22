// A book-like page turn on top of the column-paginated article.
//
// The real article jumps straight to its new position; the turn itself is drawn by a short-lived
// overlay built from visual copies of the article, each clipped to one page:
//   - two-page spread: the outgoing right page (its back is the incoming left page) rotates
//     around the spine onto the left, while the old left page stays put until it's covered;
//   - one page: the outgoing page folds away over its left edge (or the previous page folds
//     back in when going backwards).
// The overlay is aria-hidden and ignores the pointer; it's removed when the turn ends.

export type FlipGeometry = { colW: number; gap: number; perView: number; pageH: number };

export type FlipHandle = { finish: () => void };

const DURATION = 620;
const EASING = "cubic-bezier(0.45, 0.05, 0.25, 1)";

/** A copy of the article clipped to one column, so it looks like that single printed page. */
function pageCopy(article: HTMLElement, column: number, g: FlipGeometry): HTMLElement {
  const clip = document.createElement("div");
  clip.className = "leaf-page";
  clip.style.width = `${g.colW}px`;
  clip.style.height = `${g.pageH}px`;
  const copy = article.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  copy.removeAttribute("aria-label");
  copy.classList.add("no-anim");
  copy.style.transform = `translateX(${-column * (g.colW + g.gap)}px)`;
  clip.appendChild(copy);
  return clip;
}

function blankBack(g: FlipGeometry) {
  const b = document.createElement("div");
  b.className = "leaf-page leaf-blank";
  b.style.width = `${g.colW}px`;
  b.style.height = `${g.pageH}px`;
  return b;
}

/**
 * Animates a turn from page `from` to page `to` (adjacent pages). `commit` moves the real article
 * to `to`; it's called at the start when the incoming page is hidden underneath the turning leaf,
 * or at the end when the leaf itself is the incoming page (one-page mode, going back).
 */
export function turnPage(layer: HTMLElement, article: HTMLElement, g: FlipGeometry, from: number, to: number, commit: () => void): FlipHandle {
  const forward = to > from;
  const step = g.colW + g.gap;
  const spread = g.perView === 2;
  const parts: HTMLElement[] = [];

  const leaf = document.createElement("div");
  leaf.className = "leaf";
  leaf.style.width = `${g.colW}px`;
  leaf.style.height = `${g.pageH}px`;
  const shade = document.createElement("div");
  shade.className = forward ? "leaf-shade" : "leaf-shade back";

  let keyframes: Keyframe[];
  let commitAtStart = true;

  if (spread) {
    // Columns on screen: left = 2p, right = 2p + 1.
    if (forward) {
      parts.push(pageCopy(article, from * 2, g));
      parts[0].style.left = "0px";
      leaf.style.left = `${step}px`;
      leaf.style.transformOrigin = `${-g.gap / 2}px 50%`;
      leaf.append(pageCopy(article, from * 2 + 1, g), backFace(pageCopy(article, to * 2, g)));
      keyframes = [{ transform: "rotateY(0deg)" }, { transform: "rotateY(-180deg)" }];
    } else {
      parts.push(pageCopy(article, from * 2 + 1, g));
      parts[0].style.left = `${step}px`;
      leaf.style.left = "0px";
      leaf.style.transformOrigin = `${g.colW + g.gap / 2}px 50%`;
      leaf.append(pageCopy(article, from * 2, g), backFace(pageCopy(article, to * 2 + 1, g)));
      keyframes = [{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }];
    }
  } else {
    leaf.style.left = "0px";
    leaf.style.transformOrigin = "0px 50%";
    if (forward) {
      leaf.append(pageCopy(article, from, g), backFace(blankBack(g)));
      keyframes = [{ transform: "rotateY(0deg)" }, { transform: "rotateY(-180deg)" }];
    } else {
      // The previous page folds back in over the current one; the article moves when it lands.
      leaf.append(pageCopy(article, to, g), backFace(blankBack(g)));
      keyframes = [{ transform: "rotateY(-180deg)" }, { transform: "rotateY(0deg)" }];
      commitAtStart = false;
    }
  }

  parts.forEach((p) => {
    p.style.position = "absolute";
    p.style.top = "0px";
  });
  leaf.firstElementChild?.appendChild(shade);
  layer.append(...parts, leaf);
  if (commitAtStart) commit();

  const turn = leaf.animate(keyframes, { duration: DURATION, easing: EASING, fill: "forwards" });
  // The page darkens as it curves away from the light, then clears as it lands.
  shade.animate([{ opacity: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], { duration: DURATION, easing: "ease-in-out", fill: "forwards" });

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    if (!commitAtStart) commit();
    leaf.remove();
    parts.forEach((p) => p.remove());
  };
  turn.onfinish = cleanup;
  turn.oncancel = cleanup;
  return {
    finish: () => {
      turn.finish();
      cleanup();
    },
  };
}

function backFace(el: HTMLElement) {
  el.classList.add("leaf-back");
  return el;
}
