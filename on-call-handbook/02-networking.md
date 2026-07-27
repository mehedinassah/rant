# Chapter 2 — Networking

> **Why this chapter matters most:** For On-Call, Support, and Cloud roles, networking *is* the job. When a service is down at 3 a.m., you're tracing a request from a browser to a server to a database, figuring out where it broke. Interviewers know this, so networking gets the most questions — and the most famous one of all lives here: *"What happens when you type google.com and press Enter?"* We'll build up to answering it perfectly.

Study the ★★★★★ topics until you can explain them to a non-technical friend. That's the bar.

---

## 2.1 The OSI Model ★★★★☆

**Definition.** The **OSI (Open Systems Interconnection) model** is a 7-layer framework describing how data moves across a network. Each layer has one job and talks only to the layers directly above and below it.

**Why it exists.** It's a shared vocabulary. When someone says "that's a Layer 7 load balancer" or "it's a Layer 4 problem," everyone instantly knows what part of the stack they mean. You rarely implement OSI directly, but you *talk* in its terms daily.

**The 7 layers (top to bottom):**

| # | Layer | Job | Real-world example |
|---|-------|-----|--------------------|
| 7 | **Application** | What the user interacts with | HTTP, DNS, SSH |
| 6 | **Presentation** | Formatting, encryption, compression | TLS/SSL, JPEG |
| 5 | **Session** | Opens/keeps/closes conversations | Sessions, sockets |
| 4 | **Transport** | Reliable/unreliable delivery, ports | **TCP, UDP** |
| 3 | **Network** | Routing between networks, addressing | **IP**, routers |
| 2 | **Data Link** | Node-to-node on the same network | Ethernet, MAC, switches |
| 1 | **Physical** | Actual bits on the wire/air | Cables, Wi-Fi radio |

> 🧠 **Memory trick (top→bottom):** **"All People Seem To Need Data Processing"** — **A**pplication, **P**resentation, **S**ession, **T**ransport, **N**etwork, **D**ata link, **P**hysical.

> 🌍 **Analogy.** Sending a letter: you write it (Application), put it in a standard envelope (Presentation), address it (Network), the post office guarantees delivery or not (Transport), trucks carry it road by road (Data Link), on physical roads (Physical).

**The layers that actually come up:** In practice, interviewers care most about **Layer 7 (Application — HTTP)**, **Layer 4 (Transport — TCP/UDP/ports)**, and **Layer 3 (Network — IP)**. If you're short on time, know those three deeply and the rest by name.

> 💬 **Interviewers usually ask:** "What layer does a load balancer / firewall / router work at?"
>
> ✅ **Model answer:** "A router works at Layer 3 — it routes by IP. A basic firewall filters at Layer 3/4 by IP and port. A load balancer can be Layer 4 (routing by IP/port, fast, no visibility into content) or Layer 7 (routing by HTTP details like URL path or headers, smarter but heavier)."

> ⚠️ **Common mistake:** Mixing up the order. Use the mnemonic. Also: TCP/UDP live at **Layer 4**, IP at **Layer 3** — a frequent slip.

---

## 2.2 TCP/IP Model ★★★☆☆

**Definition.** The **TCP/IP model** is the practical 4-layer model the actual internet runs on. It's a condensed version of OSI.

**OSI vs TCP/IP mapping:**

```
   OSI (7 layers)              TCP/IP (4 layers)
   ┌──────────────┐
   │ Application  │ ┐
   │ Presentation │ ├──────▶  Application
   │ Session      │ ┘
   ├──────────────┤
   │ Transport    │ ───────▶  Transport
   ├──────────────┤
   │ Network      │ ───────▶  Internet
   ├──────────────┤
   │ Data Link    │ ┐
   │ Physical     │ ┴──────▶  Network Access (Link)
   └──────────────┘
```

> ✅ **One-liner for interviews:** "OSI is the 7-layer *teaching* model; TCP/IP is the 4-layer *practical* model the internet actually uses. They map onto each other — OSI's top three collapse into TCP/IP's Application layer, and the bottom two into its Link layer."

---

## 2.3 TCP vs UDP ★★★★★

**One of the most-asked networking questions. Master it.**

Both are **Layer 4 (Transport)** protocols — they move data between applications. The difference is *reliability vs speed*.

### TCP — Transmission Control Protocol
**Reliable, ordered, connection-based.** It guarantees your data arrives, complete and in order, or you get an error. It does this with:
- A **3-way handshake** to set up the connection (see below).
- **Acknowledgements** — the receiver confirms each chunk; unconfirmed data is resent.
- **Ordering** — segments are numbered and reassembled in order.
- **Flow & congestion control** — slows down if the network is congested.

### UDP — User Datagram Protocol
**Fast, connectionless, "fire and forget."** No handshake, no acknowledgements, no ordering guarantees. You send packets and hope they arrive. Less overhead = lower latency.

