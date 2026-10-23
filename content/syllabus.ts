// The full syllabus: three books, one per track. A chapter with `available: true` has content;
// the rest are the roadmap and show as "coming soon" in the library.

export type BookId = "dsa" | "lld" | "hld";

export type ChapterRef = {
  n: number;
  title: string;
  slug?: string;
  available?: boolean;
  newFormat?: boolean; // ◆ newer interview formats
};

export type Part = { title: string; chapters: ChapterRef[] };

export type Book = {
  id: BookId;
  title: string;
  subtitle: string;
  parts: Part[];
};

const ch = (n: number, title: string, extra: Partial<ChapterRef> = {}): ChapterRef => ({ n, title, ...extra });

export const books: Book[] = [
  {
    id: "dsa",
    title: "Data structures and algorithms",
    subtitle: "Zero to hero, through the problems interviews actually ask",
    parts: [
      {
        title: "Foundations",
        chapters: [
          ch(1, "Thinking in cost"),
          ch(2, "Arrays and strings"),
          ch(3, "Hashing", { slug: "hashing" }),
          ch(4, "Recursion and the call stack"),
          ch(5, "Sorting and what it buys you"),
          ch(6, "Bit manipulation"),
          ch(7, "Maths for interviews"),
        ],
      },
      {
        title: "Core patterns",
        chapters: [
          ch(8, "Two pointers", { slug: "two-pointers" }),
          ch(9, "Sliding window", { slug: "sliding-window", available: true }),
          ch(10, "Prefix sums and difference arrays", { slug: "prefix-sums" }),
          ch(11, "Binary search, on arrays and on the answer"),
          ch(12, "Stacks and the monotonic stack"),
          ch(13, "Queues, deques and the monotonic deque"),
          ch(14, "Linked lists"),
          ch(15, "Intervals and the sweep line"),
          ch(16, "Matrix traversal"),
          ch(17, "Cyclic sort and index-as-hash"),
        ],
      },
      {
        title: "Trees and graphs",
        chapters: [
          ch(18, "Binary trees"),
          ch(19, "Binary search trees"),
          ch(20, "Heaps, top-k and two heaps"),
          ch(21, "Tries"),
          ch(22, "Graph basics"),
          ch(23, "Topological sort"),
          ch(24, "Union-find"),
          ch(25, "Shortest paths"),
          ch(26, "Minimum spanning trees"),
        ],
      },
      {
        title: "Search and optimisation",
        chapters: [
          ch(27, "Backtracking"),
          ch(28, "Greedy"),
          ch(29, "Dynamic programming I: 1-D"),
          ch(30, "Dynamic programming II: grids and strings"),
          ch(31, "Dynamic programming III: knapsack"),
          ch(32, "Dynamic programming IV: intervals, trees, bitmask, digits"),
        ],
      },
      {
        title: "Advanced",
        chapters: [
          ch(33, "Segment trees and Fenwick trees"),
          ch(34, "String algorithms"),
          ch(35, "Advanced graphs"),
          ch(36, "Designing data structures"),
        ],
      },
      {
        title: "Interview craft",
        chapters: [
          ch(37, "From constraints to approach"),
          ch(38, "Code comprehension", { newFormat: true }),
          ch(39, "Testing your own code"),
          ch(40, "Capstone: mixed sets and timed rounds"),
        ],
      },
    ],
  },
  {
    id: "lld",
    title: "Low-level design and machine coding",
    subtitle: "From clean classes to working systems in 90 minutes",
    parts: [
      {
        title: "Foundations",
        chapters: [ch(1, "OOP for interviews"), ch(2, "SOLID, through refactors"), ch(3, "Quick UML"), ch(4, "From requirements to model")],
      },
      {
        title: "Design patterns that are still used",
        chapters: [ch(5, "Creational patterns"), ch(6, "Structural patterns"), ch(7, "Behavioural patterns"), ch(8, "Anti-patterns")],
      },
      {
        title: "Machine-coding craft",
        chapters: [
          ch(9, "The 90-minute playbook", { newFormat: true, slug: "machine-coding-playbook", available: true }),
          ch(10, "Storage, repositories and services"),
          ch(11, "Validation, errors and extensibility"),
          ch(12, "Concurrency"),
          ch(13, "Testing in the round"),
        ],
      },
      {
        title: "Classic builds",
        chapters: [
          ch(14, "Parking lot", { slug: "parking-lot", available: true }),
          ch(15, "Splitwise", { slug: "splitwise", available: true }),
          ch(16, "Elevator system", { slug: "elevator", available: true }),
          ch(17, "Movie ticket booking", { slug: "movie-booking", available: true }),
          ch(18, "Board games"),
          ch(19, "Rate limiter", { slug: "rate-limiter", available: true }),
          ch(20, "LRU and LFU cache", { slug: "lru-lfu-cache", available: true }),
          ch(21, "Vending machine", { slug: "vending-machine", available: true }),
          ch(22, "Food ordering and delivery"),
          ch(23, "Ride sharing"),
          ch(24, "Logger, pub-sub and notifications"),
          ch(25, "Key-value store with TTL and transactions", { slug: "kv-store", available: true }),
          ch(26, "Task scheduler with retries"),
          ch(27, "Cart, inventory and coupons"),
          ch(28, "Stock exchange order book", { slug: "order-book", available: true }),
          ch(29, "File system and text editor"),
        ],
      },
      {
        title: "Frontend machine coding",
        chapters: [
          ch(30, "Component design"),
          ch(31, "Autocomplete"),
          ch(32, "Infinite scroll and virtualisation"),
          ch(33, "Kanban board"),
          ch(34, "Form builder"),
          ch(35, "Accessible widgets"),
          ch(36, "Data table"),
          ch(37, "Recursive UI"),
          ch(38, "JS polyfills and utilities"),
        ],
      },
    ],
  },
  {
    id: "hld",
    title: "High-level design",
    subtitle: "Systems at scale, including the AI systems interviews now ask about",
    parts: [
      {
        title: "Foundations",
        chapters: [
          ch(1, "The interview framework", { slug: "interview-framework", available: true }),
          ch(2, "Back-of-the-envelope estimation"),
          ch(3, "Networking"),
          ch(4, "APIs"),
          ch(5, "Load balancers and gateways"),
          ch(6, "Caching", { slug: "caching", available: true }),
        ],
      },
      {
        title: "Data",
        chapters: [
          ch(7, "Choosing a database"),
          ch(8, "Indexes and query performance"),
          ch(9, "Replication"),
          ch(10, "Sharding and consistent hashing"),
          ch(11, "Transactions, sagas and the outbox"),
          ch(12, "CAP, PACELC and consistency"),
          ch(13, "Object storage and media"),
          ch(14, "Search"),
        ],
      },
      {
        title: "Async and reliability",
        chapters: [
          ch(15, "Queues and streams"),
          ch(16, "Event-driven architecture"),
          ch(17, "Distributed rate limiting"),
          ch(18, "Reliability patterns"),
          ch(19, "Observability"),
          ch(20, "Security"),
          ch(21, "Scaling patterns"),
        ],
      },
      {
        title: "Classic designs",
        chapters: [
          ch(22, "URL shortener", { slug: "url-shortener", available: true }),
          ch(23, "Pastebin"),
          ch(24, "Distributed rate limiter", { slug: "distributed-rate-limiter", available: true }),
          ch(25, "Notification system", { slug: "notification-system", available: true }),
          ch(26, "News feed", { slug: "news-feed", available: true }),
          ch(27, "Chat and presence"),
          ch(28, "Video streaming"),
          ch(29, "Ride hailing"),
          ch(30, "Food delivery"),
          ch(31, "Ticket booking", { slug: "ticket-booking", available: true }),
          ch(32, "Payments and ledgers"),
          ch(33, "Search autocomplete"),
          ch(34, "Web crawler"),
          ch(35, "Distributed key-value store"),
          ch(36, "Collaborative editing"),
          ch(37, "Metrics and logging platform"),
          ch(38, "Real-time leaderboard"),
          ch(39, "Flash sale"),
          ch(40, "Distributed job scheduler"),
        ],
      },
      {
        title: "Frontend system design",
        chapters: [ch(41, "Rendering strategies"), ch(42, "State, data and real-time"), ch(43, "Performance and accessibility"), ch(44, "Frontend case studies")],
      },
      {
        title: "AI system design",
        chapters: [
          ch(45, "LLM basics for design", { newFormat: true }),
          ch(46, "RAG search", { newFormat: true }),
          ch(47, "LLM gateway and agents", { newFormat: true }),
          ch(48, "Evaluating LLM features", { newFormat: true }),
        ],
      },
    ],
  },
];

export const bookById = (id: string) => books.find((b) => b.id === id);

export function findChapter(bookId: string, slug: string) {
  const book = bookById(bookId);
  for (const part of book?.parts ?? []) {
    const c = part.chapters.find((x) => x.slug === slug);
    if (c && book) return { book, part, chapter: c };
  }
  return null;
}

export const chapterCount = (b: Book) => b.parts.reduce((n, p) => n + p.chapters.length, 0);
