# Bootstrap prompt

Read `AGENTS.md`, `docs/CONTEXT_GUIDE.md`, `docs/PRODUCT_BRIEF.md`,
`docs/SCIENTIFIC_RULES.md`, `docs/API_CONTRACT.md`, and
`docs/IMPLEMENTATION_TREE.md`. Inspect the repository before writing code.

Create the smallest runnable vertical slice for one reviewed D1/D2
investigation: catalog → validated request → queued job → normalized result →
evidence panel → JSON export. Use an in-memory or local cache only for tests;
the real-data boundary must remain explicit. Add typed contracts, fixture tests,
and a README command that runs the slice. Do not add D3/D4, AI narration,
authentication, or arbitrary map search until the core slice and validation
tests pass. End with a list of files, commands, and known limitations.

