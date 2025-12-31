# ARC Domain Overlay Rule

Status: LOCKED  
Applies To: All current and future ARC domains

---

## Purpose

This document defines the permanent separation between **ARC Core** and **Domain Overlays**.

This rule exists to protect determinism, safety, and long-term extensibility.

---

## ARC Core (Universal)

**ARC Core is defined exclusively by `ARC_VISION.md`.**

ARC Core specifies:
- The universal reasoning order
- Decision criteria and safety priorities
- Deterministic behavior (same inputs → same conclusions)
- What ARC will and will not do

Once approved, ARC Core **must not be reworked, reinterpreted, or replaced**.

---

## Domain Overlays (Contextual)

Domain documents (e.g. `ARC_CHEF_DOMAIN.md`) describe:
- How ARC Core reasoning is *expressed* in a specific professional context
- Domain-specific vocabulary, metaphors, and examples
- How risks and constraints appear in that domain

Domain Overlays may:
- Change language and framing
- Use domain-native terminology
- Provide concrete examples

Domain Overlays may **never**:
- Change reasoning order
- Override safety or profitability rules
- Introduce alternative decision logic
- Break determinism

---

## Authority Rule

If any conflict exists between:

- `ARC_VISION.md`
- A domain document

**ARC_VISION.md always wins.**

No exception.

---

## Future Domains

All future domains (e.g. Consultant, Startup Founder, Project Manager)
must comply with this rule.

They are overlays — not new cores.

---

End of document.

