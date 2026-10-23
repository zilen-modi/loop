import type { DesignProblem } from "@/content/problem-types";

export const ticketBookingProblem: DesignProblem = {
  kind: "design",
  id: "ticket-booking",
  chapter: "ticket-booking",
  n: 1,
  title: "Tiffin Fest: 80,000 passes, a million fans",
  level: "Hard",
  shape: "Waiting room, atomic holds, expiry",
  rounds: ["System design"],
  scenarioId: "ticket-booking",
};
