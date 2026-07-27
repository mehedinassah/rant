# Chapter 1 — Operating Systems

> **Why this chapter matters:** OS questions are the great equalizer. Every interviewer, from a scrappy startup to a cloud giant, reaches for "process vs thread" or "what's a deadlock" because they instantly separate people who *understand* computers from people who only *use* them. Get this chapter right and you'll sound like an engineer, not a graduate.

The topics are ordered roughly by interview frequency. If you only have one evening, study everything marked ★★★★★ and ★★★★☆.

---

## 1.1 What is an Operating System? ★★★☆☆

**Definition.** An operating system (OS) is the software that sits between your programs and the physical hardware. It manages the CPU, memory, disk, and devices, and hands those resources out to programs so they don't have to fight over them.

**Why it exists.** Imagine 200 programs all wanting the CPU, RAM, and disk at the same time. Without a referee, they'd corrupt each other's memory and crash constantly. The OS is that referee. Its three big jobs:

1. **Resource management** — who gets the CPU, how much memory, which files.
2. **Abstraction** — programs say "open this file" instead of "move the disk head to cylinder 4."
3. **Isolation & protection** — one crashing program shouldn't take down the whole machine.

> 🌍 **Analogy.** The OS is the manager of an apartment building. Tenants (programs) don't run their own water and electricity — they just turn a tap. The manager handles the plumbing, stops tenants from wandering into each other's flats, and settles disputes over shared laundry.

> 💬 **Interviewers usually ask:** "What does an operating system actually do?"
>
> ✅ **Model answer:** "It's the layer between applications and hardware. It manages resources — CPU time, memory, disk, devices — and shares them safely among many programs. It also gives programs a simple, consistent interface so they don't talk to hardware directly, and it isolates programs so one misbehaving process can't corrupt another."

> 🧠 **Memory trick:** OS = **M.A.I.** — **M**anages resources, **A**bstracts hardware, **I**solates programs.

---

## 1.2 Kernel ★★★★☆

**Definition.** The **kernel** is the core of the OS — the part that's always running, with full control over the hardware. It manages memory, schedules processes, handles system calls, and talks to device drivers.

**Why it exists.** You want *one* trusted piece of code with god-mode access to the hardware, and everything else running with limited privileges. That trusted core is the kernel. If any app could touch hardware directly, a single bug could brick the machine.

> 🌍 **Analogy.** The kernel is the engine room of a ship. Passengers (apps) never go down there. The crew (kernel) runs the engines and only exposes controls — "faster," "slower," "turn" — through the bridge.

**Key idea — two privilege levels (know this):**

```
┌─────────────────────────────────────────┐
│  USER SPACE  (limited privilege)         │
│  your apps: browser, python, nginx       │
└───────────────────┬─────────────────────┘
                    │  system call  (the only door)
                    ▼
┌─────────────────────────────────────────┐
│  KERNEL SPACE  (full privilege)          │
│  scheduler, memory mgr, drivers, FS      │
└─────────────────────────────────────────┘
                    │
                    ▼
              HARDWARE (CPU, RAM, disk, NIC)
```

> 💬 **Interviewers usually ask:** "What's the difference between kernel space and user space?"
>
> ✅ **Model answer:** "Kernel space is privileged — code there can touch hardware directly and access any memory. User space is where normal applications run, sandboxed and restricted. When an app needs something privileged, like reading a file or opening a network socket, it can't do it itself — it asks the kernel through a **system call**. That boundary is what keeps a buggy app from crashing the whole system."

> ⚠️ **Common mistake:** Saying "Linux is the OS." Technically **Linux is the kernel**; the full OS is the kernel *plus* the surrounding tools (a distribution like Ubuntu). Interviewers notice when you get this right.

> 🧠 **Memory trick:** Kernel = **KING**. It's the only one allowed in the throne room (hardware).

---

## 1.3 User Space ★★★☆☆

**Definition.** **User space** is the memory region and privilege level where normal programs run. Code here cannot touch hardware or other processes' memory directly — it must go through the kernel.

