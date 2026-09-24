# Google Stitch workflow

Use Stitch for layout and interaction exploration, then hand the result to the
coding agent with the same durable design system and evidence rules. Generate
one screen at a time, keep the screen purpose and hierarchy explicit, and make
small focused refinements. Do not ask Stitch to invent scientific values or
statistical conclusions.

## Recommended sequence

1. Establish the project design system with `DESIGN_SYSTEM.md`.
2. Generate the landing screen from `MASTER_PROMPT.md`.
3. Generate the investigation workspace and methods drawer from
   `SCREEN_PROMPTS.md`.
4. Refine one component or state per prompt; do not mix a full layout rewrite
   with a new component.
5. Export or copy the result into the frontend, then make
   `docs/UX_SPEC.md` and the component tests authoritative.

Google describes Stitch as a text/image UI design tool that can iterate on
variants and export frontend code or paste to Figma. Treat its output as a
design proposal; the real data contracts and scientific rules remain in this
repository.

