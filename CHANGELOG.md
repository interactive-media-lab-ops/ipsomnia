# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project does not yet use
semantic versioning strictly (the UI shows `v0.3 · DEMO BUILD`).

## [0.3.0] · 2026-11-04

Pre-hackathon release. No gameplay changes compared to the previous commit.

### Added
- `ARCHITECTURE.md`: runtime flow, state, economy table, technical decisions.
- Bilingual README (`README.md` EN, `README.uk.md` UA) with screenshots.
- `CONTRIBUTING.md`, `LICENSE`, `CHANGELOG.md`, `.editorconfig`, `.gitattributes`.
- `package.json` with `lint`, `test`, `serve` scripts; ESLint flat config.
- `test/smoke.js`: headless Playwright playthrough (title → cutscene → role → map →
  feed + OSINT → technique → counter → AAR → finale → creator).
- GitHub Actions CI running syntax check, content linter, ESLint and the smoke test.
- `docs/DEVLOG.md`: development log and backlog.

### Changed
- Every source file got an EN + UA header; `engine.js` is split into 12 numbered sections
  in play order; `content.js` documents the full operation schema.
- Changelog-style comments ("Task 12", "FIX 4", "playtest note") rewritten into
  explanations of intent. Long one-line functions split into readable lines.
- `AEGIS_demo_v03.html` and `design/crt-lab.html` moved to `archive/`.

## [0.2.x] · 2026-07 … 2026-10

- Four operations from briefs: Tired Europe, Elections, Deep-Strike, Dirty Bomb (13 total).
- English localisation; wave-gated campaign map; separate music toggle.
- Red Team creator mode behind a flag; `?pack=` loader; feedback link.
- CRT design system, intro splash, mobile and audio fixes; defeat state; OSINT branding.
- Self-hosted fonts; timer, wildcard and feed fixes; operation 6 and boss rework.

## [0.1.0] · 2026-07-04

- Initial checkpoint: core engine split from the single-file demo into
  `index.html` / `engine.js` / `content.js`; tasks 0–12 of the original backlog.
