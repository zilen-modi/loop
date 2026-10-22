// Frequently asked design and behavioural questions. Each lists what the interviewer is really
// checking and the points a strong answer covers, and links to the Loop chapter that teaches it.

export type DesignQuestion = {
  id: string;
  title: string;
  tests: string;
  cover: string[];
  chapter: number;
  tag?: string;
};

export const lldQuestions: DesignQuestion[] = [
  { id: "lld-parking", title: "Parking lot", chapter: 14, tests: "Modelling entities and rules cleanly; extensibility for new vehicle and spot types.", cover: ["Spot types and allocation strategy (Strategy pattern)", "Entry/exit with tickets and fees", "Concurrency when two cars grab the last spot", "Adding EV charging without rewriting"] },
  { id: "lld-splitwise", title: "Splitwise (expense sharing)", chapter: 15, tests: "Domain modelling, split strategies and balance simplification.", cover: ["Equal, exact and percentage splits", "Balances per pair and simplifying debts", "Rounding: 100 split three ways", "Groups and settle-up history"] },
  { id: "lld-elevator", title: "Elevator system", chapter: 16, tests: "State machines and scheduling under concurrent requests.", cover: ["Elevator states and direction", "Dispatching strategy (nearest, SCAN)", "Handling requests from inside and outside", "Thread safety of the request queue"] },
  { id: "lld-booking", title: "Movie ticket booking (BookMyShow)", chapter: 17, tests: "Seat locking under contention and clean booking flow.", cover: ["Shows, screens, seats and pricing", "Temporary seat holds with expiry", "Preventing double booking (locks or optimistic versioning)", "Payment failure and release"] },
  { id: "lld-snake", title: "Snake and ladder", chapter: 18, tests: "Game loop, turn handling and configurable boards.", cover: ["Board, snakes, ladders, dice as objects", "Turn rotation and win condition", "Pluggable dice (strategy)", "Validating the board setup"] },
  { id: "lld-tictactoe", title: "Tic-tac-toe / chess", chapter: 18, tests: "Separating rules, board state and players.", cover: ["O(1) win detection for tic-tac-toe", "Move validation per piece (chess)", "Undo with a command history", "N×N boards"] },
  { id: "lld-ratelimiter", title: "Rate limiter", chapter: 19, tests: "Algorithm choice and thread-safe counters.", cover: ["Token bucket vs fixed and sliding window", "Per-user and per-endpoint limits", "Thread safety", "Configuration without code changes"] },
  { id: "lld-lru", title: "LRU and LFU cache", chapter: 20, tests: "Data-structure design with O(1) operations.", cover: ["Hash map + doubly linked list for LRU", "Frequency buckets for LFU", "Capacity and eviction", "Thread-safe wrapper"] },
  { id: "lld-vending", title: "Vending machine", chapter: 21, tests: "State pattern and money handling.", cover: ["States: idle, has money, dispensing", "Change-making and inventory", "Cancel and refund", "Admin restock"] },
  { id: "lld-food", title: "Food ordering and delivery", chapter: 22, tests: "Order lifecycle, multiple actors and notifications.", cover: ["Restaurants, menus, carts, orders", "Order states and transitions", "Assigning delivery partners", "Notifying each party (observer)"] },
  { id: "lld-ride", title: "Ride sharing (Uber/Ola)", chapter: 23, tests: "Matching and pricing as replaceable strategies.", cover: ["Riders, drivers, trips", "Matching strategy (nearest, rating)", "Surge pricing strategy", "Trip states and cancellation"] },
  { id: "lld-pubsub", title: "Logger, pub-sub and notifications", chapter: 24, tests: "Decoupling producers and consumers; delivery guarantees.", cover: ["Topics, publishers, subscribers", "Log levels and sinks (chain of responsibility)", "Retries and dead letters", "Async delivery with a queue"] },
  { id: "lld-kv", title: "In-memory key-value store with TTL and transactions", chapter: 25, tests: "Correctness of nested transactions and expiry.", cover: ["get/set/delete with TTL", "Lazy vs active expiry", "Begin/commit/rollback, nested", "Concurrency"] },
  { id: "lld-scheduler", title: "Task scheduler with retries", chapter: 26, tests: "Priority queues, time and failure handling.", cover: ["One-off and recurring jobs", "Priority queue by next run time", "Retries with backoff", "Worker pool and shutdown"] },
  { id: "lld-cart", title: "Cart, inventory and coupons", chapter: 27, tests: "Rules that change often, kept extensible.", cover: ["Cart and line items", "Coupon rules as composable strategies", "Inventory reservation", "Price calculation order"] },
  { id: "lld-orderbook", title: "Stock exchange order book", chapter: 28, tests: "Matching engine correctness and data structures.", cover: ["Buy and sell books (heaps or sorted maps)", "Price-time priority", "Partial fills", "Cancel and modify"] },
  { id: "lld-fs", title: "In-memory file system / text editor with undo", chapter: 29, tests: "Composite and command patterns.", cover: ["Files and folders as a composite", "Path parsing (mkdir -p, ls)", "Undo/redo via command history", "Search by name"] },
  { id: "fe-autocomplete", title: "Autocomplete / typeahead", chapter: 31, tag: "Frontend", tests: "Async state, debouncing and accessibility.", cover: ["Debounce and cancel stale requests", "Caching results", "Keyboard navigation and ARIA combobox", "Highlighting matches"] },
  { id: "fe-infinite", title: "Infinite scroll and virtualised list", chapter: 32, tag: "Frontend", tests: "Performance with large lists.", cover: ["IntersectionObserver for loading", "Windowing to render only visible rows", "Loading and error states", "Preserving scroll position"] },
  { id: "fe-kanban", title: "Kanban board with drag and drop", chapter: 33, tag: "Frontend", tests: "State modelling and interaction design.", cover: ["Normalised board state", "Drag and drop (pointer + keyboard)", "Optimistic updates", "Persisting order"] },
  { id: "fe-form", title: "Form builder with validation", chapter: 34, tag: "Frontend", tests: "Config-driven UI and validation design.", cover: ["Schema to fields", "Sync and async validation", "Error messages and focus", "Conditional fields"] },
  { id: "fe-widgets", title: "Accessible modal, tabs and carousel", chapter: 35, tag: "Frontend", tests: "Accessibility and focus management.", cover: ["Focus trap and restore", "ARIA roles and keyboard support", "Reduced motion", "Composable API"] },
  { id: "fe-table", title: "Data table: sort, filter, paginate", chapter: 36, tag: "Frontend", tests: "Derived state and performance.", cover: ["Derived rows from sort/filter/page state", "Stable sorting", "Server vs client pagination", "Column configuration"] },
  { id: "fe-tree", title: "Nested comments / file explorer", chapter: 37, tag: "Frontend", tests: "Recursive components and tree updates.", cover: ["Recursive rendering", "Immutable tree updates", "Expand/collapse state", "Lazy loading children"] },
  { id: "fe-polyfills", title: "Debounce, throttle, Promise.all, event emitter", chapter: 38, tag: "Frontend", tests: "Core JavaScript fluency.", cover: ["Closures and timers", "this and arguments forwarding", "Promise ordering and rejection", "Edge cases: leading/trailing calls"] },
];

