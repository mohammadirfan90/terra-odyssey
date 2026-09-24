# UI implementation prompt

Read `docs/UX_SPEC.md`, `docs/SCIENTIFIC_RULES.md`,
`prompts/google-stitch/DESIGN_SYSTEM.md`, and the relevant result schema.

Build the requested screen with real typed result data. Preserve the linked map
and time-series interaction, units, coverage, uncertainty, valid counts,
selection history, and methods disclosure. Implement loading, empty,
inconclusive, unavailable, and error states before visual polish. Use accessible
keyboard alternatives and text summaries for charts. Never display a decorative
“confidence” badge or a causal sentence that is not present in the typed result.
Do not fabricate NASA values to make the screen look complete; use a labeled
empty state or a cached real snapshot.