**The 3-way handshake (TCP) — draw this:**

```
Client                          Server
  │  ─────── SYN ──────────▶      │   "Can we talk?"
  │  ◀────── SYN-ACK ───────      │   "Yes, can you hear me?"
  │  ─────── ACK ──────────▶      │   "Yes — let's go."
  │                               │
  │   ===== data flows =====      │
```

**The comparison table:**

| | **TCP** | **UDP** |
|---|---|---|
| Connection | Yes (handshake) | No |
| Reliable? | Yes — resends lost data | No — best effort |
| Ordered? | Yes | No |
| Speed | Slower (more overhead) | Faster (less overhead) |
| Use when | Correctness matters | Speed matters, some loss is OK |
| Examples | Web (HTTP/S), email, SSH, file transfer | Video calls, gaming, live streaming, DNS |

> 🌍 **Analogy.** **TCP is a phone call** — you confirm the other person is there ("Hello?" "Yes, go ahead"), and if they miss a word they say "sorry, repeat that." **UDP is shouting across a crowded room** — fast, but if they miss a word, oh well, you've moved on.

> 💬 **Interviewers usually ask:** "TCP or UDP for a live video call, and why?"
>
> ✅ **Model answer:** "UDP. In a live call, a packet that arrives late is useless — you'd rather drop it and keep the conversation real-time than stall waiting for a retransmission. A dropped frame is a tiny glitch; a two-second delay to recover it ruins the call. TCP's guarantees are the wrong trade-off here. For something like a file download, it's the opposite — you'd use TCP because every byte must be correct."

> ⚠️ **Common mistake:** Saying "UDP is unreliable so nobody uses it." It's used constantly — DNS, video, gaming, VoIP — precisely *because* speed beats guaranteed delivery there.

> 🧠 **Memory trick:** **TCP = Trusted, Careful, Perfect.** **UDP = Unreliable, Direct, Prompt.**

---

## 2.4 Ports ★★★★☆

**Definition.** A **port** is a number (0–65535) that identifies a specific application or service on a machine. The **IP address gets you to the right computer; the port gets you to the right program on it.**

**Why it exists.** One server runs many services — a website, a database, SSH — all on the same IP. Ports let the OS deliver incoming data to the correct one.

> 🌍 **Analogy.** The IP address is a building's street address; the port is the apartment number. The mail truck finds the building by address, then the specific flat by number.

**The well-known ports you MUST memorize:**

| Port | Service | Notes |
|------|---------|-------|
| **22** | SSH | Remote login |
| **25** | SMTP | Sending email |
| **53** | DNS | Name resolution (uses UDP mostly) |
| **80** | HTTP | Web (unencrypted) |
| **443** | HTTPS | Web (encrypted) — the one that matters most today |
| **3306** | MySQL | Database |
| **5432** | PostgreSQL | Database |
| **6379** | Redis | Cache |
| **27017** | MongoDB | Database |

> 💬 **Interviewers usually ask:** "What port does HTTPS use? SSH? MySQL?"
>
> ✅ **Model answer:** "HTTPS is 443, HTTP is 80, SSH is 22, DNS is 53, MySQL is 3306, PostgreSQL is 5432. The IP address routes to the machine and the port routes to the specific service on it."

> 🐧 **Linux example:** `ss -tulnp` (or `netstat -tulnp`) lists which ports are open and which process owns each — the first thing you check when "the service won't connect."

> 🧠 **Memory trick:** **22 SSH, 80 HTTP, 443 HTTPS, 53 DNS** — chant these four until automatic. They cover most questions.

---

## 2.5 DNS ★★★★★

**Extremely common, and central to the "type google.com" question.**

**Definition.** **DNS (Domain Name System)** translates human-friendly domain names (`google.com`) into machine IP addresses (`142.250.x.x`). It's often called "the phonebook of the internet."

**Why it exists.** Humans remember names; computers route by numbers. DNS bridges the two so you never have to memorize IP addresses.

**How a DNS lookup works (know this flow):**

```
You type google.com
      │
      ▼
1. Browser cache?  ── hit? done.
      │ miss
      ▼
2. OS cache?       ── hit? done.
      │ miss
      ▼
3. Recursive resolver (your ISP / 8.8.8.8)
      │
      ▼
4. Root server:  "ask the .com server" ──▶
5. TLD (.com) server: "ask Google's nameserver" ──▶
6. Authoritative server: "google.com = 142.250.1.2"
      │
      ▼
   Resolver caches it (TTL) and returns the IP to you
```

**Common record types to know:**

