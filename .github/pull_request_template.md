## Description

Brief summary of changes made in this pull request.

## Type of Change

- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Scientific / Analytical enhancement (estimator, mask, aggregation)
- [ ] Documentation / Tutorial update
- [ ] CI / Tooling improvements

## Scientific Guardrails Checklist

- [ ] Does not perform causal attribution.
- [ ] Preserves NASA collection/version metadata.
- [ ] No silent infill or zero-filling of missing calendar intervals.
- [ ] Signed trend visuals use zero-centred diverging scales (no Viridis for signed trends).
- [ ] Unit and numerical tests added/updated.

## Verification

- [ ] `pytest terra-odyssey/tests/ -v` passes cleanly.
- [ ] `npm run build` in `src/frontend` passes cleanly (if frontend modified).
- [ ] Codebase archive refreshed via `pwsh .\scripts\package-codebase.ps1`.