export const hldQuestions: DesignQuestion[] = [
  { id: "hld-url", title: "URL shortener", chapter: 22, tests: "End-to-end basics: API, IDs, storage, caching, scale.", cover: ["ID generation (base62 counter vs hash)", "Read-heavy caching and redirects (301 vs 302)", "Analytics without slowing redirects", "Custom aliases and expiry"] },
  { id: "hld-pastebin", title: "Pastebin", chapter: 23, tests: "Blob storage vs metadata, expiry.", cover: ["Object storage for content, DB for metadata", "Expiry and cleanup", "Rate limiting abuse", "CDN for popular pastes"] },
  { id: "hld-ratelimit", title: "Distributed rate limiter", chapter: 24, tests: "Algorithms across many servers.", cover: ["Token bucket in Redis with atomic scripts", "Sliding window counters", "Where to enforce (gateway vs service)", "Failing open vs closed"] },
  { id: "hld-notify", title: "Notification system", chapter: 25, tests: "Fan-out, channels, reliability.", cover: ["Push, SMS, email providers behind one API", "Queues per channel and retries", "User preferences and rate limits", "Deduplication and templates"] },
  { id: "hld-feed", title: "News feed (Twitter/Instagram)", chapter: 26, tests: "Fan-out trade-offs and ranking.", cover: ["Fan-out on write vs read, hybrid for celebrities", "Feed cache per user", "Ranking pipeline", "Pagination with cursors"] },
  { id: "hld-chat", title: "Chat and presence (WhatsApp)", chapter: 27, tests: "Real-time delivery and ordering.", cover: ["WebSocket gateways and routing", "Message storage and ordering per chat", "Delivery and read receipts", "Presence with heartbeats; group fan-out"] },
  { id: "hld-video", title: "Video streaming (YouTube/Netflix)", chapter: 28, tests: "Upload pipeline and global delivery.", cover: ["Chunked upload and transcoding pipeline", "Adaptive bitrate (HLS/DASH)", "CDN and edge caching", "Metadata and recommendations"] },
  { id: "hld-ride", title: "Ride hailing (Uber)", chapter: 29, tests: "Geo-indexing and real-time matching.", cover: ["Driver location updates at scale", "Geo index (geohash, quadtree, H3)", "Matching and dispatch", "Trip state machine and payments"] },
  { id: "hld-food", title: "Food delivery (Swiggy/Zomato)", chapter: 30, tests: "Three-sided marketplace flows.", cover: ["Search and restaurant availability", "Order pipeline and ETA", "Partner assignment", "Peak-hour load (Friday 8 pm)"] },
  { id: "hld-tickets", title: "Ticket booking (BookMyShow)", chapter: 31, tests: "High contention on scarce inventory.", cover: ["Seat holds with TTL", "Consistency: no double booking", "Virtual waiting room for spikes", "Payment timeouts"] },
  { id: "hld-payments", title: "Payments and ledger (UPI/Stripe)", chapter: 32, tests: "Correctness over everything: idempotency and money.", cover: ["Idempotency keys", "Double-entry ledger", "State machine with external providers", "Reconciliation and retries"] },
  { id: "hld-typeahead", title: "Search autocomplete", chapter: 33, tests: "Low-latency prefix lookups.", cover: ["Trie or prefix index", "Top-k per prefix, precomputed", "Updating from query logs", "Client debounce and caching"] },
  { id: "hld-crawler", title: "Web crawler", chapter: 34, tests: "Distributed work with politeness.", cover: ["URL frontier and prioritisation", "Politeness per host and robots.txt", "Deduplication of URLs and content", "Fault tolerance"] },
  { id: "hld-kv", title: "Distributed key-value store", chapter: 35, tests: "Partitioning, replication and consistency.", cover: ["Consistent hashing", "Replication and quorums (R + W > N)", "Conflict resolution", "Failure detection and hinted handoff"] },
  { id: "hld-docs", title: "Collaborative editing (Google Docs)", chapter: 36, tests: "Concurrent edits converging.", cover: ["OT vs CRDTs", "Document sessions and WebSockets", "Presence and cursors", "Snapshots and history"] },
  { id: "hld-metrics", title: "Metrics and logging platform", chapter: 37, tests: "Write-heavy ingestion and querying.", cover: ["Ingestion through a stream (Kafka)", "Time-series storage and downsampling", "Retention tiers", "Alerting"] },
  { id: "hld-leaderboard", title: "Real-time leaderboard", chapter: 38, tests: "Ranking at scale.", cover: ["Sorted sets (Redis ZSET)", "Sharding by score range or game", "Top-k vs a player's rank", "Ties and resets"] },
  { id: "hld-flash", title: "Flash sale (e-commerce)", chapter: 39, tests: "Spiky traffic on limited stock.", cover: ["Queue-based admission", "Atomic stock decrement", "Bot protection", "Graceful degradation"] },
  { id: "hld-jobs", title: "Distributed job scheduler", chapter: 40, tests: "Exactly-once-ish execution and recovery.", cover: ["Storing schedules", "Leasing jobs to workers", "Retries and idempotent jobs", "Leader election"] },
  { id: "hld-drive", title: "File storage and sync (Dropbox)", chapter: 13, tests: "Chunking, deduplication and sync.", cover: ["Chunking and content hashes", "Metadata service vs block storage", "Sync conflicts", "Offline clients"] },
  { id: "hld-nearby", title: "Nearby places (Yelp)", chapter: 29, tests: "Read-heavy geo queries.", cover: ["Geohash or quadtree index", "Caching popular areas", "Ranking by distance and rating", "Updating place data"] },
  { id: "fe-design-feed", title: "Frontend: news feed client", chapter: 44, tag: "Frontend", tests: "Client architecture and performance.", cover: ["Rendering strategy and data fetching", "Normalised client cache", "Virtualised infinite list", "Optimistic interactions and offline"] },
  { id: "ai-rag", title: "RAG search over company documents", chapter: 46, tag: "AI systems", tests: "Retrieval quality, latency and cost trade-offs.", cover: ["Chunking and embeddings", "Vector index plus keyword (hybrid) search", "Reranking and citations", "Evaluation and hallucination handling"] },
  { id: "ai-gateway", title: "LLM gateway", chapter: 47, tag: "AI systems", tests: "Running models reliably and affordably.", cover: ["Routing between models", "Caching and rate limits per tenant", "Fallbacks and timeouts", "Cost tracking and guardrails"] },
  { id: "ai-agents", title: "Agent orchestration system", chapter: 47, tag: "AI systems", tests: "Tool use with safety and observability.", cover: ["Tool registry and permissions", "Step limits and human approval", "State and memory", "Tracing and evaluation"] },
];

