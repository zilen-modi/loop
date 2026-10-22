import { ChapterHead, PageBreak, ProblemLink, Sources, Story, Term } from "./basics";
import Checkpoint from "./Checkpoint";
import WindowExplorer from "./WindowExplorer";
import ScaleRace from "./ScaleRace";
import ProblemLadder from "./ProblemLadder";
import { ExplainBack, Recap } from "./Reflect";

// Everything an MDX chapter can use without importing it.
export const chapterComponents = {
  ChapterHead,
  Story,
  Term,
  PageBreak,
  Sources,
  ProblemLink,
  Checkpoint,
  WindowExplorer,
  ScaleRace,
  ProblemLadder,
  ExplainBack,
  Recap,
};
