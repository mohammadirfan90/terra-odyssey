# Terra Odyssey — UX specification

## Primary journey

Question → variable and source → time range → map/coverage → region selection
→ time series → magnitude → uncertainty/significance → regional contrast →
sensitivity → evidence panel → export/share.

The same computation powers guided and expert modes. Guided mode hides advanced
controls but never hides the method or caveat. Expert mode exposes masks,
aggregation, estimator, diagnostics, selection history, and raw summaries.

## Required screens

1. **Landing / question builder:** explain the challenge, show reviewed
   variables, and start a bounded investigation.
2. **Investigation workspace:** persistent source/period/geometry controls,
   map, coverage layer, time series, and evidence drawer.
3. **Trend map:** diverging slope map with separate significance/evidence
   encoding; never use color alone to communicate certainty.
4. **Region comparison:** linked series, paired contrast, interval, valid counts,
   and explicit statement when slopes do not differ.
5. **Methods inspector:** product release, units, QA policy, aggregation,
   estimator, multiplicity family, and limitations.
6. **Findings/export:** typed conclusion, effect size, uncertainty, provenance,
   configuration, citations, and download/share controls.

## Visual hierarchy

The main visual is the scientific evidence, not a decorative hero. Use a calm,
instrument-panel feel: strong typography, restrained color, generous whitespace,
and a stable left-to-right reading order. A map and a time series must be
linked; selecting a region updates both. The evidence panel must remain legible
on a small screen.

## Required states

- loading with source and job state;
- empty/no supported result;
- incomplete temporal coverage;
- quality-filtered sparse coverage;
- unavailable NASA service with cached-result fallback;
- statistically inconclusive result;
- error with recoverable action;
- expert diagnostics expanded;
- export-ready immutable snapshot.

## Accessibility and honesty

Use keyboard-accessible map alternatives, text tables for charts, colorblind-safe
encodings, visible units, non-color direction markers, readable uncertainty
language, reduced-motion support, and no misleading “confidence” badges.

