# Contributing to Terra Odyssey

Thank you for your interest in contributing to **Terra Odyssey**! We welcome contributions from Earth scientists, statistical researchers, software engineers, designers, and students.

## Non-Negotiable Scientific Principles

Before submitting any code or documentation, review [docs/SCIENTIFIC_RULES.md](docs/SCIENTIFIC_RULES.md) and [AGENTS.md](AGENTS.md):
1. **Preserve NASA Metadata**: Always retain collection IDs, versions, and DOIs.
2. **Never Call MERRA-2 a Direct Satellite Measurement**: MERRA-2 is a reanalysis model product.
3. **No Silent Infill**: Missing observations or months must never be zero-filled or smoothed.
4. **Honest Significance**: "Not statistically significant" means the data does not provide sufficient evidence to reject the null hypothesis of zero change—it does not prove no physical change occurred.
5. **No Causal Attribution**: Correlation and paired trends do not establish causality.

---

## Development Setup

### Backend (Python)
```bash
# Clone the repository
git clone https://github.com/mohammadirfan90/terra-odyssey.git
cd terra-odyssey

# Install dependencies in editable mode
pip install -e "./terra-odyssey[dev]"

# Run tests
pytest terra-odyssey/tests/ -v
```

### Frontend (Next.js)
```bash
cd terra-odyssey/src/frontend
npm install
npm run dev
```

---

## Code Quality & Testing

- Every analytical estimator must include unit tests and, where applicable, numerical reference oracle tests.
- Run `pytest terra-odyssey/tests/ -v` before committing.
- Run `npm run build` inside `terra-odyssey/src/frontend` to ensure TypeScript builds cleanly.
- After updating files in `terra-odyssey/`, execute `pwsh .\scripts\package-codebase.ps1` to keep `terra-odyssey.zip` synchronized.

---

## Pull Request Guidelines

1. Create a focused branch (`feat/...`, `fix/...`, `docs/...`).
2. Adhere to conventional commits (`feat: ...`, `fix: ...`, `docs: ...`, `test: ...`).
3. Ensure all tests pass.
4. Provide a clear description referencing any related issues.
