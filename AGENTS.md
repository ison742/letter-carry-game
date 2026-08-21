# Letter Carry contributor instructions

This repository is a dependency-free static web game intended for GitHub Pages.

- Keep gameplay in `app.js`, presentation in `styles.css`, and structure in `index.html`.
- Preserve the six-round 3-to-8-letter progression and the rule that every solved letter carries into the next answer.
- A full incorrect guess must be recorded, rejected automatically, and cleared when the player enters the next letter.
- Preserve the three game-wide hints in order: remove a distractor, reveal the first letter, reveal the second letter.
- Run `deno check app.js` and `python3 verify_game.py` after behavior or presentation changes.
- Keep `PLAN.md` current when scope, acceptance criteria, or verification changes.
- Commit between substantive development turns with a message describing the completed slice.
- Never add credentials, generated dependency directories, or machine-local configuration.
