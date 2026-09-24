# Terra Odyssey — Scripts directory

Put deterministic acquisition, validation, and export scripts here. Scripts
must accept explicit configuration paths, print source/version and manifest
identifiers, and fail closed on missing data or invalid units. Do not commit
credentials or a script that silently downloads an unpinned “latest” product.

## GSD Validation & Automation Scripts

- `validate-all.ps1` / `validate-all.sh`: Runs complete GSD validator suite across workflows, skills, subagents, and templates.
- `validate-workflows.ps1` / `validate-workflows.sh`: Validates all 27 GSD workflows.
- `validate-skills.ps1` / `validate-skills.sh`: Validates all 12 GSD skills.
- `validate-agents.ps1` / `validate-agents.sh`: Validates GSD subagent definitions.
- `validate-templates.ps1` / `validate-templates.sh`: Validates `.gsd/templates/`.
- `search_repo.ps1` / `search_repo.sh`: Search-first repo query utility.
- `setup_search.ps1` / `setup_search.sh`: Verifies search tool availability (ripgrep/grep/git grep).

