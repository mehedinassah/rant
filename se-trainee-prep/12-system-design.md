# Topic 12 — Basic System Design

> 🏢 **Why it matters:** Trainee MCQs only test **basic** system-design vocabulary — scaling, load balancing, caching, database types. 1–3 conceptual questions. You won't design Twitter; you must recognize the terms.

## Core vocabulary

**Scalability — the key distinction:**
```
Vertical scaling (scale UP)   = bigger machine (more CPU/RAM). Simple, has a ceiling.
Horizontal scaling (scale OUT)= more machines. Harder, but near-limitless + fault-tolerant.
```
🧠 **Vertical = upgrade one server; Horizontal = add more servers.**

**Load balancer** — distributes traffic across multiple servers for **scalability + availability**; health-checks and removes dead servers. Algorithms: round robin, least connections.

**Caching** — store frequently-used data in fast memory (e.g., **Redis, Memcached**) to reduce DB load and latency. Trade-off: **stale data**. Cache invalidation is famously hard.

**Database scaling:**
- **Replication**: copy data to multiple servers (read scaling, availability). Master-slave / primary-replica.
- **Sharding/Partitioning**: split data across servers by key (write scaling).
- **CDN** (Content Delivery Network): caches static content near users geographically.

**Availability terms:**
- **Latency** (delay) vs **Throughput** (requests/second).
- **High availability**: redundancy, no single point of failure.
- **Fault tolerance**: system keeps working despite component failures.

## CAP theorem (occasionally asked)

A distributed system can guarantee at most **2 of 3**: **C**onsistency, **A**vailability, **P**artition tolerance. Since network partitions happen, you effectively choose **CP** or **AP**.
🧠 **Consistency, Availability, Partition tolerance — pick 2.**

## Architecture styles

- **Monolith** = one deployable unit (simple, but scales as a whole).
- **Microservices** = many small independent services (scalable, complex, network overhead).
- **Stateless services** scale horizontally easily (no per-server session).

## Common patterns to recognize

- **Message queue** (Kafka, RabbitMQ) — decouples producers/consumers, handles spikes asynchronously.
- **Rate limiting** — cap requests per client (protect against abuse; returns 429).
- **API gateway / reverse proxy** — single entry point in front of services.

## Common mistakes & tricks

- ❌ "Vertical scaling = more servers" → that's **horizontal**.
- ❌ "Caching guarantees fresh data" → risk of **stale** data.
- ❌ "CAP lets you have all three" → at most **two**.
- 🧠 **Scale out = horizontal = more boxes = fault tolerant.**
- 🧠 **Cache = speed; Load balancer = spread; Replication = read/availability; Sharding = write scaling.**

## 📄 Cheat sheet
```
Vertical scaling=bigger machine | Horizontal scaling=more machines(fault tolerant)
Load balancer=spread traffic+health checks | Cache(Redis)=fast reads, risk stale
Replication=copies(read/availability) | Sharding=split by key(write scaling)
CDN=static content near users | Latency=delay, Throughput=rate
CAP: pick 2 of Consistency/Availability/Partition-tolerance
Monolith(1 unit) vs Microservices(many, complex) | Stateless scales easily
Message queue=async decouple | Rate limit→429 | API gateway=single entry
```

---

## MCQs — attempt, then check key

**Beginner (1–12)**
1. Adding more servers is called: a) vertical scaling b) horizontal scaling c) caching d) sharding
2. Upgrading one server's CPU/RAM is: a) horizontal b) vertical scaling c) replication d) sharding
3. A load balancer's main job: a) store data b) distribute traffic across servers c) encrypt d) cache pages
4. Which is a caching system? a) MySQL b) Redis c) Kafka d) Nginx
5. Caching mainly reduces: a) security b) latency and DB load c) redundancy d) accuracy
6. CAP theorem: you can guarantee at most: a) 1 b) 2 of 3 c) all 3 d) 4
7. A CDN caches content: a) in the database b) near users geographically c) in the CPU d) in RAM only
8. Microservices are: a) one big unit b) many small independent services c) a database d) a cache
9. Replication copies data for: a) write scaling only b) read scaling + availability c) encryption d) sharding
10. Sharding splits data to improve: a) reads only b) write scaling c) caching d) security
11. Stateless services scale: a) poorly b) easily horizontally c) only vertically d) never
12. Which returns HTTP 429? a) load balancing b) rate limiting c) caching d) sharding

**Intermediate (13–20)**
13. The main downside of caching is: a) slower reads b) stale/inconsistent data c) more DB load d) higher latency
14. Message queues (Kafka/RabbitMQ) provide: a) synchronous calls b) async decoupling of producers/consumers c) caching d) load balancing only
15. Which improves availability by removing single points of failure? a) monolith b) redundancy c) caching d) sharding
16. Throughput measures: a) delay b) requests per second c) storage d) bandwidth cost
17. CP vs AP systems choose to sacrifice: A for CP means giving up: a) consistency b) availability c) partition tolerance d) performance
18. Horizontal scaling is preferred for large systems because it is: a) simpler b) near-limitless + fault-tolerant c) cheaper always d) stateful
19. An API gateway acts as: a) a database b) a single entry point/reverse proxy c) a cache only d) a message queue
20. Monolith vs microservices: microservices add: a) simplicity b) network/operational complexity c) one deploy unit d) no scaling

### ✅ Answer Key — Topic 12
1-b · 2-b · 3-b · 4-b · 5-b · 6-b · 7-b · 8-b · 9-b · 10-b · 11-b · 12-b · 13-b · 14-b · 15-b · 16-b · 17-b · 18-b · 19-b · 20-b

**Key explanations:** **6** CAP → at most 2 of 3. **13** Caching risks serving stale data (invalidation problem). **17** CP sacrifices Availability during a partition to stay consistent. **18** Horizontal scaling adds machines → fault tolerance + near-limitless growth.