**Why it exists.** Safety and stability. If your text editor crashes, the kernel and every other program keep running because the editor was fenced into its own user-space sandbox.

> 🏭 **In real production:** When you see a process using 100% CPU in `top`, it's almost always burning that time in user space (your app's own code) or in kernel space (system calls). Tools show these separately as `%us` (user) and `%sy` (system) — a high `%sy` often means the app is hammering the kernel with syscalls, like excessive disk or network I/O.

> 🧠 **Memory trick:** **User space = the playground; kernel space = the control room.** Kids play in the playground; only staff enter the control room.

---

## 1.4 System Calls ★★★★☆

**Definition.** A **system call (syscall)** is the controlled way a user-space program requests a service from the kernel — opening a file, allocating memory, creating a process, sending network data.

**Why it exists.** It's the *one door* between the untrusted playground and the privileged control room. The program can't just grab hardware; it politely asks, the kernel checks permissions, does the work, and returns the result.

**The flow (worth being able to draw):**

```
your code:  fd = open("data.txt", O_RDONLY);
                     │
                     ▼   (CPU switches to kernel mode)
kernel:      checks permissions → talks to filesystem/driver
                     │
                     ▼   (CPU switches back to user mode)
your code:  gets back a file descriptor (or an error)
```

**Common syscalls to name-drop:** `open`, `read`, `write`, `close`, `fork`, `exec`, `wait`, `mmap`, `socket`.

> 🌍 **Analogy.** A syscall is ordering at a restaurant. You don't walk into the kitchen (hardware). You tell the waiter (syscall interface) what you want; the kitchen (kernel) makes it and brings it out.

> 💬 **Interviewers usually ask:** "What happens when a program reads a file?"
>
> ✅ **Model answer:** "The program makes a `read` system call. The CPU switches from user mode to kernel mode, the kernel checks the process is allowed to read that file, talks to the filesystem and disk driver to fetch the data, copies it into the program's buffer, then switches back to user mode and returns. The mode switch is what makes it a *system* call rather than a normal function call."

> 🐧 **Linux example:** Run `strace ls` — you'll see the *actual* system calls `ls` makes (`openat`, `read`, `write`, `close`). This one command makes syscalls tangible; try it before your interview.

> 🧠 **Memory trick:** Syscall = the **waiter**. Only the waiter crosses into the kitchen.

---

## 1.5 Process vs Thread ★★★★★

**This is the single most-asked OS question. Know it cold.**

**Definition.**
- A **process** is a program in execution — it has its own private memory space (code, heap, stack), its own file descriptors, and at least one thread.
- A **thread** is a unit of execution *inside* a process. Threads of the same process **share** that process's memory and resources but each has its own stack and program counter.

**Why threads exist.** Creating a whole new process is expensive and processes can't easily share data. Threads are lightweight and share memory, so they're great for doing several things at once inside one program (e.g., one thread handles the UI while another downloads a file).

> 🌍 **Analogy.** A **process is a house**; **threads are the people living in it**. They share the kitchen and fridge (memory), which is convenient — but if two people grab the last egg at the same moment, you get a conflict (a race condition). Different houses (processes) don't share a fridge, so they're safer but have to phone each other to exchange anything (inter-process communication).

**The comparison table interviewers love:**

| | **Process** | **Thread** |
|---|---|---|
| Memory | Own private space | Shared within the process |
| Creation cost | Heavy (slow) | Light (fast) |
| Communication | Hard — needs IPC (pipes, sockets) | Easy — shared memory |
| Crash impact | Isolated; one crash ≠ others die | One thread crashing can take down the whole process |
| Owns | Code, heap, its threads | Its own stack + registers only |

> 💬 **Interviewers usually ask:** "What's the difference between a process and a thread?"
>
> ✅ **Model answer:** "A process is an independent program with its own isolated memory. A thread is a lighter unit of execution inside a process, and threads of the same process share memory. That sharing makes threads fast to create and easy to communicate between, but it also means they can step on each other's data — so you need synchronization like mutexes. Processes are isolated and safer but heavier, and they need explicit IPC to talk to each other."