| Record | Maps... | Example |
|--------|---------|---------|
| **A** | name → IPv4 | google.com → 142.250.1.2 |
| **AAAA** | name → IPv6 | → 2607:f8b0::... |
| **CNAME** | name → another name (alias) | www → google.com |
| **MX** | domain → mail server | email routing |
| **NS** | domain → its nameservers | delegation |

> 🌍 **Analogy.** DNS is asking directory assistance for a phone number. You know the *name* ("Joe's Pizza"); they give you the *number* to actually call. Your phone remembers it for a while (caching) so it doesn't ask again every time.

> 💬 **Interviewers usually ask:** "Walk me through what DNS does when you visit a website."
>
> ✅ **Model answer:** "DNS turns a domain name into an IP address. Your browser first checks its own cache, then the OS cache. If it's not cached, it asks a recursive resolver — usually your ISP's or something like 8.8.8.8. The resolver walks the hierarchy: it asks a root server, which points to the `.com` TLD server, which points to the domain's authoritative nameserver, which returns the actual IP. The resolver caches the answer for its TTL so the next lookup is instant. Then your browser can finally open a connection to that IP."

> ⚠️ **Common mistake:** Thinking DNS *transfers the web page*. It only returns the **IP address**. The page comes later, over HTTP, once you have the IP.

> 🐧 **Linux example:** `dig google.com` or `nslookup google.com` performs a lookup and shows the answer. `dig +trace google.com` shows the full root → TLD → authoritative walk.

> 🧠 **Memory trick:** DNS = **"Domain Name → System that finds the number."** Phonebook. Name in, number out.

---

## 2.6 DHCP ★★★☆☆

**Definition.** **DHCP (Dynamic Host Configuration Protocol)** automatically assigns a device an IP address (plus subnet mask, gateway, and DNS server) when it joins a network — so you don't configure each device by hand.

**How it works — the DORA sequence:**

```
Device ──▶ DISCOVER  ("Is there a DHCP server? I need an IP.")
Server ──▶ OFFER     ("Here's 192.168.1.42, want it?")
Device ──▶ REQUEST   ("Yes, I'll take it.")
Server ──▶ ACK       ("It's yours, lease = 24h. Here's your gateway + DNS.")
```

> 🌍 **Analogy.** Checking into a hotel. The front desk (DHCP server) assigns you a room number (IP) for the length of your stay (lease). You don't pick your own room; when you leave, it's freed for the next guest.

> 💬 **Interviewers usually ask:** "How does your laptop get an IP address on Wi-Fi?"
>
> ✅ **Model answer:** "Through DHCP. When it joins, it broadcasts a DISCOVER, a DHCP server responds with an OFFER of an available IP, the laptop sends a REQUEST for it, and the server ACKs with a lease. That handshake — Discover, Offer, Request, Ack — also hands over the subnet mask, default gateway, and DNS server addresses. It's leased, not permanent, so it can be reclaimed."

> 🧠 **Memory trick:** **DORA** explores and finds an address — **D**iscover, **O**ffer, **R**equest, **A**ck.

---

## 2.7 HTTP ★★★★★

**Definition.** **HTTP (HyperText Transfer Protocol)** is the Application-layer (Layer 7) protocol browsers and servers use to exchange web content. It's a **request/response** protocol: the client sends a request, the server sends a response.

**Key property — HTTP is stateless.** Each request is independent; the server doesn't remember previous requests on its own. (That's *why* cookies, sessions, and tokens exist — see §2.11–2.13.)

**Anatomy of a request/response:**

```
REQUEST                          RESPONSE
GET /index.html HTTP/1.1         HTTP/1.1 200 OK
Host: example.com                Content-Type: text/html
User-Agent: Chrome               Content-Length: 1024
Accept: text/html                
                                 <html>...</html>
(method) (path) (version)        (version) (status) (body)
```

> 🌍 **Analogy.** HTTP is ordering by mail-order catalog. You send a slip saying exactly what you want (request); they mail back the item or a "sold out" notice (response). Each order is separate — the company doesn't remember you unless you include a membership card (cookie).

> 💬 **Interviewers usually ask:** "What does it mean that HTTP is stateless?"
>
> ✅ **Model answer:** "Every HTTP request is independent — the server doesn't inherently remember anything about previous requests from the same client. That keeps servers simple and scalable, but it means that to build something like a logged-in session, you need to carry state yourself, usually with a cookie holding a session ID or a token that you send with every request."

> 🧠 **Memory trick:** HTTP = **request in, response out, forgets you immediately** (stateless).

---

## 2.8 HTTPS, SSL & TLS ★★★★★

**Definition.**
- **HTTPS** = HTTP + encryption. The same HTTP, but the connection is secured.
- **TLS (Transport Layer Security)** is the protocol that does the encrypting. **SSL** is its older, now-deprecated predecessor — people still say "SSL" but mean TLS.