export type BehavioralQuestion = { id: string; question: string; assesses: string; tip: string };

export const behavioralQuestions: BehavioralQuestion[] = [
  { id: "b-intro", question: "Tell me about yourself.", assesses: "Communication and how your experience fits this role.", tip: "Present, past, future in about 90 seconds; end on why this role." },
  { id: "b-proud", question: "Tell me about a project you're proud of.", assesses: "Ownership, depth and impact.", tip: "Your part specifically, one hard decision, and a measurable result." },
  { id: "b-hard-bug", question: "Tell me about the hardest technical problem you've solved.", assesses: "Problem-solving and persistence.", tip: "Show how you narrowed it down, not just the fix." },
  { id: "b-conflict", question: "Tell me about a disagreement with a teammate.", assesses: "Collaboration and handling conflict.", tip: "Disagree on ideas, not people; show the outcome and what you learned." },
  { id: "b-manager", question: "Tell me about a time you disagreed with your manager.", assesses: "Judgement and respectful pushback.", tip: "Bring data, propose options, commit once decided." },
  { id: "b-failure", question: "Tell me about a time you failed.", assesses: "Self-awareness and growth.", tip: "A real failure, your share of it, and what you do differently now." },
  { id: "b-deadline", question: "Tell me about a tight deadline.", assesses: "Prioritisation and trade-offs.", tip: "What you cut, who you told, and how quality was protected." },
  { id: "b-ambiguity", question: "Tell me about a time requirements were unclear.", assesses: "Handling ambiguity.", tip: "How you clarified, made assumptions explicit, and iterated." },
  { id: "b-feedback", question: "Tell me about feedback that changed how you work.", assesses: "Coachability.", tip: "Specific feedback, specific change, evidence it stuck." },
  { id: "b-mentor", question: "Tell me about helping someone grow.", assesses: "Leadership and mentoring.", tip: "Use real numbers if you have them (e.g. developers mentored)." },
  { id: "b-influence", question: "Tell me about influencing without authority.", assesses: "Persuasion across teams.", tip: "How you built agreement: data, prototypes, listening." },
  { id: "b-customer", question: "Tell me about going beyond for a user or customer.", assesses: "Customer focus.", tip: "The user's problem, your action, the measurable effect." },
  { id: "b-priority", question: "How do you prioritise when everything is urgent?", assesses: "Decision-making under pressure.", tip: "A framework (impact, urgency, effort) plus a real example." },
  { id: "b-why", question: "Why this company, and why are you leaving your current role?", assesses: "Motivation and fit.", tip: "Specific to the company; positive about your current role." },
];
