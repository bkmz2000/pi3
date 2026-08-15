# AGENTS.md — pi3 Project

**This file is a thin entry point. [CLAUDE.md](CLAUDE.md) is the canonical, source-of-truth guide**
for this repository (commands, architecture, runner internals, student graphics API, linter,
editor features, sprite editor, instructor sharing, common pitfalls, agent instructions).

**Last Updated**: 2026-08-14

---

## What pi3 is

Browser-based Python IDE for teaching kids aged 10-12. Zero installation; students open a URL
and code. Supports plain Python, interactive input, and game development via an Actor-based
graphics API (Pyodide WASM in a Web Worker). Name: PI₃ (phosphorus triiodide — unstable,
pyrotechnic, like running code). Bilingual en/ru. See CLAUDE.md → Architecture for details.

---

## Knowledge Base (READ THIS FIRST — before reading any code)

This repo has a persistent knowledge base built on **mem0** (local embeddings + Chroma, `.mem0-trial/`).
It distills the whole codebase — architecture, all server routes, runner internals, the student
graphics API, known bugs, testing gates, deployment, i18n, examples — into ~340 searchable facts.

**Before exploring code or answering questions about the project, QUERY IT FIRST:**

    cd .mem0-trial && .venv/bin/python kb.py query "<question>" --user pi3-kb --limit 3

- ~10 seconds per query, **$0** (local embeddings; index-tier facts were extracted by dsv4-flash once, at build time).
- Check BOTH tiers: `--tier index` (distilled facts — start here) and `--tier archive` (verbatim sections from `kb-docs/*.md` — for full detail).
- **Bug/issue questions: use the dedicated bug scope** (facts rank correctly there, not diluted by general facts):
    cd .mem0-trial && .venv/bin/python kb.py query "<bug question>" --user pi3-bugs --collection kb_bugs --limit 5

### TRUST THE KB — do NOT re-derive facts from source

The KB was built from the actual code and is current. **When a KB answer covers the question,
treat it as authoritative — do NOT re-read source files to re-verify every fact** (e.g. re-grepping
each bug, re-reading RunnerProvider.tsx to confirm a bug it already documents). That re-derivation
is what turned a ~2K-token question into ~500K tokens. Only open source files when:
1. the task requires **fixing/editing** code (you need exact current code), or
2. the KB answer is genuinely insufficient, or
3. you need details beyond what the KB stores.

If you must verify a fact, do ONE targeted grep/read at the cited location — never sweep the file.

### Maintaining the KB
- Source documents live in `.mem0-trial/kb-docs/` (00-architecture through 11-known-bugs).
- After significant codebase changes, update the relevant doc and re-seed (cheap — DeepSeek prefix caching):

    cd .mem0-trial && .venv/bin/python kb.py archive kb-docs/*.md --user pi3-kb
    .venv/bin/python kb.py index kb-docs/*.md --user pi3-kb --batch 2

- Known bugs & API review findings: see `PROJECT_KNOWLEDGE.md` §7 (also indexed in the KB).

---

## Agent Instructions (summary — full rules in CLAUDE.md → Agent Instructions)

1. **ALWAYS** run `npm run lint` after making changes
2. **ALWAYS** run `npm test` for unit tests after changes
3. **ALWAYS** run `npm run test:puppeteer` for E2E tests
4. **NEVER** commit without verifying tests pass
5. **UPDATE** the docs (CLAUDE.md, docs/reference/04-graphics-module.md, api-v1.md) with significant API/architectural changes
6. **RESPECT** React 19 compiler constraints
7. **MAINTAIN** backward compatibility for student projects
8. **QUERY THE KB FIRST** (see above) — do not re-derive facts from source
9. **WRITE BACK EVERY IMPORTANT FINDING** — if you make a design decision, discover a bug or quirk, or learn something non-obvious, persist it: update `CLAUDE.md`/`docs/` and seed the KB (`kb.py index kb-docs/*.md --user pi3-kb --batch 2`). Do not let a finding die in this conversation — the KB is the project's long-term memory.

---

## See Also

- [CLAUDE.md](CLAUDE.md) — **the canonical guide** (read this)
- [docs/README.md](docs/README.md) — documentation index
- [docs/api-v1.md](docs/api-v1.md) — graphics API changelog
- [docs/reference/04-graphics-module.md](docs/reference/04-graphics-module.md) — graphics API reference
- [docs/ROADMAP.md](docs/ROADMAP.md) — planned and in-progress features
