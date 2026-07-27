# Topic 8 — Computer Networks

> 🏢 **Why it matters:** Networking basics appear in most BD trainee papers (Cefalo, TigerIT, WellDev, Selise). Focus on **OSI/TCP-IP, TCP vs UDP, HTTP status codes, DNS, and ports** — the same handful of facts repeat.

## OSI Model (7 layers)

```
7 Application   — HTTP, DNS, FTP, SMTP
6 Presentation  — encryption, compression (TLS, JPEG)
5 Session       — connections/sessions
4 Transport     — TCP, UDP, ports
3 Network       — IP, routers
2 Data Link     — MAC, switches, Ethernet
1 Physical      — cables, signals
```
🧠 Mnemonic: **"All People Seem To Need Data Processing"** (top→bottom).
🧠 The tested layers: **L7 HTTP, L4 TCP/UDP, L3 IP, L2 MAC/switch.**

**TCP/IP model** = 4 layers: Application, Transport, Internet, Network Access.

## TCP vs UDP (top networking MCQ)

| | TCP | UDP |
|---|-----|-----|
| Connection | Yes (3-way handshake) | No |
| Reliable/ordered | Yes | No (best-effort) |
| Speed | Slower | Faster |
| Use | web, email, file transfer | video, gaming, DNS, VoIP |

**3-way handshake:** SYN → SYN-ACK → ACK. 🧠 **TCP = reliable/slow; UDP = fast/unreliable.**

## IP addressing

- **IPv4** = 32-bit (e.g., 192.168.1.1), ~4.3 billion addresses. **IPv6** = 128-bit.
- **Private ranges:** 10.x, 172.16–31.x, 192.168.x. **Loopback:** 127.0.0.1.
- **Classes:** A (large), B, C (small). Subnet mask separates network/host.
- **NAT**: many private IPs share one public IP.

## Key ports (memorize)

| Port | Service | | Port | Service |
|------|---------|---|------|---------|
| 20/21 | FTP | | 443 | HTTPS |
| 22 | SSH | | 25 | SMTP |
| 23 | Telnet | | 53 | DNS |
| 80 | HTTP | | 3306 | MySQL |

## DNS, DHCP, HTTP

- **DNS**: name → IP (port 53). Returns an **IP address**, not the page.
- **DHCP**: auto-assigns IP (DORA: Discover, Offer, Request, Ack).
- **HTTP** is **stateless**; port 80. **HTTPS** = HTTP + TLS, port 443 (encryption + certificate identity).

## HTTP status codes (guaranteed MCQ)

```
1xx Info | 2xx Success | 3xx Redirect | 4xx Client error | 5xx Server error
200 OK   201 Created   301 Moved   302 Found   304 Not Modified
400 Bad Request  401 Unauthorized  403 Forbidden  404 Not Found  429 Too Many
500 Internal Error  502 Bad Gateway  503 Unavailable  504 Gateway Timeout
```
🧠 **4xx = client's fault, 5xx = server's fault. 401 = not authenticated; 403 = authenticated but forbidden.**

## Devices & concepts

| Device | Layer | Role |
|--------|-------|------|
| **Hub** | 1 | dumb broadcast to all ports |
| **Switch** | 2 | forwards by MAC (smart) |
| **Router** | 3 | routes between networks by IP |
| **Firewall** | 3/4 | filters traffic by rules |

- **Bandwidth** = capacity; **Latency** = delay. **Packet** = unit of data. **Protocol** = rules.
- **HTTP vs HTTPS**: HTTPS encrypts via TLS + verifies identity with a certificate.

## Common mistakes & tricks

- ❌ "UDP is reliable" → **best-effort**, no guarantee.
- ❌ "DNS returns the web page" → returns an **IP**.
- ❌ "Switch works at Layer 3" → **Layer 2** (router = L3).
- ❌ "401 = forbidden" → 401 = **unauthenticated**; 403 = forbidden.
- 🧠 **HTTP=80, HTTPS=443, SSH=22, DNS=53, FTP=21.**

