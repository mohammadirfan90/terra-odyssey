# Task prompt template

Use this template for a focused coding request.

```text
You are working in the Terra Odyssey repository.

Goal
[Describe one observable behavior or one bounded refactor.]

Read first
@AGENTS.md
@docs/CONTEXT_GUIDE.md
@docs/PRODUCT_BRIEF.md
@docs/SCIENTIFIC_RULES.md
@[add only the relevant schema, manifest, screen spec, or error]

Constraints
- Preserve the active Trend Detective challenge and the public API contracts.
- Use real source metadata and keep units/coverage/quality visible.
- Do not invent fields, endpoints, statistical results, or causal explanations.
- Keep the change scoped; do not add unrelated dependencies or features.

Plan
1. Inspect the current implementation and identify the smallest safe change.
2. State assumptions and files to modify.
3. Implement with tests.
4. Run validation and inspect the result.

Done when
- [specific behavior]
- [specific test or numerical check]
- [schema/provenance/accessibility requirement]
- [no unresolved warning or explicit limitation]
```