**What HTTPS gives you (three things):**
1. **Encryption** — eavesdroppers see scrambled data, not your password.
2. **Integrity** — data can't be tampered with in transit undetected.
3. **Authentication** — the certificate proves you're really talking to `google.com`, not an impostor.

**How the TLS handshake works (conceptually — this comes up a lot):**

```
1. Client: "Hello, here are the ciphers I support."
2. Server: "Hello, let's use this cipher. Here's my certificate."
3. Client: verifies the certificate against trusted Certificate Authorities (CAs).
4. Both: use asymmetric crypto to agree on a shared SECRET (session key).
5. From now on: fast SYMMETRIC encryption using that shared key.
```

**The key insight interviewers want:** HTTPS uses **asymmetric encryption** (slow, public/private keys) *only at the start* to safely agree on a shared **symmetric** key, then uses fast **symmetric** encryption for the actual data. Best of both worlds.

> 🌍 **Analogy.** Two people want to talk privately in public. They use a slow, secure method (asymmetric) to agree on a secret code word, then switch to speaking quickly in that code (symmetric) for the rest of the conversation. The certificate is like a government-issued ID proving one party is who they claim to be.

> 💬 **Interviewers usually ask:** "How does HTTPS work?" or "What's the difference between symmetric and asymmetric encryption in HTTPS?"
>
> ✅ **Model answer:** "HTTPS is HTTP over TLS. When you connect, there's a TLS handshake: the server presents a certificate that your browser verifies against trusted Certificate Authorities, which proves the server's identity. During the handshake they use asymmetric encryption — a public/private key pair — to securely agree on a shared session key. That asymmetric step is secure but slow, so it's only used to exchange the key. After that, both sides switch to fast symmetric encryption with the shared key for all the actual data. So you get authentication, encryption, and integrity, without the performance cost of asymmetric crypto for everything."

> ⚠️ **Common mistake:** Saying "HTTPS uses asymmetric encryption for everything." No — asymmetric is only for the handshake/key exchange; the bulk data is symmetric.

> 🧠 **Memory trick:** **A**symmetric = **A**greement on the key (once). **S**ymmetric = **S**peedy data (the rest). Certificate = **ID card**.

---

## 2.9 SSL vs TLS (quick clarity) ★★☆☆☆

> ✅ **One-liner:** "SSL is the old, insecure predecessor; TLS is its modern replacement. All SSL versions are deprecated and shouldn't be used. When people say 'SSL certificate,' they almost always mean a TLS certificate — the name just stuck."

---

## 2.10 Cookies ★★★★☆

**Definition.** A **cookie** is a small piece of data the server sends to the browser, which the browser stores and **sends back with every subsequent request** to that site. Cookies are how a stateless HTTP world remembers you.

**How it flows:**

```
1. You log in.
2. Server responds:  Set-Cookie: session_id=abc123
3. Browser stores it.
4. Every later request:  Cookie: session_id=abc123
5. Server sees the cookie → knows it's you → "Welcome back."
```

**Cookie attributes worth naming:** `HttpOnly` (JavaScript can't read it — protects against XSS), `Secure` (only sent over HTTPS), `Expires`/`Max-Age` (lifetime), `SameSite` (limits cross-site sending — CSRF protection).

> 🌍 **Analogy.** A cookie is the hand-stamp at a club. They stamp your hand on entry; every time you come back to the door, you show the stamp and they let you in without re-checking your ID.

> 💬 **Interviewers usually ask:** "What is a cookie and what is it used for?"
>
> ✅ **Model answer:** "A cookie is a small piece of data the server tells the browser to store and send back on every request to that site. Because HTTP is stateless, cookies are how the server recognizes a returning user — the classic use is holding a session ID after login so you stay logged in. Security-wise you flag them HttpOnly so JavaScript can't steal them, and Secure so they only travel over HTTPS."

> 🧠 **Memory trick:** Cookie = **the site's memory living in your browser.** Server sets it once, browser hands it back every time.

---

## 2.11 Sessions ★★★★☆

**Definition.** A **session** is server-side memory of a logged-in user. The server stores the user's data (who they are, their cart) and gives the browser only a **session ID** (usually in a cookie). On each request, the server looks up that ID to find the user's data.

**Cookie vs Session — a key distinction:**

```
COOKIE-based (data on client)      SESSION-based (data on server)
Browser holds actual data          Browser holds only an ID
                                    Server holds the real data
[user=joe; role=admin]             [session=abc] ──▶ server: {abc: joe, admin}
```

> 🌍 **Analogy.** A coat check. Instead of carrying your coat around (all the data), you get a numbered ticket (session ID). The cloakroom (server) holds the coat; you just show the ticket to get it back.

> 💬 **Interviewers usually ask:** "What's the difference between a cookie and a session?"
>
> ✅ **Model answer:** "A cookie is client-side storage in the browser; a session is server-side storage. Usually they work together: the server keeps the user's real data in a session and sends the browser a cookie containing just the session ID. On each request, the browser sends the ID back and the server looks up the session. Sessions keep sensitive data on the server, which is more secure, but they use server memory — which is why big systems sometimes move to stateless tokens like JWT instead."

> 🧠 **Memory trick:** **Cookie = client-side note. Session = server-side memory.** The cookie usually just carries the session's ticket number.

---

## 2.12 JWT (JSON Web Token) ★★★☆☆

**Definition.** A **JWT** is a self-contained, digitally-signed token that carries the user's identity and claims. Unlike a session, the server doesn't need to store anything — the token itself proves who you are because it's **signed** by the server.

**Structure — three dot-separated parts:**

```
   header . payload . signature
   eyJhbGc.eyJzdWIi.SflKxwRJ

   header    = algorithm & type
   payload   = claims (user id, role, expiry)  ← readable, NOT secret
   signature = proves it wasn't tampered with  ← only server can create
```

**Session vs JWT — the modern trade-off:**

| | **Session** | **JWT** |
|---|---|---|
| State stored | On server | In the token (stateless) |
| Scales across servers | Needs shared store | Easy — any server can verify |
| Revoke instantly | Yes (delete session) | Hard (valid until expiry) |
| Size | Tiny ID | Bigger token |

> ⚠️ **Common mistake:** Thinking a JWT is *encrypted*. By default it's **signed, not encrypted** — anyone can read the payload (it's just Base64). The signature guarantees it wasn't *changed*, not that it's *secret*. Never put passwords in a JWT payload.

