# Topic 11 — Design Patterns (common ones only)

> 🏢 **Why it matters:** Only a few patterns appear in trainee MCQs — usually **Singleton, Factory, Observer**, plus the **SOLID** principles. 1–3 questions. Don't over-study; know the intent of each.

## The three categories

```
Creational  — how objects are created   (Singleton, Factory, Builder, Prototype)
Structural  — how objects are composed   (Adapter, Decorator, Facade, Proxy)
Behavioral  — how objects interact       (Observer, Strategy, Iterator, Command)
```

## The patterns you must know

**Singleton (Creational)** — ensures a class has **only one instance** with a global access point. Uses: config, logging, DB connection pool.
```java
class Singleton {
  private static Singleton instance;
  private Singleton() {}                      // private ctor blocks `new`
  public static Singleton getInstance() {
    if (instance == null) instance = new Singleton();
    return instance;
  }
}
```
🧠 **Private constructor + static getInstance() = Singleton.** (Thread-safety needs synchronization / eager init.)

**Factory (Creational)** — a method/class that **creates objects without exposing the exact class** to the caller. `ShapeFactory.create("circle")` returns a `Shape`. Decouples creation from use.

**Observer (Behavioral)** — a **one-to-many** dependency: when the subject changes, all observers are notified automatically. Uses: event systems, pub/sub, UI listeners, notifications.

**Strategy (Behavioral)** — define a family of interchangeable algorithms, select one at runtime (e.g., different sort/payment strategies).

**Decorator (Structural)** — add behavior to an object dynamically by wrapping it (e.g., `BufferedReader(new FileReader(...))`).

**Adapter (Structural)** — makes incompatible interfaces work together (a "translator").

**MVC** (architectural) — Model (data), View (UI), Controller (logic). Separates concerns.

## SOLID principles (frequently asked as a set)

| Letter | Principle | One line |
|--------|-----------|----------|
| **S** | Single Responsibility | one class, one reason to change |
| **O** | Open/Closed | open for extension, closed for modification |
| **L** | Liskov Substitution | subtypes replaceable for base types |
| **I** | Interface Segregation | many small interfaces > one fat interface |
| **D** | Dependency Inversion | depend on abstractions, not concretions |

## Common mistakes & tricks

- ❌ "Singleton allows many instances" → **exactly one**.
- ❌ "Factory exposes the concrete class" → it **hides** it.
- ❌ Confusing Observer (notify many) with Strategy (swap algorithm).
- 🧠 **Singleton = one; Factory = create-without-new; Observer = notify subscribers.**
- 🧠 **SOLID** = S.O.L.I.D (5 principles) — know the acronym.

## 📄 Cheat sheet
```
Categories: Creational | Structural | Behavioral
Singleton = one instance (private ctor + static getInstance)
Factory = create objects without exposing concrete class
Observer = one-to-many notify (pub/sub, events)
Strategy = interchangeable algorithms at runtime
Decorator = wrap to add behavior | Adapter = interface translator
MVC = Model-View-Controller
SOLID: Single-resp, Open/closed, Liskov, Interface-seg, Dependency-inversion
```

---

## MCQs — attempt, then check key

**Beginner (1–12)**
1. Singleton ensures: a) many instances b) exactly one instance c) no instances d) two instances
2. Which enforces a single instance? a) public constructor b) private constructor + static getInstance c) many constructors d) interface
3. Factory pattern is a: a) structural pattern b) creational pattern c) behavioral pattern d) architectural pattern
4. Observer pattern is: a) one-to-one b) one-to-many notification c) creational d) a database pattern
5. Which category does Singleton belong to? a) creational b) structural c) behavioral d) functional
6. SOLID's "S" is: a) Singleton b) Single Responsibility c) Strategy d) Structural
7. Which adds behavior by wrapping? a) Adapter b) Decorator c) Singleton d) Factory
8. Adapter pattern is: a) creational b) structural (interface translator) c) behavioral d) singleton
9. MVC stands for: a) Model-View-Controller b) Multi-View-Class c) Model-Value-Cache d) Main-View-Core
10. Factory hides: a) the interface b) the concrete class being created c) the method name d) nothing
11. Which is a behavioral pattern? a) Singleton b) Factory c) Observer d) Adapter
12. Pub/sub event systems typically use: a) Singleton b) Observer c) Factory d) Adapter

**Intermediate (13–20)**
13. Open/Closed principle: classes should be open for ___ and closed for ___: a) reading/writing b) extension/modification c) input/output d) creation/deletion
14. Strategy pattern lets you: a) create one instance b) swap algorithms at runtime c) wrap objects d) translate interfaces
15. Dependency Inversion says depend on: a) concrete classes b) abstractions c) singletons d) globals
16. Which pattern would `BufferedReader(new FileReader(f))` illustrate? a) Singleton b) Decorator c) Observer d) Factory
17. Liskov Substitution: subtypes should be: a) faster b) substitutable for their base type c) final d) abstract
18. A logging/config class typically uses which pattern? a) Observer b) Singleton c) Strategy d) Adapter
19. Which is NOT a creational pattern? a) Singleton b) Factory c) Builder d) Observer
20. Interface Segregation prefers: a) one large interface b) many small focused interfaces c) no interfaces d) abstract classes only

### ✅ Answer Key — Topic 11
1-b · 2-b · 3-b · 4-b · 5-a · 6-b · 7-b · 8-b · 9-a · 10-b · 11-c · 12-b · 13-b · 14-b · 15-b · 16-b · 17-b · 18-b · 19-d · 20-b

**Key explanations:** **2** Private constructor prevents `new`; static method returns the sole instance. **16** Wrapping streams to add buffering = Decorator. **19** Observer is behavioral, not creational.
