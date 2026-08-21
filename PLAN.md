# Letter Carry plan

1. Build a polished responsive board with rows of 3 through 8 letter boxes and six selectable free letters.
2. Implement system-selected exact answers, automatic full-word checking, carried letters, distractors, and previous-attempt history.
3. Implement three ordered, game-wide hints and a restartable six-round flow.
4. Verify desktop and mobile behavior through a complete browser-driven playthrough.
5. Publish the committed static app to GitHub and enable GitHub Pages from the default branch root.

## Acceptance

- Rows contain exactly 3, 4, 5, 6, 7, and 8 boxes.
- Valid alternatives remain incorrect unless they match the system-selected answer.
- Every next-round answer contains all letters from the previous answer, marked as carried letters.
- A rejected full guess appears in attempt history; the next letter automatically starts a fresh guess.
- Hints are limited to three uses per game and apply in the required order.
- The app completes without horizontal overflow or browser errors at desktop and mobile sizes.
- GitHub repository and GitHub Pages links are publicly reachable.

## Status

- [x] Game design and implementation
- [x] Automated browser acceptance and screenshots
- [x] Dedicated GitHub repository created
- [x] Initial governed commit and push
- [x] GitHub Pages deployment and live verification