> 💬 **Interviewers usually ask:** "Session vs JWT — when would you use each?"
>
> ✅ **Model answer:** "A session stores state on the server and gives the client an ID; a JWT is stateless — the token itself carries the user's identity, signed by the server so it can't be forged. JWTs shine in distributed systems and APIs because any server can verify the signature without a shared session store. The downside is you can't easily revoke a JWT before it expires, and it's larger. Sessions are easier to revoke but need a shared store to scale. Also, a JWT is signed, not encrypted, so you never put secrets in the payload."

> 🧠 **Memory trick:** JWT = **a signed ID badge you carry.** The guard doesn't need a guest list (server state) — the badge's signature proves it's genuine.

---

## 2.13 REST APIs ★★★★☆

**Definition.** **REST (Representational State Transfer)** is a style for designing web APIs around **resources** (things like users, orders) identified by URLs, manipulated with standard **HTTP methods**. A REST API is how programs talk to a server over HTTP.

**Core principles (name a couple):**
- **Resource-based URLs:** `/users/42`, not `/getUser?id=42`.
- **HTTP methods carry the action:** GET to read, POST to create, etc.
- **Stateless:** each request contains everything the server needs.
- Returns data, usually **JSON**.

**Good REST design example:**

```
GET    /users        → list all users
GET    /users/42     → get user 42
POST   /users        → create a new user
PUT    /users/42     → replace/update user 42
DELETE /users/42     → delete user 42
```

> 🌍 **Analogy.** REST is a well-organized restaurant menu. Each dish (resource) has a clear name (URL), and you use standard actions — order (GET), add (POST), change (PUT), cancel (DELETE). Everyone understands the conventions without explanation.

> 💬 **Interviewers usually ask:** "What makes an API RESTful?"
>
> ✅ **Model answer:** "It's organized around resources addressed by URLs, and it uses standard HTTP methods for actions — GET to read, POST to create, PUT to update, DELETE to remove. It's stateless, so each request carries all the context the server needs, and it typically exchanges JSON. The idea is predictability: if you know the resource, you already know how to interact with it."

> 🧠 **Memory trick:** REST = **nouns in the URL, verbs in the HTTP method.** `/users/42` + `DELETE`.

---

## 2.14 HTTP Methods ★★★★☆

The verbs. Know what each does and two properties: **safe** (read-only) and **idempotent** (repeating it has the same effect as doing it once).

| Method | Purpose | Idempotent? | Safe? |
|--------|---------|-------------|-------|
| **GET** | Read data | Yes | Yes (read-only) |
| **POST** | Create new resource | **No** (repeats create duplicates) | No |
| **PUT** | Replace/update a resource | Yes | No |
| **PATCH** | Partially update | Not necessarily | No |
| **DELETE** | Remove a resource | Yes | No |

> ⚠️ **Common mistake:** Saying POST and PUT are the same. **POST creates (not idempotent — hit it twice, get two records); PUT updates/replaces (idempotent — hit it twice, same result).** This distinction is a favorite.

