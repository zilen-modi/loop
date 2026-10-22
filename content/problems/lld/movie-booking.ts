import { randInt, type BuildProblem, type Rand, type Step } from "@/content/problem-types";

const HOLD_MS = 10 * 60 * 1000;
const CUTOFF_MS = 2 * 60 * 60 * 1000;

/**
 * A blockbuster's opening: users racing for seats, holds expiring, some payments too late.
 * The generator keeps a rough model of the seats so most requests are plausible; the expected
 * results still come from the reference solution, not from this model.
 */
function openingNight(r: Rand, users: number, ops: number, withExtension: boolean): Step[] {
  const shows = { S1: { rows: 26, per: 30, startsAt: 50 * 3_600_000 }, S2: { rows: 20, per: 30, startsAt: 54 * 3_600_000 } };
  const steps: Step[] = Object.entries(shows).map(([id, sh]) => ({ call: "addShow", args: [id, sh.rows, sh.per, sh.startsAt] }));
  const ROWS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const taken = new Map<string, number>(); // "S1:D5" → hold number, or -1 when booked
  const holds = new Map<number, { show: string; seats: string[]; until: number; state: "live" | "done" }>();
  const bookings: { n: number; show: string; seats: string[]; cancelled: boolean }[] = [];
  let t = 0;
  let nextHold = 1;
  let nextBooking = 1;
  const free = (show: string, seat: string) => {
    const v = taken.get(`${show}:${seat}`);
    if (v === undefined) return true;
    if (v === -1) return false;
    const h = holds.get(v)!;
    return h.state !== "live" || t >= h.until;
  };
  const take = (show: string, seats: string[]) => {
    const n = nextHold++;
    holds.set(n, { show, seats, until: t + HOLD_MS, state: "live" });
    seats.forEach((x) => taken.set(`${show}:${x}`, n));
    return n;
  };
  for (let i = 0; i < ops; i++) {
    t += randInt(r, 0, 15_000);
    const user = `u${randInt(r, 1, users)}`;
    const show = r() < 0.7 ? "S1" : "S2";
    const sh = shows[show as "S1" | "S2"];
    const roll = r();
    if (roll < 0.42) {
      // pick a row near the middle; usually a free block, sometimes seats someone else just took
      const want = Math.max(0, Math.min(sh.rows - 1, Math.round(sh.rows / 2 + (r() - 0.5) * sh.rows * 0.8)));
      const n = randInt(r, 1, 4);
      let row = ROWS[want];
      let start = randInt(r, 1, sh.per - n + 1);
      if (r() < 0.8) {
        // the nearest row to the one they wanted with a free block (most people look around)
        const rows = [...Array(sh.rows).keys()].sort((a, b) => Math.abs(a - want) - Math.abs(b - want));
        search: for (const ri of rows)
          for (let k = 1; k <= sh.per - n + 1; k++)
            if (Array.from({ length: n }, (_, j) => `${ROWS[ri]}${k + j}`).every((x) => free(show, x))) {
              row = ROWS[ri];
              start = k;
              break search;
            }
      }
      const seats = Array.from({ length: n }, (_, j) => `${row}${start + j}`);
      steps.push({ call: "hold", args: [show, user, seats, t] });
      if (seats.every((x) => free(show, x))) take(show, seats);
    } else if (roll < 0.7) {
      const live = [...holds.entries()].filter(([, h]) => h.state === "live" && t < h.until);
      if (!live.length) continue;
      const [n, h] = live[randInt(r, 0, live.length - 1)];
      if (r() < 0.12) t += HOLD_MS; // paid too slowly
      steps.push({ call: "confirm", args: [`H${n}`, t] });
      if (t < h.until) {
        h.state = "done";
        h.seats.forEach((x) => taken.set(`${h.show}:${x}`, -1));
        bookings.push({ n: nextBooking++, show: h.show, seats: h.seats, cancelled: false });
      }
    } else if (roll < 0.78) {
      const live = [...holds.entries()].filter(([, h]) => h.state === "live");
      if (!live.length) continue;
      const [n, h] = live[randInt(r, 0, live.length - 1)];
      steps.push({ call: "release", args: [`H${n}`] });
      h.state = "done";
    } else if (roll < 0.85) {
      steps.push({ call: "available", args: [show, t] });
    } else if (withExtension && roll < 0.92) {
      const n = randInt(r, 1, 6);
      steps.push({ call: "holdBest", args: [show, user, n, t] });
      const middle = Math.floor(sh.rows / 2);
      const order = [...Array(sh.rows).keys()].sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle) || a - b);
      search: for (const ri of order) {
        let run: string[] = [];
        for (let k = 1; k <= sh.per; k++) {
          const id = ROWS[ri] + k;
          run = free(show, id) ? [...run, id] : [];
          if (run.length === n) {
            take(show, run);
            break search;
          }
        }
      }
    } else if (withExtension && roll < 0.96 && bookings.length) {
      const b = bookings[randInt(r, 0, bookings.length - 1)];
      steps.push({ call: "cancel", args: [`B${b.n}`, t] });
      if (!b.cancelled && t <= shows[b.show as "S1" | "S2"].startsAt - CUTOFF_MS) {
        b.cancelled = true;
        b.seats.forEach((x) => taken.delete(`${b.show}:${x}`));
      }
    } else {
      steps.push({ call: "seatMap", args: [show, t] });
    }
  }
  return steps;
}

