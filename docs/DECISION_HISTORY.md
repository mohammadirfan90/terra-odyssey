# Decision history and conflict resolution

## Current implementation target

The active system in this package is **Terra Odyssey / Be An Earth System Trend
Detective!**. That is the challenge text supplied in the original project brief
and the direction for which the 46-page scientific blueprint was produced.

## Why another report names Dancing with the SARs

The revised challenge-selection research report dated 24 September 2026
recommends **Dancing with the SARs** as a competition-selection decision and
names Trend Detective as a science-heavy fallback. An earlier research paper
recommends a SPHEREx/Planet X direction. Those reports answer the broader
question “which challenge should be selected?”; they are not the implementation
authority for this repository.

## Rule for coding agents

Do not change the challenge, data family, or product name because a reference
document mentions another option. If the team explicitly decides to switch,
create a new decision record and a new product package; do not silently mutate
Terra Odyssey into a NISAR or SPHEREx application.

## Decision rationale for this package

Terra Odyssey is kept here because the supplied brief explicitly requested it,
the complete scientific blueprint exists, and its core D1/D2 suite has a lower
data-access and processing risk than a new-mission MVP. The system also matches
the team’s stated preference for large NASA/partner datasets and meaningful
environmental impact without requiring local soil reports.

