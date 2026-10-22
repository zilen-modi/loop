import { ChapterHead, PageBreak, ProblemLink, Sources, Story, Term } from "./basics";
import Checkpoint from "./Checkpoint";
import WindowExplorer from "./WindowExplorer";
import ScaleRace from "./ScaleRace";
import ProblemLadder from "./ProblemLadder";
import { ExplainBack, Recap } from "./Reflect";
import { CacheMath, Estimator, FanoutCost, GatewayCounts, RetryLab, RoundTimeline, SplitCalculator, StampedeLab, StepTable } from "./DesignFigures";
import { BookLadder, EvictionLab, ParkingBoard, ScanLift, SeatRace, TokenBucketLab, TransactionLab, VendingStateLab } from "./LldFigures";

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
  RoundTimeline,
  SplitCalculator,
  Estimator,
  CacheMath,
  StepTable,
  StampedeLab,
  GatewayCounts,
  RetryLab,
  FanoutCost,
  ParkingBoard,
  EvictionLab,
  TokenBucketLab,
  TransactionLab,
  VendingStateLab,
  SeatRace,
  ScanLift,
  BookLadder,
};
