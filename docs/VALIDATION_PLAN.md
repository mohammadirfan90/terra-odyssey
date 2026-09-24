# Validation and release plan

## Scientific tests

- Unit conversions and scale factors against documented examples.
- Fill-value and QA-bit tests for every adapter.
- Calendar tests for leap years and month-hour precipitation conversion.
- Area-weighted aggregation against a hand-computed polygon fixture.
- Synthetic trend fixtures with known slope, seasonality, autocorrelation,
  missing months, outliers, and changepoints.
- Coverage and eligibility tests that reject incomplete annual totals.
- HAC/block-resampling comparison against a reviewed numerical reference.
- Multiple-testing simulation measuring false-discovery behavior under a null.
- Paired regional contrast test proving that separate significance labels are not
  used as a slope-difference test.
- Reproducibility rerun from a clean environment and frozen manifest.

## Product acceptance

- Each finding answers variable, place, period, direction, magnitude, and
  statistical status.
- Every result exposes source, release, QA, aggregation, estimator, valid count,
  uncertainty, and limitations.
- The UI distinguishes “not detected” from “no change.”
- A no-supported-pair outcome is displayed honestly.
- Cached outputs remain available when a NASA service is temporarily down.
- Exported JSON/CSV/report can recreate the investigation configuration.

## Release gate

No production release if units, missingness, QA policy, source version,
uncertainty, or selection history are absent from a result. Optional AI narration
must be grounded in typed result fields and must fall back to deterministic
templates when generation is unavailable.

