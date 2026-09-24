# Scientific review prompt

Review the proposed diff against `AGENTS.md`, `docs/SCIENTIFIC_RULES.md`,
`docs/VALIDATION_PLAN.md`, and the affected data/API schemas.

Look specifically for: incorrect units; missing month treated as zero; QA or
fill values included; mismatched temporal/spatial support; hidden smoothing;
uncorrected map-wide multiple testing; serial dependence ignored; separate
significance mistaken for slope difference; “no change” used for non-detection;
MERRA-2 or MODIS mislabeling; causal language; missing source/version/manifest;
selection-aware inference omitted; and UI states that hide uncertainty.

Return a pass/fail table with file, issue, scientific consequence, severity, and
the smallest corrective action. If no issue is found, state what was actually
checked and what remains outside the review.

