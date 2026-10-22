import { randInt, type BuildProblem, type Rand, type Step } from "@/content/problem-types";

const DAY = 24 * 60;
/** Minute 0 is Monday 00:00. */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

/** A long, realistic day: arrivals and departures across three floors, with some invalid calls. */
function busyDay(r: Rand, calls: number, withExtension: boolean): Step[] {
  const steps: Step[] = [
    { call: "addFloor", args: ["G", { bike: 20, car: 40, truck: 6 }] },
    { call: "addFloor", args: ["L1", { bike: 10, car: 60, truck: 4 }] },
    { call: "addFloor", args: ["L2", { car: 50 }] },
  ];
  if (withExtension) {
    steps.push({ call: "addFloor", args: ["V", { bike: 5, car: 10 }, true] });
    steps.push({ call: "setWeekendRate", args: ["car", 80] });
    steps.push({ call: "setWeekendRate", args: ["bike", 30] });
  }
  let t = withExtension ? at(4, 18) : at(0, 8); // the extension's day starts on a Friday evening
  let issued = 0;
  let plates = 0;
  const inside: { plate: string; ticket: number }[] = [];
  const types = ["bike", "bike", "bike", "car", "car", "car", "car", "car", "car", "car", "car", "car", "car", "car", "car", "truck"];
  for (let i = 0; i < calls; i++) {
    t += randInt(r, 0, withExtension ? 9 : 4);
    const roll = r();
    if (roll < 0.5 && inside.length < 120) {
      const reuse = inside.length && r() < 0.04; // the same car twice: must be refused
      const plate = reuse ? inside[randInt(r, 0, inside.length - 1)].plate : `KA${String(++plates).padStart(4, "0")}`;
      const args: unknown[] = [plate, types[randInt(r, 0, types.length - 1)], t];
      if (withExtension && r() < 0.15) args.push(true);
      steps.push({ call: "park", args });
      if (!reuse) inside.push({ plate, ticket: ++issued });
    } else if (roll < 0.9 && inside.length) {
      const [car] = inside.splice(randInt(r, 0, inside.length - 1), 1);
      steps.push({ call: "leave", args: [`T${car.ticket}`, t] });
      if (r() < 0.03) steps.push({ call: "leave", args: [`T${car.ticket}`, t + 5] }); // a used ticket
    } else if (roll < 0.95) {
      steps.push({ call: "freeSlots", args: [["bike", "car", "truck"][randInt(r, 0, 2)]] });
    } else {
      const plate = inside.length && r() < 0.8 ? inside[randInt(r, 0, inside.length - 1)].plate : "NOPE01";
      steps.push({ call: "whereIs", args: [plate] });
    }
  }
  return steps;
}

