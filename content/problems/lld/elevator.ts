import { randInt, type BuildProblem, type Rand, type Step } from "@/content/problem-types";

/** Office rush hour: calls from the lobby up, then back down, with ticks in between. */
function rushHour(r: Rand, ticks: number, withExtension: boolean): Step[] {
  const floors = 20;
  const cars = 4;
  const steps: Step[] = [{ call: "setup", args: [floors, cars] }];
  for (let i = 0; i < ticks; i++) {
    const morning = i < ticks / 2;
    const calls = randInt(r, 0, 2);
    for (let c = 0; c < calls; c++) {
      const from = morning ? (r() < 0.7 ? 0 : randInt(r, 1, floors - 1)) : randInt(r, 1, floors - 1);
      const dir = from === 0 ? "up" : from === floors - 1 ? "down" : morning && r() < 0.6 ? "up" : "down";
      steps.push({ call: "call", args: [from, dir] });
    }
    if (r() < 0.5) steps.push({ call: "press", args: [randInt(r, 1, cars), randInt(r, 0, floors - 1)] });
    if (r() < 0.02) steps.push({ call: "call", args: [floors + 3, "up"] }); // a bad floor: refused
    if (withExtension && r() < 0.02) steps.push({ call: r() < 0.5 ? "outOfService" : "backInService", args: [randInt(r, 1, cars)] });
    steps.push({ call: "tick", args: [] });
    if (r() < 0.1) steps.push({ call: "status", args: [] });
  }
  if (withExtension) steps.push({ call: "served", args: [] });
  return steps;
}

