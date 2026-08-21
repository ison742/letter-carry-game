# Letter Carry

A self-contained six-round word puzzle inspired by the operator’s chalkboard mockup. Every answer carries into the next round, where one new letter turns it into a longer word.

## Run

The app has no build step or runtime dependencies. Open `index.html` directly, publish this directory with GitHub Pages, or serve it from any static file server.

With Deno and the standard file-server package:

```sh
deno run --allow-net --allow-read jsr:@std/http/file-server .
```

## Verify

The acceptance verifier launches a local static server and drives the full game in Chromium:

```sh
python3 verify_game.py
```

It checks the 3→8 row geometry, exact-answer behavior, carried letters, all three hints, complete playthrough, restart, mobile overflow, browser errors, and writes desktop/mobile screenshots under `artifacts/`.