export const movieBooking: BuildProblem = {
  kind: "build",
  id: "movie-booking",
  chapter: "movie-booking",
  n: 1,
  title: "Seats for the opening night",
  level: "Hard",
  shape: "Machine coding · holds, expiry and races",
  rounds: ["Machine coding"],
  minutes: 90,
  statement: `Tiffin runs a cinema-and-dinner offer, and the opening night of a blockbuster sells out in minutes. Build \`ShowBooking\`: users **hold** seats for ten minutes while they pay, then **confirm**. Two people must never get the same seat, and seats from abandoned holds have to come back.

Every call that depends on time takes it in milliseconds. Calls arrive one at a time in the order given, which is how the tests stage races: two users holding the same seat at the same millisecond means the first call wins.

After the core passes, the interviewer adds two requirements, just as in a real round.`,
  requirements: {
    core: [
      "Add shows with rows and seats.",
      "Hold a set of seats for a user, all or nothing, for 10 minutes.",
      "Confirm a hold into a booking before it expires; release a hold early.",
      "Report free seats and a seat map, with expired holds counted as free.",
      "Reject invalid actions with an error and change nothing.",
    ],
    extension: ["Cancel a booking, up to 2 hours before the show.", "Hold the best block of n seats together: the row nearest the middle, leftmost first."],
  },
  api: [
    { js: "addShow(show, rows, perRow, startsAt)", py: "add_show(show, rows, per_row, starts_at)", does: "Rows are lettered from A (front), seats numbered from 1: A1, A2, … startsAt is in ms.", stage: "core" },
    { js: "hold(show, user, seats, time)", py: "hold(show, user, seats, time)", does: "Holds all the seats (e.g. [\"D5\", \"D6\"]) until time + 10 minutes. Returns \"H1\", \"H2\", …", stage: "core" },
    { js: "confirm(hold, time)", py: "confirm(hold, time)", does: "Books the held seats if the hold hasn't expired. Returns \"B1\", \"B2\", …", stage: "core" },
    { js: "release(hold)", py: "release(hold)", does: "Gives up a hold that hasn't been confirmed. Returns true, or false if it had already expired or been released.", stage: "core" },
    { js: "available(show, time)", py: "available(show, time)", does: "How many seats are free (neither booked nor held by a live hold).", stage: "core" },
    { js: "seatMap(show, time)", py: "seat_map(show, time)", does: "One string per row, front first: \".\" free, \"h\" held, \"x\" booked.", stage: "core" },
    { js: "cancel(booking, time)", py: "cancel(booking, time)", does: "Frees a booking's seats, if time is at least 2 hours before the show.", stage: "extension" },
    { js: "holdBest(show, user, n, time)", py: "hold_best(show, user, n, time)", does: "Holds n free seats side by side; returns [hold, seats].", stage: "extension" },
  ],
  rules: [
    "A hold made at time t is live while time < t + 600,000 (10 minutes). After that its seats are free again, whether or not anyone calls release.",
    "hold is all or nothing: if any seat is unknown, booked, held by a live hold, or listed twice, nothing is held and it's an error.",
    "Holds and bookings are numbered H1, H2, … and B1, B2, … for successful calls only.",
    "confirm fails (an error) if the hold is unknown, released, already confirmed, or expired at that time.",
    "Times never go backwards across calls that take a time; an earlier time is an error.",
    "Errors (JavaScript: throw an Error; Python: raise ValueError), changing nothing: unknown shows, seats, holds or bookings; bad counts; the cases above.",
    "Cancel (extension): allowed while time ≤ startsAt − 2 hours; the seats become free. A cancelled booking can't be cancelled again.",
    "Best seats (extension): rows are tried in order of distance from the middle row (rows ÷ 2, rounded down, counting from 0), nearer first, front row first on ties; in each row, the leftmost run of n free seats wins.",
  ],
  className: "ShowBooking",
  starter: {
    js: `class ShowBooking {
  constructor() {
    // your state here
  }

  addShow(show, rows, perRow, startsAt) {}

  hold(show, user, seats, time) {
    return "H?";
  }

  confirm(hold, time) {
    return "B?";
  }

  release(hold) {
    return false;
  }

  available(show, time) {
    return 0;
  }

  seatMap(show, time) {
    return [];
  }

  // The interviewer adds more once the core works
}
`,
    py: `class ShowBooking:
    def __init__(self):
        pass  # your state here

    def add_show(self, show, rows, per_row, starts_at):
        pass

    def hold(self, show, user, seats, time):
        return "H?"

    def confirm(self, hold, time):
        return "B?"

    def release(self, hold):
        return False

    def available(self, show, time):
        return 0

    def seat_map(self, show, time):
        return []

    # The interviewer adds more once the core works
`,
  },
  solution: {
    js: `// Seats remember which hold or booking has them; holds remember when they expire. A seat is
// free if it has no booking and its hold has expired or ended, so expiry needs no timers.
const HOLD_MS = 10 * 60 * 1000;
const CUTOFF_MS = 2 * 60 * 60 * 1000;
const ROWS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

class ShowBooking {
  constructor() {
    this.shows = new Map(); // show → { rows, perRow, startsAt, seats: Map(seat → { hold, booking }) }
    this.holds = new Map(); // hold → { show, user, seats, expiresAt, state: "live" | "released" | "confirmed" }
    this.bookings = new Map(); // booking → { show, seats, cancelled }
    this.nextHold = 1;
    this.nextBooking = 1;
    this.now = 0;
  }

  addShow(show, rows, perRow, startsAt) {
    if (typeof show !== "string" || !show || this.shows.has(show)) throw new Error("Show ids are new, non-empty strings");
    if (!whole(rows, 1) || rows > ROWS.length || !whole(perRow, 1) || perRow > 99 || !whole(startsAt, 0)) throw new Error("Bad show size or time");
    const seats = new Map();
    for (let r = 0; r < rows; r++) for (let n = 1; n <= perRow; n++) seats.set(ROWS[r] + n, { hold: null, booking: null });
    this.shows.set(show, { rows, perRow, startsAt, seats });
  }

  hold(show, user, seats, time) {
    this.tick(time);
    const s = this.show(show);
    if (typeof user !== "string" || !user) throw new Error("Bad user");
    if (!Array.isArray(seats) || !seats.length || new Set(seats).size !== seats.length) throw new Error("List each seat once");
    for (const id of seats) if (!s.seats.has(id) || !this.free(s.seats.get(id), time)) throw new Error(\`Seat \${id} isn't available\`);
    return this.place(s, show, user, seats, time);
  }

  confirm(hold, time) {
    this.tick(time);
    const h = this.holds.get(hold);
    if (!h || h.state !== "live" || time >= h.expiresAt) throw new Error("That hold can't be confirmed");
    const booking = \`B\${this.nextBooking++}\`;
    const s = this.shows.get(h.show);
    for (const id of h.seats) Object.assign(s.seats.get(id), { hold: null, booking });
    h.state = "confirmed";
    this.bookings.set(booking, { show: h.show, seats: h.seats, cancelled: false });
    return booking;
  }

  release(hold) {
    const h = this.holds.get(hold);
    if (!h) throw new Error("Unknown hold");
    if (h.state !== "live" || this.now >= h.expiresAt) return false;
    const s = this.shows.get(h.show);
    for (const id of h.seats) s.seats.get(id).hold = null;
    h.state = "released";
    return true;
  }

  available(show, time) {
    this.tick(time);
    let n = 0;
    for (const seat of this.show(show).seats.values()) if (this.free(seat, time)) n++;
    return n;
  }

  seatMap(show, time) {
    this.tick(time);
    const s = this.show(show);
    const rows = [];
    for (let r = 0; r < s.rows; r++) {
      let line = "";
      for (let n = 1; n <= s.perRow; n++) {
        const seat = s.seats.get(ROWS[r] + n);
        line += seat.booking ? "x" : this.free(seat, time) ? "." : "h";
      }
      rows.push(line);
    }
    return rows;
  }

  // Extension
  cancel(booking, time) {
    this.tick(time);
    const b = this.bookings.get(booking);
    if (!b || b.cancelled) throw new Error("Unknown or cancelled booking");
    const s = this.shows.get(b.show);
    if (time > s.startsAt - CUTOFF_MS) throw new Error("Too close to the show to cancel");
    for (const id of b.seats) s.seats.get(id).booking = null;
    b.cancelled = true;
    return true;
  }

  holdBest(show, user, n, time) {
    this.tick(time);
    const s = this.show(show);
    if (typeof user !== "string" || !user) throw new Error("Bad user");
    if (!whole(n, 1) || n > s.perRow) throw new Error("Bad number of seats");
    const middle = Math.floor(s.rows / 2);
    const order = [...Array(s.rows).keys()].sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle) || a - b);
    for (const r of order) {
      let run = [];
      for (let k = 1; k <= s.perRow; k++) {
        const id = ROWS[r] + k;
        run = this.free(s.seats.get(id), time) ? [...run, id] : [];
        if (run.length === n) return [this.place(s, show, user, run, time), run];
      }
    }
    throw new Error("No block of seats that size is free");
  }

  // ——— helpers
  place(s, show, user, seats, time) {
    const hold = \`H\${this.nextHold++}\`;
    this.holds.set(hold, { show, user, seats, expiresAt: time + HOLD_MS, state: "live" });
    for (const id of seats) s.seats.get(id).hold = hold;
    return hold;
  }

  free(seat, time) {
    if (seat.booking) return false;
    const h = seat.hold && this.holds.get(seat.hold);
    return !h || h.state !== "live" || time >= h.expiresAt;
  }

  show(show) {
    const s = this.shows.get(show);
    if (!s) throw new Error("Unknown show");
    return s;
  }

  tick(time) {
    if (!whole(time, 0) || time < this.now) throw new Error("Time must be whole and never go backwards");
    this.now = time;
  }
}

const whole = (n, min) => Number.isInteger(n) && n >= min;
`,
    py: `# Seats remember which hold or booking has them; holds remember when they expire. A seat is
# free if it has no booking and its hold has expired or ended, so expiry needs no timers.
HOLD_MS = 10 * 60 * 1000
CUTOFF_MS = 2 * 60 * 60 * 1000
ROWS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def whole(n, least):
    return isinstance(n, int) and not isinstance(n, bool) and n >= least


class Seat:
    def __init__(self):
        self.hold = None
        self.booking = None


class ShowBooking:
    def __init__(self):
        self.shows = {}  # show -> dict(rows, per_row, starts_at, seats)
        self.holds = {}  # hold -> dict(show, user, seats, expires_at, state)
        self.bookings = {}  # booking -> dict(show, seats, cancelled)
        self.next_hold = 1
        self.next_booking = 1
        self.now = 0

    def add_show(self, show, rows, per_row, starts_at):
        if not isinstance(show, str) or not show or show in self.shows:
            raise ValueError("Show ids are new, non-empty strings")
        if not whole(rows, 1) or rows > len(ROWS) or not whole(per_row, 1) or per_row > 99 or not whole(starts_at, 0):
            raise ValueError("Bad show size or time")
        seats = {ROWS[r] + str(n): Seat() for r in range(rows) for n in range(1, per_row + 1)}
        self.shows[show] = {"rows": rows, "per_row": per_row, "starts_at": starts_at, "seats": seats}

    def hold(self, show, user, seats, time):
        self._tick(time)
        s = self._show(show)
        if not isinstance(user, str) or not user:
            raise ValueError("Bad user")
        if not isinstance(seats, list) or not seats or len(set(seats)) != len(seats):
            raise ValueError("List each seat once")
        for sid in seats:
            if sid not in s["seats"] or not self._free(s["seats"][sid], time):
                raise ValueError(f"Seat {sid} isn't available")
        return self._place(s, show, user, seats, time)

    def confirm(self, hold, time):
        self._tick(time)
        h = self.holds.get(hold)
        if not h or h["state"] != "live" or time >= h["expires_at"]:
            raise ValueError("That hold can't be confirmed")
        booking = f"B{self.next_booking}"
        self.next_booking += 1
        s = self.shows[h["show"]]
        for sid in h["seats"]:
            s["seats"][sid].hold = None
            s["seats"][sid].booking = booking
        h["state"] = "confirmed"
        self.bookings[booking] = {"show": h["show"], "seats": h["seats"], "cancelled": False}
        return booking

    def release(self, hold):
        h = self.holds.get(hold)
        if not h:
            raise ValueError("Unknown hold")
        if h["state"] != "live" or self.now >= h["expires_at"]:
            return False
        for sid in h["seats"]:
            self.shows[h["show"]]["seats"][sid].hold = None
        h["state"] = "released"
        return True

    def available(self, show, time):
        self._tick(time)
        return sum(1 for seat in self._show(show)["seats"].values() if self._free(seat, time))

    def seat_map(self, show, time):
        self._tick(time)
        s = self._show(show)
        out = []
        for r in range(s["rows"]):
            line = ""
            for n in range(1, s["per_row"] + 1):
                seat = s["seats"][ROWS[r] + str(n)]
                line += "x" if seat.booking else ("." if self._free(seat, time) else "h")
            out.append(line)
        return out

    # Extension
    def cancel(self, booking, time):
        self._tick(time)
        b = self.bookings.get(booking)
        if not b or b["cancelled"]:
            raise ValueError("Unknown or cancelled booking")
        s = self.shows[b["show"]]
        if time > s["starts_at"] - CUTOFF_MS:
            raise ValueError("Too close to the show to cancel")
        for sid in b["seats"]:
            s["seats"][sid].booking = None
        b["cancelled"] = True
        return True

    def hold_best(self, show, user, n, time):
        self._tick(time)
        s = self._show(show)
        if not isinstance(user, str) or not user:
            raise ValueError("Bad user")
        if not whole(n, 1) or n > s["per_row"]:
            raise ValueError("Bad number of seats")
        middle = s["rows"] // 2
        for r in sorted(range(s["rows"]), key=lambda i: (abs(i - middle), i)):
            run = []
            for k in range(1, s["per_row"] + 1):
                sid = ROWS[r] + str(k)
                run = run + [sid] if self._free(s["seats"][sid], time) else []
                if len(run) == n:
                    return [self._place(s, show, user, run, time), run]
        raise ValueError("No block of seats that size is free")

    def _place(self, s, show, user, seats, time):
        hold = f"H{self.next_hold}"
        self.next_hold += 1
        self.holds[hold] = {"show": show, "user": user, "seats": list(seats), "expires_at": time + HOLD_MS, "state": "live"}
        for sid in seats:
            s["seats"][sid].hold = hold
        return hold

    def _free(self, seat, time):
        if seat.booking:
            return False
        h = self.holds.get(seat.hold) if seat.hold else None
        return h is None or h["state"] != "live" or time >= h["expires_at"]

    def _show(self, show):
        if show not in self.shows:
            raise ValueError("Unknown show")
        return self.shows[show]

    def _tick(self, time):
        if not whole(time, 0) or time < self.now:
            raise ValueError("Time must be whole and never go backwards")
        self.now = time
`,
  },
  scenarios: [
    {
      name: "Hold, then confirm",
      stage: "core",
      visible: true,
      steps: [
        { call: "addShow", args: ["S1", 3, 4, 36_000_000] },
        { call: "hold", args: ["S1", "asha", ["B2", "B3"], 0], expect: "H1" },
        { call: "seatMap", args: ["S1", 0], expect: ["....", ".hh.", "...."] },
        { call: "available", args: ["S1", 0], expect: 10 },
        { call: "confirm", args: ["H1", 60_000], expect: "B1" },
        { call: "seatMap", args: ["S1", 60_000], expect: ["....", ".xx.", "...."] },
      ],
    },
    {
      name: "Two people, one seat: the first call wins",
      stage: "core",
      visible: true,
      steps: [
        { call: "addShow", args: ["S1", 3, 4, 36_000_000] },
        { call: "hold", args: ["S1", "asha", ["A1", "A2"], 0], expect: "H1" },
        { call: "hold", args: ["S1", "bilal", ["A2", "A3"], 0], throws: true, note: "A2 is Asha's for now" },
        { call: "hold", args: ["S1", "bilal", ["A3", "A4"], 0], expect: "H2", note: "the refused hold didn't use up a number" },
        { call: "available", args: ["S1", 0], expect: 8 },
      ],
    },
    {
      name: "Holds expire after 10 minutes",
      stage: "core",
      visible: true,
      steps: [
        { call: "addShow", args: ["S1", 2, 2, 36_000_000] },
        { call: "hold", args: ["S1", "asha", ["A1"], 0], expect: "H1" },
        { call: "available", args: ["S1", 599999], expect: 3 },
        { call: "hold", args: ["S1", "bilal", ["A1"], 599999], throws: true },
        { call: "hold", args: ["S1", "bilal", ["A1"], 600000], expect: "H2", note: "Asha's hold ended at exactly 10 minutes" },
        { call: "confirm", args: ["H1", 600000], throws: true },
        { call: "confirm", args: ["H2", 600001], expect: "B1" },
      ],
    },
    {
      name: "Release frees seats early",
      stage: "core",
      steps: [
        { call: "addShow", args: ["S1", 2, 3, 36_000_000] },
        { call: "hold", args: ["S1", "asha", ["A1", "A2"], 0] },
        { call: "release", args: ["H1"], expect: true },
        { call: "release", args: ["H1"], expect: false },
        { call: "hold", args: ["S1", "bilal", ["A2", "A3"], 10], expect: "H2" },
        { call: "confirm", args: ["H1", 20], throws: true },
        { call: "release", args: ["H9"], throws: true },
        { call: "seatMap", args: ["S1", 20], expect: [".hh", "..."] },
      ],
    },
    {
      name: "All or nothing",
      stage: "core",
      steps: [
        { call: "addShow", args: ["S1", 2, 4, 36_000_000] },
        { call: "hold", args: ["S1", "asha", ["A1"], 0] },
        { call: "confirm", args: ["H1", 0] },
        { call: "hold", args: ["S1", "bilal", ["A2", "A1", "A3"], 5], throws: true },
        { call: "hold", args: ["S1", "bilal", ["B1", "B1"], 5], throws: true },
        { call: "hold", args: ["S1", "bilal", ["Z1"], 5], throws: true },
        { call: "hold", args: ["S1", "bilal", ["A5"], 5], throws: true },
        { call: "hold", args: ["S1", "bilal", [], 5], throws: true },
        { call: "available", args: ["S1", 5], expect: 7 },
        { call: "hold", args: ["S1", "bilal", ["A2", "A3"], 5], expect: "H2" },
      ],
    },
    {
      name: "Confirming twice, and releasing after confirming",
      stage: "core",
      steps: [
        { call: "addShow", args: ["S1", 1, 3, 36_000_000] },
        { call: "hold", args: ["S1", "asha", ["A1", "A2"], 0] },
        { call: "confirm", args: ["H1", 1000], expect: "B1" },
        { call: "confirm", args: ["H1", 2000], throws: true },
        { call: "release", args: ["H1"], expect: false },
        { call: "seatMap", args: ["S1", 2000], expect: ["xx."] },
      ],
    },
    {
      name: "Expired holds don't need a release",
      stage: "core",
      steps: [
        { call: "addShow", args: ["S1", 1, 2, 36_000_000] },
        { call: "hold", args: ["S1", "asha", ["A1", "A2"], 0] },
        { call: "seatMap", args: ["S1", 600000], expect: [".."] },
        { call: "release", args: ["H1"], expect: false, note: "it had already expired" },
        { call: "available", args: ["S1", 600000], expect: 2 },
      ],
    },
    {
      name: "Bad input is rejected and changes nothing",
      stage: "core",
      steps: [
        { call: "addShow", args: ["S1", 2, 2, 36_000_000] },
        { call: "addShow", args: ["S1", 2, 2, 36_000_000], throws: true },
        { call: "addShow", args: ["S2", 0, 2, 0], throws: true },
        { call: "addShow", args: ["S2", 27, 2, 0], throws: true },
        { call: "addShow", args: ["S2", 2, 1.5, 0], throws: true },
        { call: "hold", args: ["S9", "asha", ["A1"], 0], throws: true },
        { call: "hold", args: ["S1", "", ["A1"], 0], throws: true },
        { call: "hold", args: ["S1", "asha", ["A1"], 100] },
        { call: "available", args: ["S1", 50], throws: true },
        { call: "confirm", args: ["H1", 50], throws: true },
        { call: "available", args: ["S9", 100], throws: true },
        { call: "available", args: ["S1", 100], expect: 3 },
        { call: "confirm", args: ["H1", 100], expect: "B1" },
      ],
    },
    {
      name: "Shows don't share seats",
      stage: "core",
      steps: [
        { call: "addShow", args: ["S1", 1, 2, 36_000_000] },
        { call: "addShow", args: ["S2", 1, 2, 40_000_000] },
        { call: "hold", args: ["S1", "asha", ["A1"], 0], expect: "H1" },
        { call: "hold", args: ["S2", "bilal", ["A1"], 0], expect: "H2" },
        { call: "available", args: ["S1", 0], expect: 1 },
        { call: "available", args: ["S2", 0], expect: 1 },
      ],
    },
    {
      name: "The best seats, together",
      stage: "extension",
      visible: true,
      steps: [
        { call: "addShow", args: ["S1", 5, 6, 36_000_000] },
        { call: "holdBest", args: ["S1", "asha", 2, 0], expect: ["H1", ["C1", "C2"]], note: "row C is the middle of five" },
        { call: "holdBest", args: ["S1", "bilal", 3, 0], expect: ["H2", ["C3", "C4", "C5"]] },
        { call: "holdBest", args: ["S1", "chen", 2, 0], expect: ["H3", ["B1", "B2"]], note: "only C6 is left in C; B and D are equally near, B is in front" },
        { call: "holdBest", args: ["S1", "dev", 6, 0], expect: ["H4", ["D1", "D2", "D3", "D4", "D5", "D6"]] },
      ],
    },
    {
      name: "Best seats skip taken ones",
      stage: "extension",
      steps: [
        { call: "addShow", args: ["S1", 3, 5, 36_000_000] },
        { call: "hold", args: ["S1", "asha", ["B2", "B4"], 0] },
        { call: "holdBest", args: ["S1", "bilal", 2, 0], expect: ["H2", ["A1", "A2"]], note: "B has no two free side by side" },
        { call: "holdBest", args: ["S1", "chen", 1, 0], expect: ["H3", ["B1"]] },
        { call: "holdBest", args: ["S1", "dev", 6, 0], throws: true },
        { call: "holdBest", args: ["S1", "dev", 0, 0], throws: true },
        { call: "holdBest", args: ["S1", "dev", 2, 600000], expect: ["H4", ["B1", "B2"]], note: "every earlier hold has expired" },
      ],
    },
    {
      name: "Cancel up to two hours before the show",
      stage: "extension",
      visible: true,
      steps: [
        { call: "addShow", args: ["S1", 1, 4, 36_000_000] },
        { call: "hold", args: ["S1", "asha", ["A1"], 0] },
        { call: "confirm", args: ["H1", 0], expect: "B1" },
        { call: "hold", args: ["S1", "bilal", ["A2"], 0] },
        { call: "confirm", args: ["H2", 0], expect: "B2" },
        { call: "cancel", args: ["B1", 28_800_000], expect: true, note: "exactly 2 hours before" },
        { call: "cancel", args: ["B1", 28_800_000], throws: true },
        { call: "cancel", args: ["B2", 28_800_001], throws: true },
        { call: "seatMap", args: ["S1", 28_800_001], expect: [".x.."] },
        { call: "cancel", args: ["B9", 28_800_001], throws: true },
      ],
    },
  ],
  generated: [
    { name: "Opening night: 300 users racing for 3,000 operations", stage: "core", limitMs: 2000, gen: (r) => openingNight(r, 300, 3000, false) },
    { name: "Opening night with best-seat holds and cancellations", stage: "extension", limitMs: 2000, gen: (r) => openingNight(r, 300, 3000, true) },
  ],
  mutants: [
    { name: "A hold keeps the seats it could get", from: "    for (const id of seats) if (!s.seats.has(id) || !this.free(s.seats.get(id), time)) throw new Error(`Seat ${id} isn't available`);\n    return this.place(s, show, user, seats, time);", to: "    const ok = seats.filter((id) => s.seats.has(id) && this.free(s.seats.get(id), time));\n    if (!ok.length) throw new Error(\"No seats\");\n    return this.place(s, show, user, ok, time);" },
    { name: "A hold is still live at exactly 10 minutes", from: "return !h || h.state !== \"live\" || time >= h.expiresAt;", to: "return !h || h.state !== \"live\" || time > h.expiresAt;" },
    { name: "Late payments are still confirmed", from: "if (!h || h.state !== \"live\" || time >= h.expiresAt) throw new Error(\"That hold can't be confirmed\");", to: "if (!h || h.state !== \"live\") throw new Error(\"That hold can't be confirmed\");" },
    { name: "Cancelling is allowed right up to the show", from: "if (time > s.startsAt - CUTOFF_MS) throw new Error(\"Too close to the show to cancel\");", to: "if (time > s.startsAt) throw new Error(\"Too close to the show to cancel\");" },
    { name: "Best seats start from the front row", from: "Math.abs(a - middle) - Math.abs(b - middle) || a - b", to: "a - b" },
  ],
  hints: [
    "What makes a seat free? It isn't booked, and either nobody holds it or their hold has ended. If you can answer that for one seat at any time, expiry needs no timers at all.",
    "Give every seat a pointer to the hold or booking that has it, and every hold an expiry time and a state (live, released, confirmed). Check every requested seat first, then take them all, so a refused hold leaves nothing behind.",
    "hold: check time, show, user and seats (each known, listed once, free now), then create H{n} and point the seats at it. confirm: the hold must be live and not expired, then the seats point at a new booking. Best seats: order the rows by distance from the middle, then scan each row for n free seats in a row.",
  ],
  review: [
    "Expiry is computed from times, not timers: a seat checks its hold's expiry when asked.",
    "Holds are all or nothing: every seat is checked before any seat is taken.",
    "One function answers 'is this seat free at this time?', and everything uses it.",
    "Hold and booking ids only advance on success.",
    "The time check comes first and rejects time going backwards.",
    "Names say what things are (expiresAt, state, place, free).",
  ],
  walkthrough: {
    design:
      "Each seat points at the hold or booking that has it; each hold stores its expiry time and a state (live, released, confirmed). A seat is free if it isn't booked and its hold has ended or expired. Because that's computed from the time each call brings, holds expire on their own, with no timers or sweeps. A hold checks every seat before taking any, so two users racing for the same seat get a clear winner (the first call) and the loser keeps nothing. Confirm turns a live hold into a booking; release ends it early. Best seats is a scan over rows ordered by distance from the middle.",
    classes: [
      { name: "ShowBooking", role: "Public API: validates, holds, confirms, releases and answers availability." },
      { name: "seats (per show)", role: "Seat id → the hold or booking that has it." },
      { name: "holds and bookings", role: "Holds: seats, user, expiry and state. Bookings: seats and whether cancelled." },
    ],
    tradeoffs: [
      "Lazy expiry keeps the code simple and exact; a periodic sweep would free memory sooner but adds a background job.",
      "Holding (reserve, then pay) avoids selling a seat twice while someone pays, at the cost of seats being unavailable for up to 10 minutes; shorter holds sell faster but frustrate slow payers.",
      "In one process, calls are serialised, so 'first call wins' is free. Across servers you need an atomic check-and-set per seat: a database row lock, a conditional update (WHERE hold IS NULL), or a lock in Redis.",
      "Best seats is greedy by row; it can split groups across rows when a better arrangement exists. That's usually acceptable and easy to explain.",
    ],
    followUps: [
      "Make holds safe across many servers (row locks or conditional updates).",
      "Let a user extend a hold once while their payment is pending.",
      "A waiting list for sold-out shows that offers released seats in order.",
      "Prevent one user holding hundreds of seats (a limit per user).",
    ],
  },

};