> ⚠️ **Common mistake:** Saying "threads are just faster processes." The real distinction is **shared memory** — that's what makes threads both powerful *and* dangerous (race conditions).

> 🏭 **In real production:** A web server like Nginx uses multiple processes; a Java app server often uses many threads inside one process. When someone says "the app is leaking memory," you need to know whether it's one bloated process or many.

> 🧠 **Memory trick:** **P**rocess = **P**rivate memory. **T**hread = **T**ogether (shared) memory.

---

## 1.6 Process States ★★★★☆

**Definition.** As a process runs, it moves through a small set of states. The classic ones:

- **New** — being created.
- **Ready** — able to run, waiting for the CPU.
- **Running** — currently executing on the CPU.
- **Waiting / Blocked** — paused, waiting for something (disk, network, user input).
- **Terminated** — finished.

**The state diagram (be able to sketch this):**

```
   ┌──────┐   admit   ┌───────┐  scheduler  ┌─────────┐
   │ NEW  │──────────▶│ READY │────────────▶│ RUNNING │
   └──────┘           └───────┘  dispatch   └────┬────┘
                          ▲                       │
              I/O done    │                       │ exit
                          │        needs I/O      ▼
                       ┌──┴──────┐◀──────────  ┌────────────┐
                       │ WAITING │             │ TERMINATED │
                       └─────────┘             └────────────┘
```

**Why it matters.** The whole point of an OS is juggling processes between these states so the CPU is never idle while there's work to do. When a process is **Waiting** on disk, the OS runs someone else.

> 🌍 **Analogy.** A doctor's office. **Ready** = patients in the waiting room. **Running** = the one patient with the doctor. **Waiting** = someone sent off for a blood test; the doctor sees other patients meanwhile and calls them back when results are in.

> 💬 **Interviewers usually ask:** "Walk me through the states a process goes through."
>
> ✅ **Model answer:** "New when it's created, Ready when it's waiting for a CPU, Running when it's on the CPU. If it needs I/O — say, reading a file — it moves to Waiting and gives up the CPU so someone else can run. When the I/O completes it goes back to Ready, not straight to Running, because the CPU might be busy. Finally it Terminates. The OS constantly shuffles processes between Ready and Running to keep the CPU busy."

> 🐧 **Linux example:** In `top` or `ps`, the `STAT` column shows state: `R` running/runnable, `S` sleeping (interruptible wait), `D` uninterruptible sleep (usually disk I/O — a stuck `D` process is a classic sign of storage trouble), `Z` zombie, `T` stopped.

> 🧠 **Memory trick:** **Ready → Running → Waiting** is a loop. A process bounces around that loop many times before it Terminates.

---

## 1.7 Context Switching ★★★★☆

**Definition.** A **context switch** is when the CPU stops running one process (or thread) and starts running another. The OS must save the first one's state (registers, program counter, stack pointer) and load the second one's.

**Why it exists.** You have far more processes than CPU cores. To create the illusion that everything runs "at once," the OS rapidly switches between them — thousands of times per second.

**Why interviewers care.** Context switches aren't free. Saving and restoring state takes time, and the CPU caches get cold. Too many context switches = wasted CPU = a real production performance problem.