export const parkingLot: BuildProblem = {
  kind: "build",
  id: "parking-lot",
  chapter: "parking-lot",
  n: 1,
  title: "Parking lot in 90 minutes",
  level: "Medium",
  shape: "Machine coding · allocation and pricing",
  rounds: ["Machine coding"],
  minutes: 90,
  statement: `Tiffin is opening a hub with a multi-level car park for riders, vans and visitors. Build its core as one class, \`ParkingLot\`: floors of slots, a ticket when a vehicle parks, and a fee when it leaves.

Times are whole **minutes**, counted from Monday 00:00 of the first week, so the tests can say exactly when a stay starts and ends. Fees are whole **rupees**. Follow the rules exactly: hidden tests check every slot and every fee.

After the core passes, the interviewer adds two requirements, just as in a real round.`,
  requirements: {
    core: [
      "Add floors, each with some bike, car and truck slots.",
      "Park a vehicle in the best free slot and give back a ticket.",
      "Charge by the hour when it leaves, and free its slot.",
      "Tell how many slots of a size are free, and where a vehicle is parked.",
      "Reject invalid input with an error and leave everything unchanged.",
    ],
    extension: ["Weekend rates: a different hourly rate on Saturdays and Sundays, set per vehicle type.", "A VIP floor whose slots only VIP vehicles may use."],
  },
  api: [
    { js: "addFloor(floor, slots)", py: "add_floor(floor, slots)", does: "slots is like { bike: 2, car: 10, truck: 1 } (any size may be left out). Floor ids are new and non-empty.", stage: "core" },
    { js: "park(plate, type, time)", py: "park(plate, type, time)", does: "type is \"bike\", \"car\" or \"truck\". Returns a ticket id: \"T1\", \"T2\", … in order.", stage: "core" },
    { js: "leave(ticket, time)", py: "leave(ticket, time)", does: "Returns the fee in rupees and frees the slot. A ticket works once.", stage: "core" },
    { js: "freeSlots(size)", py: "free_slots(size)", does: "How many slots of exactly this size are free (VIP ones included).", stage: "core" },
    { js: "whereIs(plate)", py: "where_is(plate)", does: "The slot id, like \"L1-C3\", or null (None) if it isn't parked.", stage: "core" },
    { js: "setWeekendRate(type, perHour)", py: "set_weekend_rate(type, per_hour)", does: "Hourly rate on Saturday and Sunday for one vehicle type.", stage: "extension" },
    { js: "addFloor(floor, slots, vip)", py: "add_floor(floor, slots, vip=False)", does: "vip = true makes every slot on the floor a VIP slot.", stage: "extension" },
    { js: "park(plate, type, time, vip)", py: "park(plate, type, time, vip=False)", does: "vip = true for VIP vehicles.", stage: "extension" },
  ],
  rules: [
    "Slot ids are floor, a dash, the size's initial and a number from 1 per floor and size: G-B1, G-C1, G-C2, L1-T1.",
    "A bike fits bike, car or truck slots; a car fits car or truck slots; a truck only fits truck slots.",
    "Choose the slot in this order: the vehicle's own size before bigger sizes; then floors in the order they were added; then the lowest slot number.",
    "Rates per started hour: bike ₹20, car ₹50, truck ₹100. A stay is charged for ceil(minutes ÷ 60) hours, and at least 1 hour.",
    "Tickets are numbered T1, T2, … for successful parks only, and numbers are never reused.",
    "Errors (JavaScript: throw an Error; Python: raise ValueError), changing nothing: an unknown type or size, a bad floor spec, a repeated floor id, a vehicle that's already parked, no free slot, an unknown or used ticket, an exit before the entry.",
    "Weekend (extension): each charged hour uses the rate for the day that hour starts on. Days 5 and 6 of every week (minute ÷ 1440, mod 7) are Saturday and Sunday. Types without a weekend rate keep their normal rate.",
    "VIP (extension): normal vehicles never use VIP slots. VIP vehicles try VIP slots first (same size order), then normal slots.",
  ],
  className: "ParkingLot",
  starter: {
    js: `class ParkingLot {
  constructor() {
    // your state here
  }

  addFloor(floor, slots) {}

  park(plate, type, time) {
    return "T?";
  }

  leave(ticket, time) {
    return 0;
  }

  freeSlots(size) {
    return 0;
  }

  whereIs(plate) {
    return null;
  }

  // The interviewer adds more once the core works
}
`,
    py: `class ParkingLot:
    def __init__(self):
        pass  # your state here

    def add_floor(self, floor, slots):
        pass

    def park(self, plate, type, time):
        return "T?"

    def leave(self, ticket, time):
        return 0

    def free_slots(self, size):
        return 0

    def where_is(self, plate):
        return None

    # The interviewer adds more once the core works
`,
  },
  solution: {
    js: `// Pricing is the part that changes, so it's a strategy: leave() asks it for each hour's rate.
const SIZES = ["bike", "car", "truck"];
const RATES = { bike: 20, car: 50, truck: 100 }; // rupees per started hour
const DAY = 24 * 60;

class HourlyPricing {
  constructor(rates) {
    this.rates = rates;
  }
  rateAt(type, minute) {
    return this.rates[type];
  }
}

class WeekendPricing {
  constructor(base, weekend) {
    this.base = base;
    this.weekend = weekend;
  }
  rateAt(type, minute) {
    const day = Math.floor(minute / DAY) % 7; // minute 0 is Monday 00:00
    return day >= 5 && this.weekend[type] !== undefined ? this.weekend[type] : this.base.rateAt(type, minute);
  }
}

class ParkingLot {
  constructor() {
    this.slots = []; // in the order they were added: { id, size, vip, plate }
    this.floors = new Set();
    this.tickets = new Map(); // ticket → { plate, type, slot, entry }
    this.parked = new Map(); // plate → ticket
    this.next = 1;
    this.weekend = {};
    this.pricing = new HourlyPricing(RATES);
  }

  addFloor(floor, slots, vip = false) {
    if (!floor || this.floors.has(floor)) throw new Error("Floor ids must be new and non-empty");
    for (const [size, n] of Object.entries(slots))
      if (!SIZES.includes(size) || !Number.isInteger(n) || n < 0) throw new Error("Bad slot counts");
    this.floors.add(floor);
    for (const size of SIZES)
      for (let n = 1; n <= (slots[size] ?? 0); n++)
        this.slots.push({ id: \`\${floor}-\${size[0].toUpperCase()}\${n}\`, size, vip, plate: null });
  }

  park(plate, type, time, vip = false) {
    if (!SIZES.includes(type)) throw new Error("Unknown vehicle type");
    if (!plate || this.parked.has(plate)) throw new Error("That vehicle is already parked");
    if (!Number.isInteger(time) || time < 0) throw new Error("Bad time");
    const slot = this.findSlot(type, vip);
    if (!slot) throw new Error("No free slot for this vehicle");
    const ticket = \`T\${this.next++}\`;
    slot.plate = plate;
    this.tickets.set(ticket, { plate, type, slot, entry: time });
    this.parked.set(plate, ticket);
    return ticket;
  }

  // Own size before bigger sizes, then floors in order, then slot number (the order slots were added).
  // VIP vehicles try VIP slots first; normal vehicles never use them.
  findSlot(type, vip) {
    const sizes = SIZES.slice(SIZES.indexOf(type));
    for (const wantVip of vip ? [true, false] : [false])
      for (const size of sizes) {
        const slot = this.slots.find((s) => !s.plate && s.size === size && s.vip === wantVip);
        if (slot) return slot;
      }
    return null;
  }

  leave(ticket, time) {
    const t = this.tickets.get(ticket);
    if (!t) throw new Error("Unknown or used ticket");
    if (!Number.isInteger(time) || time < t.entry) throw new Error("Exit can't be before entry");
    const hours = Math.max(1, Math.ceil((time - t.entry) / 60));
    let fee = 0;
    for (let h = 0; h < hours; h++) fee += this.pricing.rateAt(t.type, t.entry + h * 60);
    t.slot.plate = null;
    this.tickets.delete(ticket);
    this.parked.delete(t.plate);
    return fee;
  }

  freeSlots(size) {
    if (!SIZES.includes(size)) throw new Error("Unknown size");
    return this.slots.filter((s) => s.size === size && !s.plate).length;
  }

  whereIs(plate) {
    const ticket = this.parked.get(plate);
    return ticket ? this.tickets.get(ticket).slot.id : null;
  }

  // Extension: weekend rates wrap the normal pricing; nothing else changes.
  setWeekendRate(type, perHour) {
    if (!SIZES.includes(type) || !Number.isInteger(perHour) || perHour < 0) throw new Error("Bad rate");
    this.weekend = { ...this.weekend, [type]: perHour };
    this.pricing = new WeekendPricing(new HourlyPricing(RATES), this.weekend);
  }
}
`,
    py: `# Pricing is the part that changes, so it's a strategy: leave() asks it for each hour's rate.
import math

SIZES = ["bike", "car", "truck"]
RATES = {"bike": 20, "car": 50, "truck": 100}  # rupees per started hour
DAY = 24 * 60


class HourlyPricing:
    def __init__(self, rates):
        self.rates = rates

    def rate_at(self, type, minute):
        return self.rates[type]


class WeekendPricing:
    def __init__(self, base, weekend):
        self.base = base
        self.weekend = weekend

    def rate_at(self, type, minute):
        day = (minute // DAY) % 7  # minute 0 is Monday 00:00
        if day >= 5 and type in self.weekend:
            return self.weekend[type]
        return self.base.rate_at(type, minute)


class Slot:
    def __init__(self, id, size, vip):
        self.id, self.size, self.vip, self.plate = id, size, vip, None


def whole(n):
    return isinstance(n, int) and not isinstance(n, bool)


class ParkingLot:
    def __init__(self):
        self.slots = []  # in the order they were added
        self.floors = set()
        self.tickets = {}  # ticket -> (plate, type, slot, entry)
        self.parked = {}  # plate -> ticket
        self.next = 1
        self.weekend = {}
        self.pricing = HourlyPricing(RATES)

    def add_floor(self, floor, slots, vip=False):
        if not floor or floor in self.floors:
            raise ValueError("Floor ids must be new and non-empty")
        for size, n in slots.items():
            if size not in SIZES or not whole(n) or n < 0:
                raise ValueError("Bad slot counts")
        self.floors.add(floor)
        for size in SIZES:
            for n in range(1, slots.get(size, 0) + 1):
                self.slots.append(Slot(f"{floor}-{size[0].upper()}{n}", size, vip))

    def park(self, plate, type, time, vip=False):
        if type not in SIZES:
            raise ValueError("Unknown vehicle type")
        if not plate or plate in self.parked:
            raise ValueError("That vehicle is already parked")
        if not whole(time) or time < 0:
            raise ValueError("Bad time")
        slot = self.find_slot(type, vip)
        if slot is None:
            raise ValueError("No free slot for this vehicle")
        ticket = f"T{self.next}"
        self.next += 1
        slot.plate = plate
        self.tickets[ticket] = (plate, type, slot, time)
        self.parked[plate] = ticket
        return ticket

    # Own size before bigger sizes, then floors in order, then slot number.
    # VIP vehicles try VIP slots first; normal vehicles never use them.
    def find_slot(self, type, vip):
        sizes = SIZES[SIZES.index(type):]
        for want_vip in ([True, False] if vip else [False]):
            for size in sizes:
                for s in self.slots:
                    if s.plate is None and s.size == size and s.vip == want_vip:
                        return s
        return None

    def leave(self, ticket, time):
        if ticket not in self.tickets:
            raise ValueError("Unknown or used ticket")
        plate, type, slot, entry = self.tickets[ticket]
        if not whole(time) or time < entry:
            raise ValueError("Exit can't be before entry")
        hours = max(1, math.ceil((time - entry) / 60))
        fee = sum(self.pricing.rate_at(type, entry + h * 60) for h in range(hours))
        slot.plate = None
        del self.tickets[ticket]
        del self.parked[plate]
        return fee

    def free_slots(self, size):
        if size not in SIZES:
            raise ValueError("Unknown size")
        return sum(1 for s in self.slots if s.size == size and s.plate is None)

    def where_is(self, plate):
        ticket = self.parked.get(plate)
        return self.tickets[ticket][2].id if ticket else None

    # Extension: weekend rates wrap the normal pricing; nothing else changes.
    def set_weekend_rate(self, type, per_hour):
        if type not in SIZES or not whole(per_hour) or per_hour < 0:
            raise ValueError("Bad rate")
        self.weekend = {**self.weekend, type: per_hour}
        self.pricing = WeekendPricing(HourlyPricing(RATES), self.weekend)
`,
  },
  scenarios: [
    {
      name: "Park a car and leave",
      stage: "core",
      visible: true,
      steps: [
        { call: "addFloor", args: ["G", { bike: 1, car: 2, truck: 1 }] },
        { call: "park", args: ["KA01", "car", 0], expect: "T1" },
        { call: "whereIs", args: ["KA01"], expect: "G-C1" },
        { call: "freeSlots", args: ["car"], expect: 1 },
        { call: "leave", args: ["T1", 90], expect: 100, note: "90 minutes is 2 started hours at ₹50" },
        { call: "freeSlots", args: ["car"], expect: 2 },
        { call: "whereIs", args: ["KA01"], expect: null },
      ],
    },
    {
      name: "Own size first, then the next size up",
      stage: "core",
      visible: true,
      steps: [
        { call: "addFloor", args: ["G", { bike: 1, car: 1, truck: 1 }] },
        { call: "park", args: ["B1", "bike", 0], expect: "T1" },
        { call: "park", args: ["B2", "bike", 0], expect: "T2" },
        { call: "whereIs", args: ["B2"], expect: "G-C1", note: "no bike slot left, so the next size up" },
        { call: "park", args: ["C1", "car", 0], expect: "T3" },
        { call: "whereIs", args: ["C1"], expect: "G-T1" },
        { call: "park", args: ["TR1", "truck", 0], throws: true },
        { call: "park", args: ["C2", "car", 0], throws: true },
        { call: "freeSlots", args: ["truck"], expect: 0 },
      ],
    },
    {
      name: "Fees round up to the hour, minimum one",
      stage: "core",
      visible: true,
      steps: [
        { call: "addFloor", args: ["G", { bike: 2, car: 1, truck: 1 }] },
        { call: "park", args: ["C1", "car", 100] },
        { call: "leave", args: ["T1", 100], expect: 50, note: "a zero-minute stay is still one hour" },
        { call: "park", args: ["B1", "bike", 0] },
        { call: "leave", args: ["T2", 60], expect: 20 },
        { call: "park", args: ["B2", "bike", 0] },
        { call: "leave", args: ["T3", 61], expect: 40 },
        { call: "park", args: ["TR", "truck", 0] },
        { call: "leave", args: ["T4", 179], expect: 300 },
      ],
    },
    {
      name: "Floors fill in the order they were added",
      stage: "core",
      steps: [
        { call: "addFloor", args: ["G", { car: 1 }] },
        { call: "addFloor", args: ["L1", { car: 2 }] },
        { call: "park", args: ["A", "car", 0] },
        { call: "park", args: ["B", "car", 0] },
        { call: "park", args: ["C", "car", 0] },
        { call: "whereIs", args: ["C"], expect: "L1-C2" },
        { call: "leave", args: ["T1", 30], expect: 50 },
        { call: "park", args: ["D", "car", 30], expect: "T4" },
        { call: "whereIs", args: ["D"], expect: "G-C1", note: "the ground floor's slot is free again, and G was added first" },
      ],
    },
    {
      name: "A car prefers a car slot on a later floor over a truck slot on an earlier one",
      stage: "core",
      steps: [
        { call: "addFloor", args: ["G", { truck: 1 }] },
        { call: "addFloor", args: ["L1", { car: 1 }] },
        { call: "park", args: ["A", "car", 0] },
        { call: "whereIs", args: ["A"], expect: "L1-C1" },
        { call: "park", args: ["B", "car", 0] },
        { call: "whereIs", args: ["B"], expect: "G-T1" },
      ],
    },
    {
      name: "Bad input is rejected and changes nothing",
      stage: "core",
      steps: [
        { call: "addFloor", args: ["G", { car: 1 }] },
        { call: "addFloor", args: ["G", { car: 1 }], throws: true },
        { call: "addFloor", args: ["", { car: 1 }], throws: true },
        { call: "addFloor", args: ["X", { boat: 1 }], throws: true },
        { call: "addFloor", args: ["Y", { car: 2, truck: -1 }], throws: true },
        { call: "addFloor", args: ["Y", { car: 1 }], note: "the failed Y must not have been half-added" },
        { call: "freeSlots", args: ["car"], expect: 2 },
        { call: "park", args: ["A", "boat", 0], throws: true },
        { call: "park", args: ["A", "car", 0], expect: "T1" },
        { call: "park", args: ["A", "car", 5], throws: true },
        { call: "park", args: ["", "car", 5], throws: true },
        { call: "leave", args: ["T9", 10], throws: true },
        { call: "leave", args: ["T1", -5], throws: true },
        { call: "freeSlots", args: ["car"], expect: 1 },
        { call: "freeSlots", args: ["boat"], throws: true },
        { call: "leave", args: ["T1", 60], expect: 50 },
        { call: "leave", args: ["T1", 70], throws: true },
      ],
    },
    {
      name: "Ticket numbers keep counting",
      stage: "core",
      steps: [
        { call: "addFloor", args: ["G", { car: 1 }] },
        { call: "park", args: ["A", "car", 0], expect: "T1" },
        { call: "park", args: ["B", "car", 0], throws: true },
        { call: "leave", args: ["T1", 10] },
        { call: "park", args: ["B", "car", 10], expect: "T2", note: "the refused park didn't use up a number, and T1 isn't reused" },
      ],
    },
    {
      name: "A truck only fits a truck slot",
      stage: "core",
      steps: [
        { call: "addFloor", args: ["G", { bike: 3, car: 3 }] },
        { call: "park", args: ["TR", "truck", 0], throws: true },
        { call: "freeSlots", args: ["truck"], expect: 0 },
        { call: "freeSlots", args: ["car"], expect: 3 },
        { call: "whereIs", args: ["TR"], expect: null },
      ],
    },
    {
      name: "Weekend rates",
      stage: "extension",
      visible: true,
      steps: [
        { call: "addFloor", args: ["G", { car: 2 }] },
        { call: "setWeekendRate", args: ["car", 80] },
        { call: "park", args: ["A", "car", at(4, 23)] },
        { call: "leave", args: ["T1", at(5, 1, 30)], expect: 210, note: "Fri 23:00 (₹50), Sat 00:00 (₹80), Sat 01:00 (₹80)" },
        { call: "park", args: ["B", "car", at(2, 10)] },
        { call: "leave", args: ["T2", at(2, 12)], expect: 100, note: "a Wednesday: normal rate" },
      ],
    },
    {
      name: "A VIP floor",
      stage: "extension",
      visible: true,
      steps: [
        { call: "addFloor", args: ["G", { car: 1 }] },
        { call: "addFloor", args: ["V", { car: 1 }, true] },
        { call: "park", args: ["N1", "car", 0], expect: "T1" },
        { call: "whereIs", args: ["N1"], expect: "G-C1" },
        { call: "park", args: ["N2", "car", 0], throws: true, note: "the only free slot is VIP" },
        { call: "park", args: ["V1", "car", 0, true], expect: "T2" },
        { call: "whereIs", args: ["V1"], expect: "V-C1" },
        { call: "park", args: ["V2", "car", 0, true], throws: true },
        { call: "freeSlots", args: ["car"], expect: 0 },
      ],
    },
    {
      name: "VIP vehicles use a normal slot when the VIP floor is full",
      stage: "extension",
      steps: [
        { call: "addFloor", args: ["V", { car: 1 }, true] },
        { call: "addFloor", args: ["G", { bike: 1, car: 2 }] },
        { call: "park", args: ["V1", "car", 0, true] },
        { call: "park", args: ["V2", "car", 0, true] },
        { call: "whereIs", args: ["V1"], expect: "V-C1" },
        { call: "whereIs", args: ["V2"], expect: "G-C1" },
        { call: "park", args: ["VB", "bike", 0, true] },
        { call: "whereIs", args: ["VB"], expect: "G-B1", note: "no VIP bike or bigger VIP slot is free, so normal slots, own size first" },
      ],
    },
    {
      name: "Each hour uses the rate of the day it starts on",
      stage: "extension",
      steps: [
        { call: "addFloor", args: ["G", { bike: 1, car: 1 }] },
        { call: "setWeekendRate", args: ["car", 70] },
        { call: "park", args: ["A", "car", at(6, 23, 30)] },
        { call: "leave", args: ["T1", at(7, 0, 30)], expect: 70, note: "one hour, starting on Sunday" },
        { call: "park", args: ["B", "car", at(6, 23, 30)] },
        { call: "leave", args: ["T2", at(7, 0, 31)], expect: 120, note: "Sunday 23:30 (₹70), then Monday 00:30 (₹50)" },
        { call: "park", args: ["C", "bike", at(13, 9)] },
        { call: "leave", args: ["T3", at(13, 11)], expect: 40, note: "a Sunday a week later; bikes have no weekend rate yet" },
      ],
    },
    {
      name: "Weekend rates are validated, and can change",
      stage: "extension",
      steps: [
        { call: "addFloor", args: ["G", { car: 1 }] },
        { call: "setWeekendRate", args: ["boat", 10], throws: true },
        { call: "setWeekendRate", args: ["car", -1], throws: true },
        { call: "setWeekendRate", args: ["car", 1.5], throws: true },
        { call: "setWeekendRate", args: ["car", 90] },
        { call: "setWeekendRate", args: ["car", 60] },
        { call: "park", args: ["A", "car", at(5, 9)] },
        { call: "leave", args: ["T1", at(5, 10)], expect: 60 },
      ],
    },
  ],
  generated: [
    { name: "A busy day: 3 floors, 2,000 arrivals, departures and lookups", stage: "core", limitMs: 3000, gen: (r) => busyDay(r, 2000, false) },
    { name: "A busy weekend with a VIP floor", stage: "extension", limitMs: 3000, gen: (r) => busyDay(r, 2000, true) },
  ],
  mutants: [
    { name: "Rounds hours down instead of up", from: "Math.ceil((time - t.entry) / 60)", to: "Math.floor((time - t.entry) / 60)" },
    { name: "Takes the biggest slot that fits first", from: "SIZES.slice(SIZES.indexOf(type))", to: "SIZES.slice(SIZES.indexOf(type)).reverse()" },
    { name: "Forgets which floors exist", from: "    this.floors.add(floor);\n", to: "" },
    { name: "Prices weekends by the day you leave", from: "this.pricing.rateAt(t.type, t.entry + h * 60)", to: "this.pricing.rateAt(t.type, time)" },
    { name: "Lets anyone use VIP slots", from: "s.vip === wantVip", to: "(s.vip === wantVip || !wantVip)" },
  ],
  hints: [
    "Start from the questions the lot must answer: which slot does this vehicle get, how much does this stay cost, and is this slot free? Each suggests one small piece of state.",
    "Keep every slot in one list, in the order floors and sizes were added; finding a slot is then a scan in a fixed order. Keep tickets in a map. Put pricing behind one method so a new rule doesn't touch leave().",
    "park: validate, find the slot (own size, then bigger; floors in order), then write the ticket. leave: validate, count hours as max(1, ceil(minutes ÷ 60)), add each hour's rate, then free the slot. For weekends, ask the pricing object for the rate at each hour's start minute.",
  ],
  review: [
    "Pricing lives behind one method (a strategy), so weekend rates were a new class, not an if in leave().",
    "The slot-choosing rule is in one function, and its order (size, floor, number) is easy to read.",
    "Every input is checked before any state changes, so a refused call leaves nothing behind.",
    "Money is whole rupees and time is whole minutes; no dates or floats.",
    "Names say what things are (slot, ticket, rateAt), and no method is longer than about 20 lines.",
    "You could demo it: a short script that adds floors, parks a few vehicles, prints where they are, and charges them.",
  ],
  walkthrough: {
    design:
      "Model only what the questions need: slots (with their size, VIP flag and the plate in them), tickets (plate, type, slot, entry time), and a map from plate to ticket. Keeping every slot in one list, in the order they were added, makes the allocation rule a plain scan: own size, then bigger sizes, in that order. Pricing is the part an interviewer will change, so leave() asks a pricing object for the rate at the start of each charged hour. Weekend pricing then wraps the normal pricing, and VIP is one more condition in the same scan.",
    classes: [
      { name: "ParkingLot", role: "Public API: validates, allocates slots, issues and redeems tickets." },
      { name: "HourlyPricing / WeekendPricing", role: "Strategy: the rate for a vehicle type at a given minute. Weekend pricing decorates the hourly one." },
      { name: "slots (list) and tickets (map)", role: "The only state: slot order encodes the allocation rule; tickets hold what leave() needs." },
    ],
    tradeoffs: [
      "A linear scan over slots is simple and fast enough for a few thousand slots. For very large lots, keep a free list (or a heap) per size and floor so parking is O(log n).",
      "Pricing each hour separately handles rates that change mid-stay, at the cost of a loop; fine for stays of a few days.",
      "Tickets are removed when used, so a used ticket and an unknown one give the same error. Keep a history if receipts or disputes matter.",
      "With several entry gates parking at once, the find-then-take step must be atomic: a lock around it, or a compare-and-set on the slot.",
    ],
    followUps: [
      "Electric-vehicle charging slots with their own rate.",
      "Reservations: hold a slot for a vehicle arriving later.",
      "Lost ticket: charge a flat day rate and look the vehicle up by plate.",
      "Make it safe for many gates at once.",
    ],
  },
};
