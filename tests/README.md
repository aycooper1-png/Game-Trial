# Tests

Playwright scripts that drive the game in Chrome. See section 5 of [../CLAUDE.md](../CLAUDE.md) for how to run them
and what each one covers. Serve the repo root first: `python3 -m http.server 8765`.

They import Playwright from `/opt/npm-tools/node_modules/playwright/index.mjs` and launch `/usr/bin/google-chrome`;
change those two paths for your machine.
