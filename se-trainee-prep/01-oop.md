# Topic 1 — Object-Oriented Programming (OOP)

> 🏢 **Why it matters:** OOP is the **#1 most-asked theory topic** in BD trainee exams. Brain Station 23, Enosis, Therap, BJIT, Cefalo are Java/C#-heavy — expect 8–15 OOP MCQs. WellDev/Selise test the concepts plus JS/TS twists. OOP + SQL alone can be 35–40% of the paper.

## Essential concepts (the 20%)

**Class** = blueprint; **Object** = instance. `Car myCar = new Car();`

**The 4 Pillars — "A PIE":**
```
A — Abstraction    → hide complexity, show essentials (WHAT not HOW)
P — Polymorphism   → one name, many forms (overloading + overriding)
I — Inheritance    → child reuses/extends parent ("is-a")
E — Encapsulation  → bundle data + methods; hide data (private + getters/setters)
```

**Abstraction vs Encapsulation:** Encapsulation hides **data** (private fields). Abstraction hides **implementation complexity** (abstract/interface). Steering wheel = abstraction; sealed engine = encapsulation.

**Polymorphism — two forms:**
```
              POLYMORPHISM
             /            \
   Compile-time            Runtime
   (Static)                (Dynamic)
   OVERLOADING             OVERRIDING
   same name, diff params  same signature, parent→child
```