> 💬 **Interviewers usually ask:** "What's the difference between PUT and POST?" or "What does idempotent mean?"
>
> ✅ **Model answer:** "POST creates a new resource and isn't idempotent — sending it twice creates two resources, which is why double-clicking 'submit' can double-charge you. PUT replaces a resource at a known URL and *is* idempotent — sending it twice leaves the same final state. Idempotent means repeating the request has no additional effect beyond the first, which matters for safe retries when a network call times out."

> 🧠 **Memory trick:** **GET reads, POST creates, PUT replaces, PATCH tweaks, DELETE removes.** POST is the odd one out — not idempotent.

---

## 2.15 HTTP Status Codes ★★★★★

**Guaranteed to come up in support/on-call interviews.** You must know the categories and the famous individual codes.

**The five categories — memorize the pattern:**

| Range | Meaning | Memory hook |
|-------|---------|-------------|
| **1xx** | Informational | "hold on" |
| **2xx** | Success | "here you go" |
| **3xx** | Redirection | "go look over there" |
| **4xx** | Client error | "**you** messed up" |
| **5xx** | Server error | "**I** messed up" |

**The specific codes you must know:**

| Code | Name | Meaning |
|------|------|---------|
| **200** | OK | Success |
| **201** | Created | Resource created (after POST) |
| **301** | Moved Permanently | Permanent redirect |
| **302** | Found | Temporary redirect |
| **304** | Not Modified | Use your cached copy |
| **400** | Bad Request | Malformed request |
| **401** | Unauthorized | You're not authenticated (log in) |
| **403** | Forbidden | Authenticated, but not allowed |
| **404** | Not Found | Resource doesn't exist |
| **429** | Too Many Requests | Rate limited |
| **500** | Internal Server Error | Generic server crash |
| **502** | Bad Gateway | Upstream server gave a bad response |
| **503** | Service Unavailable | Server overloaded / down |
| **504** | Gateway Timeout | Upstream server didn't respond in time |

> ⚠️ **Common mistake:** Confusing **401 vs 403**. **401 = "I don't know who you are"** (not authenticated — log in). **403 = "I know who you are, and you can't do this"** (authenticated but not authorized). This exact question is asked constantly.

> 💬 **Interviewers usually ask:** "Difference between 401 and 403? What does a 502 mean?"
>
> ✅ **Model answer:** "401 Unauthorized means you're not authenticated — the server doesn't know who you are, so log in. 403 Forbidden means you *are* authenticated but you don't have permission for this resource. As for 5xx codes: 500 is a generic server error, 502 Bad Gateway means a proxy or load balancer got an invalid response from the upstream server behind it, 503 means the server is unavailable or overloaded, and 504 is a gateway timeout — the upstream didn't answer in time. In on-call, a wave of 502s or 504s usually points to a backend being down or slow, not the load balancer itself."

> 🧠 **Memory trick:** **4xx = your fault (client), 5xx = server's fault.** And **401 = who are you? / 403 = no, not you.**

---

## 2.16 SSH ★★★★☆

**Definition.** **SSH (Secure Shell)** is an encrypted protocol for logging into and running commands on a remote machine over an untrusted network. Port **22**. It's how you actually get onto servers.

**Password vs key-based auth (know this):** You can log in with a password, but production uses **SSH key pairs** — a private key on your laptop and a public key on the server. You prove your identity with the private key without ever sending a password. More secure and scriptable.

```
ssh user@server.com              # log in
ssh -i mykey.pem ubuntu@1.2.3.4  # log in with a specific private key
scp file.txt user@server:/path/  # copy a file over SSH
```