> 🌍 **Analogy.** A chef cooking five dishes on one stove. Every time they switch pots, they have to remember exactly where they left each one (heat level, timer, what's next). That remembering-and-reloading is the context switch. Switch too often and you spend more time remembering than cooking.

> 💬 **Interviewers usually ask:** "What is a context switch and why is it expensive?"
>
> ✅ **Model answer:** "It's when the CPU swaps from one process or thread to another. The OS saves the current one's CPU state — registers, program counter — and restores the next one's. It's expensive because it's pure overhead: no useful work happens during the switch, and afterward the CPU cache is full of the *old* process's data, so the new one runs slower until the cache warms up. If a system does too many context switches, you see high CPU with low actual throughput."

> 🏭 **In real production:** High context-switch rates (visible in `vmstat` under `cs`) often point to too many threads fighting over too few cores, or lock contention. It's a real thing SREs investigate.

> 🧠 **Memory trick:** Context switch = **save game, load different save.** The saving/loading is overhead; only the playing is progress.

---

## 1.8 CPU Scheduling ★★★★☆

**Definition.** **CPU scheduling** is how the OS decides *which* ready process runs next. The piece of the kernel that decides is the **scheduler**.

**Why it exists.** Many processes are Ready; there's one CPU (per core). Someone has to choose. Different algorithms optimize for different goals — fairness, throughput, or responsiveness.

Interviewers usually want three algorithms. Here they are with a worked example.

**Setup:** Three jobs arrive at time 0. Burst times (how long each needs the CPU): **P1 = 8, P2 = 4, P3 = 2.**

### FCFS — First Come, First Served ★★★☆☆
Run them in arrival order. Simple, but a big job blocks everyone behind it (the **convoy effect**).

```
| P1 (8) ......... | P2 (4) .... | P3 (2) .. |
0                8              12          14
Wait times: P1=0, P2=8, P3=12   → avg wait = 20/3 ≈ 6.67
```

> 🌍 **Analogy.** A single supermarket queue. If the person in front has a full trolley, everyone behind waits — even the person holding one apple.

### SJF — Shortest Job First ★★★☆☆
Run the shortest job first. Gives the **minimum average wait time**, but long jobs can **starve** if short ones keep arriving.

```
| P3 (2) .. | P2 (4) .... | P1 (8) ......... |
0          2             6                 14
Wait times: P3=0, P2=2, P1=6   → avg wait = 8/3 ≈ 2.67  ← better!
```

> 🌍 **Analogy.** The "10 items or less" express lane — quick shoppers get out fast, but if express shoppers keep coming, the person with a full trolley never gets served (starvation).

### Round Robin ★★★★☆
Each process gets a fixed **time slice (quantum)**, then goes to the back of the queue. Fair and responsive — the algorithm behind interactive, time-sharing systems. This is the one to know best.

```
Quantum = 2:
| P1 | P2 | P3 | P1 | P2 | P1 | P1 |
0    2    4    6    8   10   12   14
Everyone gets a turn quickly; no one is starved.
```

> 🌍 **Analogy.** A teacher giving every student 2 minutes to speak, round the room, again and again. Nobody hogs the floor; nobody is ignored.

**The trade-off table:**

| Algorithm | Optimizes for | Weakness |
|-----------|--------------|----------|
| FCFS | Simplicity | Convoy effect (big job blocks all) |
| SJF | Lowest avg wait | Starvation of long jobs; needs to know burst time |
| Round Robin | Fairness & responsiveness | Overhead from many context switches if quantum too small |

> 💬 **Interviewers usually ask:** "Which scheduling algorithm would you use for an interactive system, and why?"
>
> ✅ **Model answer:** "Round Robin. Each process gets a small, fixed time slice, so no single process can hog the CPU and every user gets a quick response — which is exactly what you want for interactive workloads. The trade-off is the time slice size: too large and it degrades into FCFS; too small and you waste CPU on context switching."

> 🧠 **Memory trick:** **F**CFS = **F**irst in line. **S**JF = **S**hortest wins. **R**R = **R**otate everyone.

---

## 1.9 Mutex vs Semaphore ★★★★☆

When threads share memory (§1.5), two of them touching the same data at once causes a **race condition** — the result depends on luck of timing, and it corrupts data. Mutexes and semaphores are the tools that prevent it.

**Race condition, concretely:** two threads both do `balance = balance + 100` on a shared account. If they read the old value at the same time, one update is lost. Classic interview setup.

### Mutex (Mutual Exclusion) ★★★★☆
A **lock** that lets exactly **one** thread into a critical section at a time. You **lock** it, do the sensitive work, then **unlock**. Crucially, the thread that locks it is the one that must unlock it — it's like a key you're holding.

```
Thread A: lock(m) → [update balance] → unlock(m)
Thread B: lock(m) ...waits... → [update balance] → unlock(m)
```

> 🌍 **Analogy.** A single toilet with one key. Only one person inside at a time. You take the key, go in, come out, hand the key back.

### Semaphore ★★★☆☆
A **counter** that allows up to **N** threads through at once. `wait()` decrements (and blocks at 0); `signal()` increments. A semaphore with N=1 is called a **binary semaphore** and behaves much like a mutex — but any thread can signal it, so it's also used for *signaling between* threads, not just locking.

> 🌍 **Analogy.** A parking lot with 3 spaces and a counter at the gate. Cars enter while spaces remain; when full, new cars wait; each car leaving frees a space.

**The distinction interviewers want:**

| | **Mutex** | **Semaphore** |
|---|---|---|
| Purpose | Locking (protect a resource) | Signaling + limiting to N |
| Allowed at once | Exactly 1 | Up to N |
| Ownership | Owned — locker must unlock | Not owned — anyone can signal |

> 💬 **Interviewers usually ask:** "Difference between a mutex and a semaphore?"
>
> ✅ **Model answer:** "A mutex is a lock that allows exactly one thread into a critical section, and only the thread that locked it can unlock it — it's about mutual exclusion. A semaphore is a counter that allows up to N threads through, so it's used both for limiting concurrent access to a pool of resources and for signaling between threads. A binary semaphore looks like a mutex but has no ownership — any thread can signal it."

> 🧠 **Memory trick:** **Mut**ex = **Mut**ually exclusive = **1** at a time (a key). **Sem**aphore = counts (like traffic **sem**aphore signals) = up to **N**.

---

## 1.10 Deadlock ★★★★★

**Very high frequency. Know the four conditions.**

**Definition.** A **deadlock** is when two or more processes are each waiting for a resource the other holds, so none can ever proceed. Everyone's stuck forever.

> 🌍 **Analogy.** Two people at a narrow doorway, each insisting "you first — no, you first," neither moving. Or: Alice holds a fork and waits for a knife; Bob holds the knife and waits for the fork. Neither eats.

**The four Coffman conditions (all four must hold for deadlock).** This is the money answer:

1. **Mutual exclusion** — a resource can't be shared; only one holder at a time.
2. **Hold and wait** — a process holds one resource while waiting for another.
3. **No preemption** — you can't forcibly take a resource away; it must be released voluntarily.
4. **Circular wait** — a cycle of processes each waiting on the next.

Break **any one** of these and deadlock is impossible.

```
   ┌─────────┐   holds R1, wants R2   ┌─────────┐
   │ Process │ ─────────────────────▶ │   R2    │
   │   A     │                        │ (held   │
   └────▲────┘                        │  by B)  │
        │                             └────┬────┘
        │ R1 held by A                     │ B holds R2, wants R1
   ┌────┴────┐                        ┌────▼────┐
   │   R1    │ ◀───────────────────── │ Process │
   └─────────┘   wants R1             │   B     │
                                      └─────────┘
        This cycle = circular wait = deadlock
```

> 💬 **Interviewers usually ask:** "What is a deadlock and how do you prevent it?"
>
> ✅ **Model answer:** "A deadlock is when processes wait on each other in a cycle, each holding a resource the other needs, so none can proceed. It requires four conditions at once — mutual exclusion, hold-and-wait, no preemption, and circular wait. To prevent it you break one condition. The most practical is breaking circular wait by imposing a global order on locks — always acquire lock A before lock B — so a cycle can't form. You can also avoid hold-and-wait by grabbing all locks at once, or use timeouts to detect and recover."

> ⚠️ **Common mistake:** Confusing deadlock with **starvation**. Deadlock = everyone stuck forever in a cycle. Starvation = a process keeps getting skipped (e.g., a long job under SJF) but the system as a whole is still making progress.

> 🏭 **In real production:** Deadlocks are common in databases when two transactions lock rows in opposite order. Databases like MySQL/Postgres *detect* the cycle and kill one transaction with a "deadlock detected" error — your app should retry it.

> 🧠 **Memory trick:** The four conditions spell an easy story: **"Mine, held, no-take-backs, in a circle."** Or acronym **M-H-N-C**.

---

## 1.11 Virtual Memory ★★★★☆

**Definition.** **Virtual memory** is an abstraction where each process gets its own large, private, contiguous-looking address space, which the OS maps onto real physical RAM (and disk) behind the scenes. Programs use *virtual* addresses; the hardware (MMU) translates them to *physical* addresses.

**Why it exists — three big wins:**
1. **Isolation** — each process thinks it has the whole memory to itself and can't see others'. Security + stability.
2. **More memory than you have** — rarely used pages can be pushed to disk (**swap**), so you can run programs bigger than physical RAM.
3. **Simplicity for programmers** — every program is written as if it starts at address 0 with a clean, continuous space.

> 🌍 **Analogy.** Everyone's home address is "123 Main St" as far as they're concerned, but the postal service (MMU) maps each to a real, unique location. Nobody needs to know the physical layout; the mapping handles it.

> 💬 **Interviewers usually ask:** "What is virtual memory and why is it useful?"
>
> ✅ **Model answer:** "Virtual memory gives each process its own private address space that the OS maps to physical RAM. It gives you isolation — processes can't touch each other's memory — and it lets the system use disk as an overflow via swap, so programs can be larger than physical RAM. It also simplifies programming because every process sees a clean, continuous address space starting at zero, even though the real physical layout is fragmented."

> ⚠️ **Common mistake:** Thinking virtual memory *is* the swap file. Swap is just one part — the disk overflow. Virtual memory is the whole addressing-and-mapping system.

> 🏭 **In real production:** When a server "starts swapping," performance falls off a cliff because disk is ~1000× slower than RAM. Watch for it in `free -m` (swap used climbing) and `vmstat` (`si`/`so` = swap in/out).

> 🧠 **Memory trick:** Virtual memory = **"everyone gets their own imaginary house on Main St; the OS knows the real map."**

---

## 1.12 Paging ★★★★☆

**Definition.** **Paging** is the mechanism that makes virtual memory work. Memory is divided into fixed-size blocks: **pages** in virtual memory and **frames** in physical memory (both commonly 4 KB). A **page table** maps each virtual page to a physical frame.

**Why it exists.** Fixed-size blocks eliminate **external fragmentation** — any page fits in any free frame, like same-sized LEGO bricks. And you only need to keep the *actively used* pages in RAM; the rest can live on disk.

**Page fault (know this term):** when a program accesses a page that isn't currently in RAM, the CPU raises a **page fault**, the OS fetches the page from disk into a frame, updates the page table, and resumes the program. A few page faults are normal; *constant* page faults (**thrashing**) means the machine is out of RAM and spending all its time shuffling pages.

```
Virtual pages          Page table          Physical frames (RAM)
┌──────┐  page 0  ──▶  [0 → frame 5]  ──▶  ┌──────┐ frame 5
│ 0..3 │  page 1  ──▶  [1 → on disk]       │      │
│      │  page 2  ──▶  [2 → frame 2]  ──▶  ┌──────┐ frame 2
└──────┘                                    └──────┘
```

> 🌍 **Analogy.** A library where books (pages) are stored in fixed-size shelf slots (frames). The catalog (page table) tells you which slot each book is in. Rarely read books go to off-site storage (disk); fetching one back is a page fault.

> 💬 **Interviewers usually ask:** "What is paging and what's a page fault?"
>
> ✅ **Model answer:** "Paging splits memory into fixed-size pages in virtual memory and frames in physical memory, with a page table mapping between them. Fixed sizes remove external fragmentation and let the OS keep only active pages in RAM. A page fault happens when a program touches a page that isn't in RAM — the OS pauses the program, loads the page from disk, updates the table, and resumes. Occasional faults are fine; constant faulting is thrashing, and it means you need more RAM."

> 🧠 **Memory trick:** **Page = virtual, Frame = physical.** Same size, so they slot together like LEGO.

---

## 1.13 Segmentation ★★☆☆☆

**Definition.** **Segmentation** divides memory by *logical* meaning rather than fixed size — separate variable-length segments for code, stack, heap, and data. Each segment has a base and a limit.

**Paging vs Segmentation — the one comparison they want:**

| | **Paging** | **Segmentation** |
|---|---|---|
| Block size | Fixed (e.g., 4 KB) | Variable (logical units) |
| Divided by | Convenience (equal chunks) | Meaning (code / stack / heap) |
| Fragmentation | Internal (last page partly empty) | External (variable gaps) |
| Visible to programmer | No | Somewhat (logical) |

> 🧠 **Memory trick:** **Pa**ging = **Pa**rts of equal size. **Seg**mentation = **Seg**ments by meaning. Modern systems mostly use paging; pure segmentation is rare, so don't over-study this one.

---

## 1.14 Heap vs Stack ★★★★★

**Extremely common, especially for backend roles. This is about memory *inside* a single process.**

Every process's memory has these regions:

```
   High addresses
   ┌───────────────┐
   │     STACK     │  ← grows DOWN. Function calls, local variables.
   │       │       │     Automatic. Fast. LIFO.
   │       ▼       │
   │               │
   │       ▲       │
   │       │       │
   │     HEAP      │  ← grows UP. malloc/new. Manual/GC. Flexible.
   ├───────────────┤
   │  DATA / BSS   │  ← global & static variables
   ├───────────────┤
   │     CODE      │  ← the program instructions (text)
   └───────────────┘
   Low addresses
```

**Stack.** Stores local variables and function-call bookkeeping (return addresses, parameters). Managed **automatically** — when a function is called, a "stack frame" is pushed; when it returns, the frame is popped. Fast, but **limited in size**.

**Heap.** Memory you request explicitly at runtime (`malloc` in C, `new` in Java/C++, or via the language's allocator). Lives until you free it (C) or the garbage collector reclaims it (Java/Python/Go). Flexible and large, but slower and needs management.

**The comparison table:**

| | **Stack** | **Heap** |
|---|---|---|
| Stores | Local variables, call frames | Dynamically allocated objects |
| Managed by | Automatically (compiler) | Manually or by garbage collector |
| Speed | Fast | Slower |
| Size | Small, fixed limit | Large |
| Lifetime | Until function returns | Until freed / GC'd |
| Typical error | **Stack overflow** (e.g., infinite recursion) | **Memory leak** (never freed) |

> 🌍 **Analogy.** The **stack** is a stack of plates — you add and remove only from the top, in strict order (LIFO), and it's quick. The **heap** is a big warehouse — you can request storage of any size anywhere, but you (or a cleanup crew) must remember to return it, or it fills up.

> 💬 **Interviewers usually ask:** "What's the difference between the stack and the heap?"
>
> ✅ **Model answer:** "Both live in a process's memory. The stack holds local variables and function-call frames; it's managed automatically in last-in-first-out order and it's fast but small. The heap is for dynamically allocated memory that you request at runtime — it's large and flexible but slower, and it lasts until it's explicitly freed or garbage collected. Too-deep recursion overflows the stack; forgetting to free heap memory causes a memory leak."

> ⚠️ **Common mistake:** Saying the stack and heap are separate programs or on separate machines. They're two **regions of the same process's memory**.

> 🧠 **Memory trick:** **Stack** = automatic, **st**rict order, **st**ack of plates. **Heap** = a big messy **heap** you manage yourself.

---

## 1.15 Zombie Process ★★★★☆

**Definition.** A **zombie** (or "defunct") process is one that has **finished executing** but still has an entry in the process table because its **parent hasn't read its exit status yet** (hasn't "reaped" it via `wait()`).

**Why it exists.** When a child dies, the OS keeps a tiny record — mainly the exit code — so the parent can find out how the child ended. Until the parent calls `wait()`, that record lingers. The zombie uses no CPU or memory; it's just a table entry.

> 🌍 **Analogy.** A zombie is like a finished delivery that's done but still sitting in the "awaiting signature" list. The package is delivered (process is dead); it just needs the manager (parent) to sign it off so the record clears.

**Why interviewers care.** A few zombies are harmless, but if a parent *never* reaps its children, zombies pile up and can exhaust the process table (you run out of PIDs) — a real bug in badly written services.

> 💬 **Interviewers usually ask:** "What is a zombie process?"
>
> ✅ **Model answer:** "It's a process that has finished but still appears in the process table because its parent hasn't collected its exit status with `wait()`. It holds no CPU or memory — just a table entry storing the exit code. One or two are fine, but if a parent never reaps its children, zombies accumulate and can exhaust the process table. You fix it by making the parent call `wait()`, or by killing the parent, in which case `init` (PID 1) adopts and reaps the zombies."

> 🐧 **Linux example:** In `ps aux`, a zombie shows state `Z` and often `<defunct>` in its name. You can't `kill -9` a zombie — it's already dead; you have to deal with the *parent*.

> 🧠 **Memory trick:** **Zombie = dead but not buried.** The parent has to "bury" it by reaping the exit status.

---

## 1.16 Orphan Process ★★★☆☆

**Definition.** An **orphan** is a process whose **parent has terminated** while the child is still running. The child keeps running; it's just lost its parent.

**What happens to it.** The orphan is **adopted by `init`/`systemd` (PID 1)**, which becomes its new parent and will reap it when it eventually finishes. So orphans, unlike zombies, get cleaned up properly.

> 🌍 **Analogy.** A child whose parent leaves is taken in by an orphanage (PID 1). Life goes on; someone still looks after the paperwork when the time comes.

**Zombie vs Orphan — the pairing interviewers love:**

| | **Zombie** | **Orphan** |
|---|---|---|
| Who died? | The **child** (parent still alive) | The **parent** (child still alive) |
| Still running? | No — already dead | Yes — still running |
| Problem? | Yes if they pile up (table entries) | Not really — PID 1 adopts & reaps |

> 💬 **Interviewers usually ask:** "Difference between a zombie and an orphan process?"
>
> ✅ **Model answer:** "In a zombie, the child has finished but the parent hasn't reaped its exit status, so a dead entry lingers in the process table. In an orphan, it's the reverse — the parent died while the child is still running. The orphan gets adopted by init, PID 1, which becomes its parent and reaps it later. So orphans are handled cleanly, whereas zombies can be a problem if they accumulate."

> 🧠 **Memory trick:** **Z**ombie = **child** is dead (**Z** for the child's zzz's). **Orphan** = **parent** is gone (an orphan lost their parent). Match the word to who died.

---

## Chapter 1 — Key Takeaways

- **OS** = referee between programs and hardware: **M**anages, **A**bstracts, **I**solates.
- **Kernel** runs privileged in **kernel space**; your apps run in **user space** and cross the boundary via **system calls** (the one door).
- **Process = private memory; Thread = shared memory.** Sharing makes threads fast but race-prone. *(★★★★★ — nail this.)*
- Processes cycle **Ready → Running → Waiting**; swapping between them is a **context switch** (pure overhead).
- Scheduling: **FCFS** (simple, convoy effect), **SJF** (best avg wait, starvation), **Round Robin** (fair, interactive).
- **Mutex** = 1 at a time, owned. **Semaphore** = up to N, not owned.
- **Deadlock** needs all four: **mutual exclusion, hold-and-wait, no preemption, circular wait.** Break one to prevent it. *(★★★★★)*
- **Virtual memory** gives each process a private space, backed by RAM + swap, implemented with **paging** (fixed pages ↔ frames; a miss = **page fault**).
- **Stack** = auto, fast, small, LIFO (overflow). **Heap** = manual/GC, large, flexible (leaks). *(★★★★★)*
- **Zombie** = child dead, not reaped. **Orphan** = parent dead, child adopted by PID 1.

> **Next:** Chapter 2 — Networking. It's the biggest chapter, and "what happens when you type google.com?" is the most famous interview question of all. Take a break, then let's go.