**Inheritance types:** Single (A→B), Multilevel (A→B→C), Hierarchical (A→B, A→C), Multiple (via **interfaces only** in Java/C#; C++ allows class multiple inheritance).

**Access modifiers (Java), least→most restrictive:** `public` → `protected` (package + subclasses) → `default` (package) → `private` (class only).

**Relationships:**
```
Association (uses)  <  Aggregation (weak "has-a")  <  Composition (strong "owns-a")
Dept ◇── Professor  (profs survive)      House ◆── Room  (rooms die with house)
```

## Frequently confused concepts

| A | B | Difference |
|---|---|---|
| **Overloading** | **Overriding** | same name/diff params/**compile-time** vs same signature/**runtime** |
| **Abstract class** | **Interface** | has state+constructor+concrete methods, single-inherit vs pure contract, multi-implement |
| **Overriding** | **Hiding** | instance methods (runtime, object type) vs `static` methods/fields (compile-time, reference type) |
| **Cohesion** | **Coupling** | want **HIGH** (focused class) vs want **LOW** (few dependencies) |
| **Deep copy** | **Shallow copy** | copies nested objects recursively vs copies references (shared nested object) |
| **Abstraction** | **Encapsulation** | detail hiding (design) vs data hiding (implementation) |

## Common mistakes & memory tricks

- ❌ "Overloading is runtime" → it's **compile-time**. **Overr*L*oading = compi*L*e-time.**
- ❌ "Java supports multiple class inheritance" → **No** (Diamond Problem); interfaces only.
- ❌ "Abstract class has no concrete methods" → it **can** have them, plus a constructor.
- ❌ "static methods can be overridden" → they're **hidden**.
- ❌ Constructors are static/final/inherited → **none** of these; they **can** be overloaded.
- 🧠 **is-a = inheritance, has-a = composition.** **Bird is-a Animal → abstract; Bird can Fly → interface.**
- 🧠 Good design = **High Cohesion, Low Coupling (HCLC).**

## Output-prediction traps (study the reasoning)

```java
// Trap 1: overriding (instance) → object type
class A { void show(){ System.out.print("A"); } }
class B extends A { void show(){ System.out.print("B"); } }
A o = new B();  o.show();          // → B

// Trap 2: hiding (static) → reference type
class A { static void show(){ System.out.print("A"); } }
class B extends A { static void show(){ System.out.print("B"); } }
A o = new B();  o.show();          // → A   ← the classic trick!
```

**Syntax facts:** interface can't have a constructor; abstract class can't be instantiated (but has a constructor); `final` method can't be overridden; `final` class can't be extended; `class B extends A implements X, Y` is valid.

## 📄 Cheat sheet

```
4 PILLARS (A PIE): Abstraction, Polymorphism, Inheritance, Encapsulation
Overloading = compile-time, diff params | Overriding = runtime, same signature
Abstract class: state+ctor+single | Interface: contract+multiple(+default methods 8+)
Java: NO multiple class inheritance (Diamond) → interfaces
Access: private < default < protected < public
STATIC → hidden (reference type) | INSTANCE → overridden (object type)
Composition(owns-a) > Aggregation(has-a) > Association(uses)
Design goal: HIGH cohesion, LOW coupling
Constructor: not static/final/inherited/overridden; CAN be overloaded
```

## ⭐ Top facts
A PIE · overloading=compile · overriding=runtime · no multiple class inheritance in Java · interfaces enable multiple inheritance · abstract class has constructor · interface has none · static=hidden · final method not overridable · encapsulation=data hiding · abstraction=detail hiding · composition=strong owns-a · HCLC · super=parent, this=current.

---

## MCQs — attempt, then check the key at the end

**Beginner (1–15)**
1. OOP stands for? a) Object Ordered Programming b) Object Oriented Programming c) Ordered Object Protocol d) Operational Object Processing
2. NOT a pillar of OOP? a) Encapsulation b) Polymorphism c) Compilation d) Inheritance
3. A class is a: a) Memory location b) Blueprint for objects c) Running instance d) Function
4. Encapsulation is about: a) Multiple forms b) Bundling data + hiding via access control c) Code reuse d) Hiding complexity
5. Java keyword for inheritance? a) implement b) inherits c) extends d) super
6. "One name, many forms" = a) Inheritance b) Encapsulation c) Polymorphism d) Abstraction
7. Overloading is resolved at: a) Runtime b) Compile-time c) Link-time d) Load-time
8. Overriding is resolved at: a) Runtime b) Compile-time c) Design-time d) Never
9. Inheritance represents which relationship? a) has-a b) uses-a c) is-a d) owns-a
10. Most restrictive Java access modifier? a) public b) protected c) default d) private
11. Abstraction hides: a) Data b) Objects c) Implementation complexity d) Class name
12. Multiple inheritance of classes in Java is: a) Allowed b) Not allowed c) Allowed with final d) Allowed with static
13. Multiple inheritance in Java is enabled via: a) Abstract classes b) Interfaces c) Packages d) Constructors
14. Getters/setters implement: a) Inheritance b) Polymorphism c) Encapsulation d) Abstraction
15. Which cannot be instantiated? a) Concrete class b) Abstract class c) Final class d) Static nested class

**Intermediate (16–25)**
16. `A o = new B();` where B overrides instance method `f()`. `o.f()` runs: a) A's f b) B's f c) compile error d) undefined
17. If `f()` were `static` in the above, `o.f()` runs: a) A's f b) B's f c) error d) both
18. Which is TRUE? a) Interface can have a constructor b) Abstract class can have a constructor c) Constructors are inherited d) Static methods are overridden
19. Composition implies: a) weak has-a b) strong owns-a (part dies with whole) c) is-a d) uses-a
20. Good design favors: a) high coupling b) low cohesion c) high cohesion, low coupling d) high coupling, high cohesion
21. Overloading requires: a) same name, different parameters b) different name, same params c) same name, same params d) different return type only
22. A `final` method: a) can be overridden b) cannot be overridden c) cannot be called d) must be static
23. Pre-Java 8 interface contains: a) only concrete methods b) only abstract methods + constants c) constructors d) private fields
24. Diamond problem is solved in Java by: a) multiple class inheritance b) interfaces c) final classes d) static methods
25. Which best shows encapsulation? a) `public int x;` b) `private int x;` + getters/setters c) many-parameter method d) two same-name methods

**Difficult (26–30)**
26. In Java, `List l = new ArrayList();` demonstrates: a) overloading b) upcasting/polymorphism via reference type c) encapsulation d) static binding of the object
27. Runtime polymorphism in Java uses: a) static binding b) dynamic method dispatch (vtable) c) compile-time resolution d) overloading
28. Which statement is FALSE? a) An abstract class can have all concrete methods b) An interface method can have a body in Java 8+ c) A private method can be overridden d) Constructors can be overloaded
29. Shallow copy of an object with a nested list means: a) nested list is duplicated b) both objects share the same nested list reference c) compile error d) nested list becomes null
30. `super()` in a subclass constructor: a) calls the subclass constructor b) calls the parent constructor c) is illegal d) creates a new object

### ✅ Answer Key — Topic 1
1-b · 2-c · 3-b · 4-b · 5-c · 6-c · 7-b · 8-a · 9-c · 10-d · 11-c · 12-b · 13-b · 14-c · 15-b · 16-b · 17-a · 18-b · 19-b · 20-c · 21-a · 22-b · 23-b · 24-b · 25-b · 26-b · 27-b · 28-c · 29-b · 30-b

**Key explanations:** **8** Overloading = compile-time (static binding). **17** Static methods are *hidden*, resolved by reference type A. **18** Only abstract classes have constructors (called via `super()`); interfaces don't; constructors aren't inherited; static methods aren't overridden. **26** Reference type `List`, object `ArrayList` — upcasting enables polymorphism. **27** Runtime polymorphism = dynamic dispatch via the virtual method table. **28** FALSE because a `private` method is not visible to subclasses, so it **cannot** be overridden (only hidden/redefined independently). **29** Shallow copy shares the nested reference — a top trap.
