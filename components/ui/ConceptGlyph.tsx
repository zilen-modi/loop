import { ArrowLeftRight, Boxes, Brackets, Calculator, Database, Expand, Gauge, Hash, Layers, Link2, ListOrdered, MoveHorizontal, Recycle, Split, SquareParking, Timer, Undo2, DoorOpen, Workflow, Ticket, ArrowUpDown } from "lucide-react";
import type { Concept } from "@/content/concepts";

const icons = { Brackets, MoveHorizontal, Expand, ListOrdered, Gauge, Hash, ArrowLeftRight, Layers, Timer, Split, Boxes, Calculator, Database, Link2, SquareParking, Recycle, Undo2, DoorOpen, Workflow, Ticket, ArrowUpDown };

/** A concept's signature: the same colour and glyph everywhere it appears. */
export default function ConceptGlyph({ concept, size = 28 }: { concept: Pick<Concept, "glyph" | "hue">; size?: number }) {
  const Icon = icons[concept.glyph];
  const color = `var(--hue-${concept.hue})`;
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        display: "inline-grid",
        placeItems: "center",
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        flexShrink: 0,
      }}
    >
      <Icon size={size * 0.56} strokeWidth={2} />
    </span>
  );
}