## 📄 Cheat sheet
```
OSI 7: App-Pres-Sess-Trans-Net-DataLink-Phys ("All People Seem To Need Data Processing")
TCP=reliable/ordered/slow (handshake) | UDP=fast/best-effort
Ports: 21 FTP,22 SSH,25 SMTP,53 DNS,80 HTTP,443 HTTPS,3306 MySQL
DNS→IP (port 53) | DHCP=DORA | HTTP stateless(80) | HTTPS=TLS(443)
Status: 2xx ok,3xx redirect,4xx client,5xx server | 401 unauth,403 forbidden,404 notfound
Hub(L1) < Switch(L2,MAC) < Router(L3,IP) | NAT=private→public
IPv4=32bit, IPv6=128bit, loopback 127.0.0.1
```

---

## MCQs — attempt, then check key

**Beginner (1–15)**
1. How many layers in the OSI model? a) 4 b) 5 c) 7 d) 8
2. TCP is: a) connectionless b) connection-oriented/reliable c) fast/unreliable d) a device
3. UDP is used for: a) email b) file transfer c) live video/gaming d) banking
4. HTTP default port: a) 21 b) 80 c) 443 d) 22
5. HTTPS default port: a) 80 b) 443 c) 22 d) 8080
6. DNS resolves: a) IP to MAC b) name to IP c) port to service d) page to server
7. 404 status code means: a) success b) redirect c) not found d) server error
8. Which works at Layer 2 (MAC)? a) hub b) switch c) router d) firewall
9. A router works at OSI layer: a) 1 b) 2 c) 3 d) 7
10. SSH uses port: a) 21 b) 22 c) 23 d) 25
11. TCP 3-way handshake is: a) SYN, ACK, FIN b) SYN, SYN-ACK, ACK c) GET, POST, PUT d) DORA
12. IPv4 address size: a) 16-bit b) 32-bit c) 64-bit d) 128-bit
13. 5xx status codes indicate: a) client error b) server error c) redirect d) success
14. Which is stateless? a) TCP b) HTTP c) FTP session d) SSH
15. DHCP is used to: a) resolve names b) auto-assign IP addresses c) encrypt traffic d) route packets

**Intermediate (16–25)**
16. 401 vs 403: 401 means: a) forbidden b) not authenticated c) not found d) server error
17. IPv6 address size: a) 32-bit b) 64-bit c) 128-bit d) 256-bit
18. Loopback address: a) 0.0.0.0 b) 127.0.0.1 c) 192.168.1.1 d) 255.255.255.255
19. Which protocol guarantees ordered delivery? a) UDP b) TCP c) IP d) ICMP
20. NAT allows: a) name resolution b) many private IPs to share a public IP c) encryption d) routing tables
21. Port 53 is: a) HTTP b) DNS c) SMTP d) SSH
22. A switch forwards frames using: a) IP address b) MAC address c) port number d) hostname
23. HTTPS adds which over HTTP? a) speed b) TLS encryption + identity c) statelessness d) new ports only
24. 301 status code: a) temporary redirect b) permanent redirect c) not modified d) created
25. Which layer does IP belong to? a) 2 b) 3 c) 4 d) 7

**Difficult (26–30)**
26. DNS primarily uses which transport protocol? a) TCP only b) UDP (port 53) c) HTTP d) ICMP
27. Bandwidth vs latency: latency is: a) capacity b) delay c) packet size d) protocol
28. A 502 Bad Gateway typically means: a) client sent bad data b) upstream/backend returned invalid response c) not found d) unauthorized
29. Which is a private IP range? a) 8.8.8.8 b) 192.168.0.0/16 c) 172.32.0.1 d) 11.0.0.1
30. Subnet mask 255.255.255.0 gives how many host addresses (usable)? a) 254 b) 256 c) 1024 d) 512

### ✅ Answer Key — Topic 8
1-c · 2-b · 3-c · 4-b · 5-b · 6-b · 7-c · 8-b · 9-c · 10-b · 11-b · 12-b · 13-b · 14-b · 15-b · 16-b · 17-c · 18-b · 19-b · 20-b · 21-b · 22-b · 23-b · 24-b · 25-b · 26-b · 27-b · 28-b · 29-b · 30-a

**Key explanations:** **16** 401 = unauthenticated (log in); 403 = authenticated but forbidden. **26** DNS mostly uses UDP port 53 (TCP for large/zone transfers). **28** 502 = a proxy/gateway got an invalid response from the backend. **30** /24 → 256 addresses − 2 (network + broadcast) = 254 usable hosts.