> 🌍 **Analogy.** SSH key auth is a lock (public key, on the server's door) that only your specific physical key (private key, in your pocket) can open. You never hand over a copy of the key; you just prove you have it.

> 💬 **Interviewers usually ask:** "How do you securely connect to a remote server?"
>
> ✅ **Model answer:** "SSH, over port 22. It gives you an encrypted shell on the remote machine. In production you use key-based auth rather than passwords: you keep a private key locally and put the matching public key on the server, so you authenticate cryptographically without sending a password over the wire. That's both more secure and easy to automate. `scp` and `rsync` ride on top of SSH to copy files securely."

> 🧠 **Memory trick:** **SSH = Secure SHell, port 22, keys beat passwords.**

---

## 2.17 NAT ★★★☆☆

**Definition.** **NAT (Network Address Translation)** lets many devices on a private network share a single public IP address. Your router rewrites the source address of outgoing packets to its public IP, and remembers the mapping so replies get back to the right device.

**Why it exists.** There aren't enough IPv4 addresses for every device on Earth. NAT lets a whole home or office sit behind one public IP, using private ranges (like `192.168.x.x`) internally.

> 🌍 **Analogy.** NAT is a company receptionist. Outside callers all dial one public number. The receptionist (router) routes each call to the right internal extension (private IP) and remembers who's on which call so replies come back correctly.

> 💬 **Interviewers usually ask:** "How do many devices share one public IP?"
>
> ✅ **Model answer:** "NAT — Network Address Translation. Devices use private IPs internally, like 192.168.x.x. When they reach the internet, the router rewrites the source to its single public IP and keeps a table mapping each connection back to the right internal device, so responses are routed correctly. It's what lets a whole household browse the web through one public address, and it conserves the limited IPv4 space."

> 🧠 **Memory trick:** NAT = **one public face, many private people behind it** (the receptionist).

---

## 2.18 Firewall ★★★★☆

**Definition.** A **firewall** is a security barrier that controls network traffic based on rules — allowing or blocking packets by IP address, port, and protocol. It's the gatekeeper deciding what's allowed in and out.

**Default-deny principle:** good firewalls **block everything by default** and only allow explicitly permitted traffic. You open port 443 for your web server and 22 for SSH, and everything else stays shut.

> 🌍 **Analogy.** A firewall is a nightclub bouncer with a guest list. Only names/ports on the list get in; everyone else is turned away. Default-deny = "if you're not on the list, you're not coming in."

> 💬 **Interviewers usually ask:** "What does a firewall do?"
>
> ✅ **Model answer:** "It filters network traffic against a set of rules — typically by IP, port, and protocol — to allow or block connections. The best practice is default-deny: block everything, then open only the specific ports you need, like 443 for HTTPS and 22 for SSH. In the cloud, security groups are basically firewalls attached to your instances."

> 🧠 **Memory trick:** Firewall = **bouncer with a guest list. Default: not on the list = not getting in.**

---

## 2.19 Load Balancer ★★★★☆

**Definition.** A **load balancer** distributes incoming traffic across multiple backend servers, so no single server is overwhelmed. It also improves reliability — if one server dies, traffic goes to the healthy ones.

**Why it exists.** One server can't handle millions of users, and if it's your only server, it's a single point of failure. A load balancer gives you both **scalability** (spread the load) and **high availability** (survive server failures).

**Common algorithms:** **Round Robin** (rotate through servers evenly), **Least Connections** (send to the least busy), **IP Hash** (same client always to the same server).

**Layer 4 vs Layer 7:** A **L4** load balancer routes by IP/port — fast, but blind to content. An **L7** load balancer reads HTTP, so it can route by URL path or headers (e.g., `/api` → one pool, `/images` → another).

```
                  ┌─────────────┐
   Users ───────▶ │Load Balancer│───┬──▶ Server 1
                  └─────────────┘   ├──▶ Server 2
                    (health checks) └──▶ Server 3
                                     (dead servers removed automatically)
```

> 🌍 **Analogy.** A load balancer is the person at a bank directing customers to whichever teller is free. No single teller gets swamped, and if one goes on break, customers are simply sent to the others.

> 💬 **Interviewers usually ask:** "What's a load balancer and why do you need one?"
>
> ✅ **Model answer:** "It sits in front of a group of servers and spreads incoming requests across them, using an algorithm like round robin or least-connections. It gives you two things: scalability, because you can add servers to handle more load, and high availability, because it health-checks the backends and stops sending traffic to any that fail. A Layer 4 balancer routes by IP and port; a Layer 7 one understands HTTP and can route by things like the URL path."

> 🧠 **Memory trick:** Load balancer = **the traffic cop spreading cars across open lanes.** Also removes crashed lanes (health checks).

---

## 2.20 Proxy vs Reverse Proxy ★★★★☆

**A favorite "do you really understand it" question.** The difference is *which side it sits on*.

**Forward proxy** — sits in front of **clients**. Clients send requests through it; the server sees the proxy, not the real client. Used for anonymity, caching, and content filtering (e.g., a corporate proxy blocking sites).

**Reverse proxy** — sits in front of **servers**. Clients think they're talking to the reverse proxy; it forwards to the real backend servers. Used for load balancing, SSL termination, caching, and hiding the backend. (Nginx is the classic example.)

```
FORWARD PROXY (protects/represents CLIENTS)
[Clients] ──▶ [Forward Proxy] ──▶ Internet ──▶ [Server]
              server sees the proxy, not you

REVERSE PROXY (protects/represents SERVERS)
[Client] ──▶ Internet ──▶ [Reverse Proxy] ──▶ [Backend Servers]
             you see the proxy, not the real servers
```

> 🌍 **Analogy.** A **forward proxy** is like sending your assistant to make purchases on your behalf — the shop never sees you. A **reverse proxy** is like a company receptionist — you talk to reception, and they route you to whichever employee should handle it; you never see the org chart behind the desk.

> 💬 **Interviewers usually ask:** "What's the difference between a proxy and a reverse proxy?"
>
> ✅ **Model answer:** "It's about which side it protects. A forward proxy sits in front of clients — the client sends requests through it, so the destination server sees the proxy instead of the real client. It's used for caching, filtering, or anonymity. A reverse proxy sits in front of servers — the client thinks it's talking to the proxy, which forwards to backend servers behind it. Reverse proxies handle load balancing, SSL termination, caching, and hiding the backend. Nginx is the go-to example, and a reverse proxy is often also acting as a load balancer."

> 🧠 **Memory trick:** **Forward proxy = for the client. Reverse proxy = for the server.** Match the "R" in reveRse to seRveR.

---

## 2.21 VLAN ★★☆☆☆

**Definition.** A **VLAN (Virtual LAN)** logically splits one physical network into several isolated virtual networks. Devices on different VLANs can't talk directly, even on the same switch, without a router.

> ✅ **One-liner:** "A VLAN lets you carve one physical switch into multiple isolated networks — say, separating Guest Wi-Fi from the internal company network — for security and to reduce broadcast traffic, without buying separate hardware." *(Low frequency for these roles — know the one-liner and move on.)*

---

## 2.22 🎯 THE Big One: "What happens when you type google.com and press Enter?"

**This is the most famous interview question in the industry.** It ties together this entire chapter. A strong answer signals you understand the whole stack. Here's the full walkthrough — practice saying it end to end.

```
1. DNS RESOLUTION
   Browser cache → OS cache → resolver → root → .com TLD → 
   authoritative server → returns google.com's IP.

2. TCP CONNECTION
   Browser opens a TCP connection to that IP on port 443,
   via the 3-way handshake (SYN, SYN-ACK, ACK).

3. TLS HANDSHAKE (because HTTPS)
   Server presents its certificate; browser verifies it against a CA;
   both agree on a symmetric session key. Connection is now encrypted.

4. HTTP REQUEST
   Browser sends: GET / HTTP/1.1, Host: google.com (encrypted).

5. SERVER PROCESSING
   Request may hit a load balancer → reverse proxy → app server →
   possibly a database → builds the response.

6. HTTP RESPONSE
   Server returns 200 OK plus the HTML.

7. BROWSER RENDERS
   Parses HTML, requests more resources (CSS, JS, images —
   each possibly its own DNS/TCP/TLS/HTTP), builds the page.
```

> ✅ **Model answer (say this out loud):** "First, DNS resolves google.com to an IP — the browser checks its cache, then the OS, then a recursive resolver walks from the root to the .com server to Google's authoritative nameserver. With the IP, the browser opens a TCP connection on port 443 using the three-way handshake. Because it's HTTPS, there's then a TLS handshake — the server sends a certificate the browser verifies against a trusted CA, and they agree on a symmetric session key, so everything after is encrypted. The browser sends an HTTP GET request. On the server side that may pass through a load balancer and a reverse proxy to an application server, maybe hitting a database, and comes back as a 200 OK with HTML. Finally the browser parses the HTML and fetches the CSS, JavaScript, and images it references — each possibly repeating that whole process — and renders the page."

> 🧠 **Memory trick — the sequence is:** **DNS → TCP → TLS → HTTP → (server) → response → render.** Chant it: *"Do The Task, Handle The Response, Render."*

---

## Chapter 2 — Key Takeaways

- **OSI = 7 layers** ("All People Seem To Need Data Processing"); the ones that matter are **L7 HTTP, L4 TCP/UDP, L3 IP**.
- **TCP** = reliable/ordered/slow (web, email). **UDP** = fast/best-effort (video, DNS, gaming). *(★★★★★)*
- **Ports:** 22 SSH, 53 DNS, 80 HTTP, 443 HTTPS, 3306 MySQL, 5432 Postgres.
- **DNS** turns names into IPs via a caching hierarchy (root → TLD → authoritative). It returns an **IP, not the page**. *(★★★★★)*
- **DHCP** auto-assigns IPs via **DORA**.
- **HTTP is stateless** → that's *why* cookies/sessions/JWT exist.
- **HTTPS** = HTTP + TLS: certificate proves identity; asymmetric agrees a key; symmetric encrypts the data. *(★★★★★)*
- **Cookie** = client-side; **session** = server-side (cookie carries the ID); **JWT** = stateless signed token (signed ≠ encrypted).
- **HTTP methods:** GET/POST/PUT/PATCH/DELETE. POST creates (not idempotent), PUT updates (idempotent).
- **Status codes:** 4xx = client's fault, 5xx = server's fault. **401 = who are you; 403 = not allowed.** *(★★★★★)*
- **NAT** = many private IPs behind one public. **Firewall** = default-deny gatekeeper. **Load balancer** = spread + survive. **Forward proxy = for clients; reverse proxy = for servers.**
- **The big question:** DNS → TCP → TLS → HTTP → server → response → render. Practice it out loud.

> **Next:** Chapter 3 — Linux. Now we go hands-on with the commands interviewers actually make you use.