export const elevator: BuildProblem = {
  kind: "build",
  id: "elevator",
  chapter: "elevator",
  n: 1,
  title: "Lifts for Tiffin's new office",
  level: "Hard",
  shape: "Machine coding · scheduling and simulation",
  rounds: ["Machine coding"],
  minutes: 90,
  statement: `Tiffin's new 20-floor office has a bank of lifts. Build \`Elevators\`, the controller that decides which car answers each call and where every car goes next.

Time moves in **ticks**: in one tick a car moves one floor, or, if it's already at a floor someone wants, it stops there. Tests drive the building call by call and tick by tick, and check every car's floor and direction, so the rules below are exact.

After the core passes, the interviewer adds two requirements, just as in a real round.`,
  requirements: {
    core: [
      "Set up a building with some floors and cars; every car starts idle on floor 0.",
      "Hall calls (a floor and a direction) go to the cheapest car; buttons pressed inside a car add stops for that car.",
      "On each tick, every car moves one floor toward its next stop, sweeping in one direction while it has stops ahead (SCAN), and stops at floors on its list.",
      "Report each car's floor and direction, and which cars stopped on a tick.",
      "Reject invalid input with an error and change nothing.",
    ],
    extension: ["Take a car out of service: its hall calls go to other cars; bring it back later.", "Report, for each hall call served, how many ticks it waited."],
  },
  api: [
    { js: "setup(floors, cars)", py: "setup(floors, cars)", does: "Floors 0 … floors − 1; cars numbered 1 … cars.", stage: "core" },
    { js: "call(floor, direction)", py: "call(floor, direction)", does: "A hall call, \"up\" or \"down\". Returns the car it was given to.", stage: "core" },
    { js: "press(car, floor)", py: "press(car, floor)", does: "A button inside a car: adds a stop.", stage: "core" },
    { js: "tick()", py: "tick()", does: "Moves time on by one. Returns [[car, floor], …] for every car that stopped this tick, by car number.", stage: "core" },
    { js: "status()", py: "status()", does: "[[car, floor, direction], …] by car number; direction is \"up\", \"down\" or \"idle\".", stage: "core" },
    { js: "outOfService(car) / backInService(car)", py: "out_of_service(car) / back_in_service(car)", does: "Takes a car out (its hall calls move to other cars) or brings it back.", stage: "extension" },
    { js: "served()", py: "served()", does: "[[floor, direction, ticks waited], …] for hall calls answered so far, in the order they were answered.", stage: "extension" },
  ],
  rules: [
    "A tick, for each car in number order: if its current floor is a stop, it stops there (the stop is removed); otherwise, if it has stops, it moves one floor and, if that floor is a stop, stops there. A car with no stops left is idle.",
    "Which way to move: keep going in the current direction while there's a stop that way; otherwise turn around. An idle car heads for its nearest stop (ties: up).",
    "Cost of a hall call for a car: an idle car, or one already heading that way in the call's direction without having passed the floor, costs the distance. Any other car costs the distance to the furthest stop in its current direction, plus the distance from there back to the floor.",
    "A hall call goes to the car with the lowest cost; ties go to the lowest car number. The floor becomes a stop for that car.",
    "Errors (JavaScript: throw an Error; Python: raise ValueError), changing nothing: a call before setup; unknown floors, cars or directions; \"up\" from the top floor or \"down\" from the ground floor.",
    "Out of service (extension): the car keeps its in-car stops but gets no new hall calls, and its unanswered hall calls go to other cars by cost, in the order they were made. A call when every car is out of service is an error.",
    "Served (extension): a hall call is answered the first time its car stops at that floor; the wait counts ticks since the call.",
  ],
  className: "Elevators",
  starter: {
    js: `class Elevators {
  constructor() {
    // your state here
  }

  setup(floors, cars) {}

  call(floor, direction) {
    return 1;
  }

  press(car, floor) {}

  tick() {
    return [];
  }

  status() {
    return [];
  }

  // The interviewer adds more once the core works
}
`,
    py: `class Elevators:
    def __init__(self):
        pass  # your state here

    def setup(self, floors, cars):
        pass

    def call(self, floor, direction):
        return 1

    def press(self, car, floor):
        pass

    def tick(self):
        return []

    def status(self):
        return []

    # The interviewer adds more once the core works
`,
  },
  solution: {
    js: `// Each car is a small object that knows its floor, its direction and its stops. Dispatch (which
// car gets a hall call) is one cost function, so trying another policy means changing one place.
class Car {
  constructor(id) {
    this.id = id;
    this.floor = 0;
    this.dir = "idle";
    this.stops = new Set();
    this.inService = true;
  }
  ahead(dir) {
    for (const s of this.stops) if (dir === "up" ? s > this.floor : s < this.floor) return true;
    return false;
  }
  // SCAN: keep going while there's a stop ahead; otherwise turn; idle cars head for the nearest stop.
  chooseDirection() {
    if (this.dir !== "idle" && this.ahead(this.dir)) return this.dir;
    const other = this.dir === "up" ? "down" : "up";
    if (this.dir !== "idle" && this.ahead(other)) return other;
    let best = null;
    for (const s of this.stops) if (best === null || Math.abs(s - this.floor) < Math.abs(best - this.floor) || (Math.abs(s - this.floor) === Math.abs(best - this.floor) && s > best)) best = s;
    return best === null || best === this.floor ? "idle" : best > this.floor ? "up" : "down";
  }
  cost(floor, dir) {
    const coming = this.dir === dir && (dir === "up" ? floor >= this.floor : floor <= this.floor);
    if (this.dir === "idle" || coming) return Math.abs(floor - this.floor);
    let far = this.floor;
    for (const s of this.stops) if (this.dir === "up" ? s > far : s < far) far = s;
    return Math.abs(far - this.floor) + Math.abs(far - floor);
  }
}

class Elevators {
  constructor() {
    this.floors = 0;
    this.cars = [];
    this.now = 0;
    this.pending = []; // unanswered hall calls: { floor, dir, car, at }
    this.answered = [];
  }

  setup(floors, cars) {
    if (!whole(floors, 2) || !whole(cars, 1)) throw new Error("A building needs at least 2 floors and 1 car");
    this.floors = floors;
    this.cars = Array.from({ length: cars }, (_, i) => new Car(i + 1));
    this.now = 0;
    this.pending = [];
    this.answered = [];
  }

  call(floor, direction) {
    this.checkFloor(floor);
    if (direction !== "up" && direction !== "down") throw new Error("Direction is up or down");
    if ((direction === "up" && floor === this.floors - 1) || (direction === "down" && floor === 0)) throw new Error("No way to go from there");
    const car = this.dispatch(floor, direction);
    this.pending.push({ floor, dir: direction, car: car.id, at: this.now });
    return car.id;
  }

  press(car, floor) {
    this.checkFloor(floor);
    this.car(car).stops.add(floor);
  }

  tick() {
    this.checkSetup();
    this.now += 1;
    const stopped = [];
    for (const c of this.cars) {
      if (c.stops.has(c.floor)) {
        this.arrive(c, stopped);
      } else if (c.stops.size) {
        c.dir = c.chooseDirection();
        c.floor += c.dir === "up" ? 1 : -1;
        if (c.stops.has(c.floor)) this.arrive(c, stopped);
      }
      if (!c.stops.size) c.dir = "idle";
    }
    return stopped;
  }

  status() {
    this.checkSetup();
    return this.cars.map((c) => [c.id, c.floor, c.dir]);
  }

  // Extension
  outOfService(car) {
    const c = this.car(car);
    if (!c.inService) throw new Error("Already out of service");
    if (this.cars.filter((x) => x.inService).length === 1) throw new Error("At least one car must stay in service");
    c.inService = false;
    for (const p of this.pending)
      if (p.car === c.id) {
        if (!this.pending.some((q) => q !== p && q.car === c.id && q.floor === p.floor)) c.stops.delete(p.floor);
        p.car = this.dispatch(p.floor, p.dir).id;
      }
  }

  backInService(car) {
    const c = this.car(car);
    if (c.inService) throw new Error("Already in service");
    c.inService = true;
  }

  served() {
    return this.answered.map((a) => [...a]);
  }

  // ——— helpers
  dispatch(floor, dir) {
    let best = null;
    for (const c of this.cars) if (c.inService && (best === null || c.cost(floor, dir) < best.cost(floor, dir))) best = c;
    if (!best) throw new Error("No car in service");
    best.stops.add(floor);
    return best;
  }

  arrive(c, stopped) {
    c.stops.delete(c.floor);
    stopped.push([c.id, c.floor]);
    const still = [];
    for (const p of this.pending) {
      if (p.car === c.id && p.floor === c.floor) this.answered.push([p.floor, p.dir, this.now - p.at]);
      else still.push(p);
    }
    this.pending = still;
  }

  car(id) {
    this.checkSetup();
    const c = this.cars[id - 1];
    if (!Number.isInteger(id) || !c) throw new Error("Unknown car");
    return c;
  }

  checkFloor(floor) {
    this.checkSetup();
    if (!whole(floor, 0) || floor >= this.floors) throw new Error("Unknown floor");
  }

  checkSetup() {
    if (!this.cars.length) throw new Error("Set the building up first");
  }
}

const whole = (n, min) => Number.isInteger(n) && n >= min;
`,
    py: `# Each car is a small object that knows its floor, its direction and its stops. Dispatch (which
# car gets a hall call) is one cost function, so trying another policy means changing one place.


def whole(n, least):
    return isinstance(n, int) and not isinstance(n, bool) and n >= least


class Car:
    def __init__(self, id):
        self.id = id
        self.floor = 0
        self.dir = "idle"
        self.stops = set()
        self.in_service = True

    def ahead(self, d):
        return any(s > self.floor if d == "up" else s < self.floor for s in self.stops)

    def choose_direction(self):
        if self.dir != "idle" and self.ahead(self.dir):
            return self.dir
        other = "down" if self.dir == "up" else "up"
        if self.dir != "idle" and self.ahead(other):
            return other
        best = None
        for s in self.stops:
            if best is None or abs(s - self.floor) < abs(best - self.floor) or (abs(s - self.floor) == abs(best - self.floor) and s > best):
                best = s
        if best is None or best == self.floor:
            return "idle"
        return "up" if best > self.floor else "down"

    def cost(self, floor, d):
        coming = self.dir == d and (floor >= self.floor if d == "up" else floor <= self.floor)
        if self.dir == "idle" or coming:
            return abs(floor - self.floor)
        far = self.floor
        for s in self.stops:
            if (s > far) if self.dir == "up" else (s < far):
                far = s
        return abs(far - self.floor) + abs(far - floor)


class Elevators:
    def __init__(self):
        self.floors = 0
        self.cars = []
        self.now = 0
        self.pending = []  # unanswered hall calls: [floor, dir, car, at]
        self.answered = []

    def setup(self, floors, cars):
        if not whole(floors, 2) or not whole(cars, 1):
            raise ValueError("A building needs at least 2 floors and 1 car")
        self.floors = floors
        self.cars = [Car(i + 1) for i in range(cars)]
        self.now = 0
        self.pending = []
        self.answered = []

    def call(self, floor, direction):
        self._check_floor(floor)
        if direction not in ("up", "down"):
            raise ValueError("Direction is up or down")
        if (direction == "up" and floor == self.floors - 1) or (direction == "down" and floor == 0):
            raise ValueError("No way to go from there")
        car = self._dispatch(floor, direction)
        self.pending.append([floor, direction, car.id, self.now])
        return car.id

    def press(self, car, floor):
        self._check_floor(floor)
        self._car(car).stops.add(floor)

    def tick(self):
        self._check_setup()
        self.now += 1
        stopped = []
        for c in self.cars:
            if c.floor in c.stops:
                self._arrive(c, stopped)
            elif c.stops:
                c.dir = c.choose_direction()
                c.floor += 1 if c.dir == "up" else -1
                if c.floor in c.stops:
                    self._arrive(c, stopped)
            if not c.stops:
                c.dir = "idle"
        return stopped

    def status(self):
        self._check_setup()
        return [[c.id, c.floor, c.dir] for c in self.cars]

    def out_of_service(self, car):
        c = self._car(car)
        if not c.in_service:
            raise ValueError("Already out of service")
        if sum(1 for x in self.cars if x.in_service) == 1:
            raise ValueError("At least one car must stay in service")
        c.in_service = False
        for p in self.pending:
            if p[2] == c.id:
                if not any(q is not p and q[2] == c.id and q[0] == p[0] for q in self.pending):
                    c.stops.discard(p[0])
                p[2] = self._dispatch(p[0], p[1]).id

    def back_in_service(self, car):
        c = self._car(car)
        if c.in_service:
            raise ValueError("Already in service")
        c.in_service = True

    def served(self):
        return [list(a) for a in self.answered]

    def _dispatch(self, floor, d):
        best = None
        for c in self.cars:
            if c.in_service and (best is None or c.cost(floor, d) < best.cost(floor, d)):
                best = c
        if best is None:
            raise ValueError("No car in service")
        best.stops.add(floor)
        return best

    def _arrive(self, c, stopped):
        c.stops.discard(c.floor)
        stopped.append([c.id, c.floor])
        still = []
        for p in self.pending:
            if p[2] == c.id and p[0] == c.floor:
                self.answered.append([p[0], p[1], self.now - p[3]])
            else:
                still.append(p)
        self.pending = still

    def _car(self, id):
        self._check_setup()
        if not whole(id, 1) or id > len(self.cars):
            raise ValueError("Unknown car")
        return self.cars[id - 1]

    def _check_floor(self, floor):
        self._check_setup()
        if not whole(floor, 0) or floor >= self.floors:
            raise ValueError("Unknown floor")

    def _check_setup(self):
        if not self.cars:
            raise ValueError("Set the building up first")
`,
  },
  scenarios: [
    {
      name: "One car, one call",
      stage: "core",
      visible: true,
      steps: [
        { call: "setup", args: [10, 1] },
        { call: "call", args: [5, "down"], expect: 1 },
        { call: "tick", args: [], expect: [] },
        { call: "tick", args: [], expect: [] },
        { call: "status", args: [], expect: [[1, 2, "up"]] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [], expect: [[1, 5]] },
        { call: "status", args: [], expect: [[1, 5, "idle"]] },
      ],
    },
    {
      name: "Keep going up, then come back down (SCAN)",
      stage: "core",
      visible: true,
      steps: [
        { call: "setup", args: [10, 1] },
        { call: "press", args: [1, 8] },
        { call: "press", args: [1, 3] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [], expect: [[1, 3]] },
        { call: "call", args: [1, "up"], expect: 1 },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [], expect: [[1, 8]] },
        { call: "status", args: [], expect: [[1, 8, "up"]], note: "it still has a stop, so it isn't idle; it turns on the next tick" },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [], expect: [[1, 1]] },
        { call: "status", args: [], expect: [[1, 1, "idle"]] },
      ],
    },
    {
      name: "The cheapest car answers; ties go to the lowest number",
      stage: "core",
      visible: true,
      steps: [
        { call: "setup", args: [20, 3] },
        { call: "press", args: [2, 10] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [], expect: [[2, 10]] },
        { call: "call", args: [8, "up"], expect: 2, note: "car 2 is idle on 10: 2 floors away" },
        { call: "call", args: [3, "up"], expect: 1, note: "cars 1 and 3 are both 3 floors away" },
      ],
    },
    {
      name: "A car already coming that way picks the call up",
      stage: "core",
      steps: [
        { call: "setup", args: [20, 2] },
        { call: "press", args: [1, 15] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "call", args: [10, "up"], expect: 1, note: "car 1 is going up from 2: 8 floors" },
        { call: "call", args: [1, "up"], expect: 2, note: "car 1 has passed floor 1: it would go to 15 first" },
        { call: "call", args: [12, "down"], expect: 2, note: "car 1 would go up to 15 and back (16); idle car 2 costs 12" },
      ],
    },
    {
      name: "Turning around for a call behind",
      stage: "core",
      steps: [
        { call: "setup", args: [10, 1] },
        { call: "press", args: [1, 5] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "call", args: [1, "up"], expect: 1 },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [], expect: [[1, 5]] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [], expect: [[1, 1]] },
      ],
    },
    {
      name: "Pressing the floor you're on, and stopping together",
      stage: "core",
      steps: [
        { call: "setup", args: [5, 2] },
        { call: "press", args: [1, 0] },
        { call: "tick", args: [], expect: [[1, 0]] },
        { call: "status", args: [], expect: [[1, 0, "idle"], [2, 0, "idle"]] },
        { call: "press", args: [1, 2] },
        { call: "press", args: [2, 2] },
        { call: "tick", args: [] },
        { call: "tick", args: [], expect: [[1, 2], [2, 2]] },
      ],
    },
    {
      name: "Bad input is rejected and changes nothing",
      stage: "core",
      steps: [
        { call: "call", args: [1, "up"], throws: true },
        { call: "setup", args: [1, 1], throws: true },
        { call: "setup", args: [5, 0], throws: true },
        { call: "setup", args: [5, 2] },
        { call: "call", args: [5, "up"], throws: true },
        { call: "call", args: [4, "up"], throws: true },
        { call: "call", args: [0, "down"], throws: true },
        { call: "call", args: [2, "sideways"], throws: true },
        { call: "press", args: [3, 1], throws: true },
        { call: "press", args: [1, 9], throws: true },
        { call: "status", args: [], expect: [[1, 0, "idle"], [2, 0, "idle"]] },
        { call: "tick", args: [], expect: [] },
      ],
    },
    {
      name: "A car with nothing to do stays put",
      stage: "core",
      steps: [
        { call: "setup", args: [8, 2] },
        { call: "press", args: [1, 3] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [], expect: [[1, 3]] },
        { call: "tick", args: [] },
        { call: "status", args: [], expect: [[1, 3, "idle"], [2, 0, "idle"]] },
      ],
    },
    {
      name: "Out of service: hall calls move to another car",
      stage: "extension",
      visible: true,
      steps: [
        { call: "setup", args: [10, 2] },
        { call: "call", args: [6, "up"], expect: 1 },
        { call: "outOfService", args: [1] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [], expect: [[2, 6]] },
        { call: "status", args: [], expect: [[1, 0, "idle"], [2, 6, "idle"]] },
        { call: "call", args: [3, "up"], expect: 2 },
        { call: "outOfService", args: [2], throws: true },
        { call: "backInService", args: [1] },
        { call: "call", args: [1, "up"], expect: 1 },
      ],
    },
    {
      name: "How long each hall call waited",
      stage: "extension",
      visible: true,
      steps: [
        { call: "setup", args: [10, 1] },
        { call: "call", args: [3, "up"] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [], expect: [[1, 3]] },
        { call: "served", args: [], expect: [[3, "up", 3]] },
        { call: "call", args: [1, "up"] },
        { call: "tick", args: [] },
        { call: "tick", args: [], expect: [[1, 1]] },
        { call: "served", args: [], expect: [[3, "up", 3], [1, "up", 2]] },
      ],
    },
    {
      name: "In-car stops aren't hall calls",
      stage: "extension",
      steps: [
        { call: "setup", args: [10, 1] },
        { call: "press", args: [1, 4] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [], expect: [[1, 4]] },
        { call: "served", args: [], expect: [] },
      ],
    },
    {
      name: "A car out of service still takes its passengers home",
      stage: "extension",
      steps: [
        { call: "setup", args: [10, 2] },
        { call: "press", args: [1, 5] },
        { call: "call", args: [7, "up"], expect: 1, note: "both cars are 7 away; car 1 has the lower number" },
        { call: "outOfService", args: [1] },
        { call: "backInService", args: [2], throws: true },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [] },
        { call: "tick", args: [], expect: [[1, 5]] },
        { call: "tick", args: [] },
        { call: "tick", args: [], expect: [[2, 7]] },
        { call: "served", args: [], expect: [[7, "up", 7]] },
      ],
    },
  ],
  generated: [
    { name: "Rush hour: 600 ticks, 4 cars, 20 floors", stage: "core", limitMs: 2000, gen: (r) => rushHour(r, 600, false) },
    { name: "Rush hour with cars going out of service", stage: "extension", limitMs: 2000, gen: (r) => rushHour(r, 600, true) },
  ],
  mutants: [
    { name: "Turns back for a stop behind while stops lie ahead", from: "    if (this.dir !== \"idle\" && this.ahead(this.dir)) return this.dir;\n    const other = this.dir === \"up\" ? \"down\" : \"up\";\n    if (this.dir !== \"idle\" && this.ahead(other)) return other;", to: "    const other = this.dir === \"up\" ? \"down\" : \"up\";\n    if (this.dir !== \"idle\" && this.ahead(other)) return other;\n    if (this.dir !== \"idle\" && this.ahead(this.dir)) return this.dir;" },
    { name: "Ties go to the highest car number", from: "(best === null || c.cost(floor, dir) < best.cost(floor, dir))", to: "(best === null || c.cost(floor, dir) <= best.cost(floor, dir))" },
    { name: "Counts a car as coming even after it passed the floor", from: "const coming = this.dir === dir && (dir === \"up\" ? floor >= this.floor : floor <= this.floor);", to: "const coming = this.dir === dir;" },
    { name: "A car out of service keeps its hall calls", from: "        p.car = this.dispatch(p.floor, p.dir).id;", to: "        p.car = p.car;" },
    { name: "Waits are counted from the start", from: "this.answered.push([p.floor, p.dir, this.now - p.at]);", to: "this.answered.push([p.floor, p.dir, this.now]);" },
  ],
  hints: [
    "Separate two questions: which car gets a hall call (dispatch), and where does each car go next (movement). Each is a small rule you can test on its own.",
    "Give each car a floor, a direction and a set of stops. Movement: keep going while a stop lies ahead, otherwise turn; stop when you reach a floor in the set. Dispatch: compute a cost per car and pick the lowest.",
    "tick(): for each car in order, stop if its floor is a stop; else pick a direction (SCAN), move one floor, and stop if that floor is a stop; idle when no stops remain. Cost: idle or already coming that way means distance; otherwise distance to its furthest stop ahead plus the way back.",
  ],
  review: [
    "Dispatch is one cost function, so trying another policy is a one-place change.",
    "Movement (SCAN) lives on the car; the controller just ticks the cars in order.",
    "Hall calls are remembered separately from stops, so reassigning them and measuring waits is easy.",
    "Every input is checked before anything changes.",
    "Ties are broken explicitly (lowest car, upward first), so the behaviour is deterministic.",
    "Names say what things are (stops, pending, dispatch, chooseDirection).",
  ],
  walkthrough: {
    design:
      "Two policies, kept apart. Movement belongs to each car: it holds its floor, its direction and a set of stops, and on each tick it keeps going while a stop lies ahead, turns when none does, and stops at floors on its list (the SCAN, or elevator, algorithm). Dispatch belongs to the controller: a hall call is offered to every car in service and goes to the cheapest. A car that's idle, or already heading that way without having passed the floor, costs the distance; any other car costs the trip to its furthest stop plus the way back. Hall calls are also kept in a pending list, so when a car goes out of service they can be reassigned, and when they're answered the wait can be measured.",
    classes: [
      { name: "Elevators", role: "The controller: validates, dispatches hall calls, ticks the cars, tracks pending and answered calls." },
      { name: "Car", role: "Floor, direction, stops; chooses its direction (SCAN) and prices a hall call (cost)." },
      { name: "pending / answered", role: "Hall calls waiting for their car, and the waits of those served." },
    ],
    tradeoffs: [
      "SCAN is simple and fair: no request waits more than about two sweeps. Nearest-first is faster on average but can starve far floors.",
      "The cost function is a heuristic. Real systems weigh in load, door times and energy, and some assign calls only when a car is close (destination dispatch).",
      "Ticks make the simulation deterministic and testable; a real controller is event-driven, with the same rules.",
      "Reassigning hall calls when a car fails is easy because they're tracked apart from in-car stops.",
    ],
    followUps: [
      "Destination dispatch: passengers enter their floor in the lobby and are grouped into cars.",
      "Capacity: a full car skips hall calls.",
      "An express car that only serves the lobby and floors above 10.",
      "Minimise average wait instead of distance.",
    ],
  },
};
