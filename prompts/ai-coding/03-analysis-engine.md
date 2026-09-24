# Analysis-engine prompt

Read `docs/SCIENTIFIC_RULES.md`, `docs/VALIDATION_PLAN.md`,
`schemas/analysis-result.schema.json`, and the relevant product section in the
long blueprint.

Implement one estimator or contrast on normalized, quality-filtered data. First
write the estimand and eligibility rules in plain language. Test calendar
weights, missing periods, serial dependence, outliers, interval coverage, and
the null case. Return effect size, units, fitted interval, uncertainty, valid
counts, diagnostics, method version, and an explicit status such as supported,
inconclusive, or ineligible. Do not expose a significance label without the
underlying method and test-family metadata. Compare regional slopes with a
paired contrast; never infer a difference from separate p-values.

