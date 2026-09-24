# Terra Odyssey design system for Stitch

Use this file as the project-level design reference. The interface should feel
like a calm scientific instrument panel rather than a marketing dashboard.

## Atmosphere

Precise, calm, trustworthy, exploratory, field-ready, and spacious. Favor clear
hierarchy over decoration. The map and evidence panel should feel connected;
the user should always know which data product, period, and region they are
looking at.

## Color roles

- ink: near-black text for primary evidence
- slate: secondary text and metadata
- paper: warm near-white canvas
- navy: structural navigation and headers
- teal: selected/active data state
- amber: caveat, incomplete support, or review-needed state
- red/blue diverging scale: signed slope direction only, never significance
- hatch/outline/opacity: evidence strength, missingness, or invalid support

Never use a red/green pair as the only semantic encoding. Never imply that a
red or blue slope is good or bad. Keep uncertainty visually separate from sign.

## Typography and layout

Use a readable sans-serif with a strong numeric style for measurements. Use an
8px spacing rhythm, generous panel padding, and a responsive two-column desktop
workspace that collapses to a single-column evidence flow on mobile. Keep the
primary action visible without turning the screen into a control wall.

## Components

- top navigation with product name, investigation ID, source/version, and export;
- question builder with reviewed-variable cards;
- map panel with legend, coverage toggle, geometry selection, and text table;
- linked time-series chart with interval band and valid-count footer;
- evidence card with effect, units, interval, status, method, and caveat;
- methods drawer with source, QA, aggregation, estimator, test family, and
  selection history;
- job status stepper with recoverable error state;
- empty/inconclusive state that explains what the data did not support.

## Interaction principles

Every map selection updates the chart and evidence. Every result has a methods
path. Preserve the user’s configuration in the URL or saved investigation. Use
motion only to explain a transition, with reduced-motion support.

