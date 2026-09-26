# Contributing to Terra Odyssey

Thank you for your interest in contributing to **Terra Odyssey**! We welcome contributions from scientists, software engineers, educators, and Earth science enthusiasts participating in or building upon the NASA Space Apps Challenge **"Be An Earth System Trend Detective!"**.

---

## 1. Code of Conduct & Scientific Principles

All contributors must uphold our [Code of Conduct](../CODE_OF_CONDUCT.md) and adhere strictly to our **Non-Negotiable Science Rules**:

- **Real NASA Data**: Always use real, versioned NASA products (`M2TMNXSLV`, `GPM_3IMERGM`, `MOD11A2`, `MOD13A3`). Never invent synthetic data or endpoints for production pipelines.
- **Autocorrelation Awareness**: Environmental time series are autocorrelated. Any trend reporting must account for serial correlation (e.g. Newey-West HAC covariance, Hamed & Rao modified Mann-Kendall variance correction, or Moving Block Bootstrap).
- **Missingness & Masks**: Never silently treat missing months or masked quality flags as zeros. Product-specific quality flags and fill values must be explicitly masked out prior to aggregation.
- **No Fallacy of Contrasts**: A statistically significant trend in Region A and a nonsignificant trend in Region B do not prove that their slopes differ. Always evaluate differences via a paired contrast test.
- **No Causal Overreach**: Correlation or co-trending is not causal attribution. Always report findings with confidence bounds, p-values, and explicit caveats.

---

## 2. Development Setup

The repository is organized into independent `backend/` and `frontend/` applications inside `terra-odyssey/`.

### 2.1 Backend Setup (Python 3.11 – 3.13)
```bash
cd terra-odyssey/backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\Activate.ps1

# Install dependencies with development tools
pip install -e .
pip install pytest pytest-cov black flake8 httpx
```

Run test suite:
```bash
pytest -v
```

### 2.2 Frontend Setup (Node.js 20+)
```bash
cd terra-odyssey/frontend

# Install dependencies
npm ci

# Typecheck and production static build
npm run typecheck
npm run build

# Start local development server
npm run dev
```

---

## 3. Git Workflow & Branch Conventions

We follow a modular, atomic Pull Request workflow. Each PR should address a single focused objective.

### Branch Naming
- `feat/<feature-name>`: New analytical features, data adapters, or UI components.
- `fix/<issue-name>`: Bug fixes, CI corrections, or edge-case handling.
- `docs/<doc-name>`: Documentation, guides, or specifications.
- `test/<test-name>`: Unit tests, numerical validation, or benchmark suites.
- `ci/<workflow-name>`: GitHub Actions workflows and automation.

### Conventional Commit Format
Use structured commit messages:
```
<type>(<scope>): <short description>

[optional body explaining rationale]
```
Examples:
- `feat(adapters): add D4 MODIS Vegetation Index NDVI adapter`
- `fix(frontend): resolve logo asset import in page header`
- `test(analysis): add unit tests for modified Mann-Kendall estimator`
- `docs(api): document RFC 9457 error contracts for V2 API`

---

## 4. Code Quality & Pre-Commit Checklist

Before opening a pull request, ensure all of the following pass:

1. **Backend Tests**: `pytest` passes with 0 failures (`103+ passed`).
2. **Frontend Typecheck**: `npm run typecheck` (`tsc --noEmit`) passes with 0 errors.
3. **Frontend Build**: `npm run build` completes without compilation errors.
4. **Archive Synchronization**: Run the root packaging script:
   ```powershell
   pwsh .\scripts\package-codebase.ps1
   ```
   Verify that `terra-odyssey.zip` on the repository root is updated without including `.venv`, `node_modules`, or temporary cache files.
5. **No Secrets**: Never commit NASA Earthdata passwords, bearer tokens, or personal credentials.

---

## 5. Submitting Pull Requests

1. Push your branch to GitHub:
   ```bash
   git push -u origin <your-branch-name>
   ```
2. Open a Pull Request via GitHub or `gh pr create`:
   ```bash
   gh pr create --title "type(scope): description" --body "## Summary\n...\n## Verification\n..."
   ```
3. Ensure CI workflows (`Backend CI` and `Frontend CI`) pass cleanly.
4. Request review from maintainers or tag the issue you are resolving.
