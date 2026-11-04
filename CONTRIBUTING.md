# Contributing

Thanks for helping with Ipsomnia. This page is short on purpose: the project has
few rules, but they are firm.

## Ground rules

1. **Content is data, the engine is generic.** A new operation is a new object in
   `content.js`. If a content change needs an engine change, stop and discuss it first.
2. **No frameworks, no build step.** The game must open from a double-click, offline,
   on a phone. Vanilla JS only. Dev tooling (ESLint, Playwright) is fine; runtime
   dependencies are not.
3. **Targeted edits, not rewrites.** Never regenerate a file wholesale. One task, one commit.
4. **Mobile first.** Check every change at 390px width before desktop.
5. **The intro splash `#ipso-boot` in `index.html` is final.** Do not refactor or restyle it.
6. **Comments explain why, not history.** Put the reason for a decision next to the code;
   leave the history to git and `docs/DEVLOG.md`.

## Adding an operation

1. Read the schema at the top of `content.js`.
2. Append the object to `SCENARIOS_UK` **and** `SCENARIOS_EN` with the same `id`, the same
   numbers (`attack`, `fx`, `rep`, flags) and the same structure. Position in the array
   is difficulty: the map opens operations in waves of three.
3. Add a pin to `mapOps_UK` and `mapOps_EN` (coordinates in % of `assets/map_ukraine.png`).
4. Put art in `assets/` (optional; a missing file degrades gracefully).
5. Run `node validate.js`. It must print `PASS`. It checks UK/EN parity and "answer
   tells": the correct option must not stand out by length or punctuation.
6. Play the operation end to end on a phone-sized viewport.

## Content rules

- Living Ukrainian. No em dashes in post texts and answers. Posts of varying length;
  casual chats may be lowercase.
- Subtle narratives do not lie outright, they insinuate.
- Traps are sincere emotional posts without invented facts, and every honest post has
  a `w` explanation of why it is *not* IPSO.
- Every answer option has an `e` explanation. That text is the teaching core; do not cut it.
- Real events may serve as situation archetypes, but never with invented facts presented
  as real and never with real names of private individuals. All actors are fictional.

## Before you push

```bash
npm run lint     # node --check, validate.js, eslint
npm test         # headless playthrough (needs: npx playwright install chromium)
```

Commit messages: imperative mood, one logical change per commit
(`Add operation "elections"`, `Fix wildcard timer freeze on hint`).
