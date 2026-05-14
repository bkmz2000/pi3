# Improving Documentation - Specification

## Overview

This change ensures all project documentation accurately reflects the current codebase state.

## Documentation Audit Requirements

### Files to Audit

| File | Key Issues |
|------|------------|
| `AGENTS.md` | Missing Python linter section, missing instructor sharing section, outdated last updated date |
| `README.md` | References "Ruff (WASM)" for linting but linting is now pure Python via linter.py |
| `docs/01-project-overview.md` | Pyodide version mismatch (says v0.26.4 but should match worker.ts) |
| `docs/03-runner-module.md` | May contain outdated Ruff WASM references |
| `docs/07-linter.md` | Verify reflects current linter.py architecture |

### Version Verification Points

1. **Pyodide version**: Check in order of precedence:
   - `src/runner/worker.ts` — actual CDN URL used
   - `package.json` — npm package version
   - All docs should match `worker.ts`

2. **Linter technology**: 
   - Current: Pure Python linter.py running in Pyodide
   - Previous: Ruff WASM (deprecated)
   - Docs should reflect current state

### Content Updates Required

#### AGENTS.md Updates
- Update "Last Updated" date
- Add Python-based linter section (if missing)
- Add instructor sharing system section (if missing)

#### README.md Updates
- Fix "Python Runtime" row: remove "Ruff (WASM)" from linting description
- Verify all tech stack entries match actual code

#### docs/01-project-overview.md Updates
- Fix Pyodide version to match `worker.ts` (v0.26.4)

#### Cross-reference Check
- Ensure docs index (`docs/README.md`) exists and is accurate
- Verify cross-references between related docs work

## Verification

After updates, documentation should pass:
- `npm run lint` — no ESLint errors
- `npm test` — all tests pass (verify docs didn't break anything conceptually)