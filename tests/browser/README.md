# Browser walkthrough checks

These tests exercise the learner-facing browser, not only the Dify API.

## One-time setup

```bash
npm install
npx playwright install chromium
```

The Playwright config starts `vercel dev` automatically and loads `.env.local` when a separate `BROWSER_BASE_URL` is not supplied.

## Fast UI contract test

No Dify calls or token spend. The API is mocked so this can be run after frontend changes:

```bash
npm run test:browser
```

It checks that:

- the chat is its own scroll container and follows new messages;
- long chat history does not push the world/composer off-screen;
- Follow/Guide positional answer labels are not visible on the board.

## Live browser walkthrough

Uses the published Dify workflow through the real `/api/chat` proxy:

```bash
npm run test:browser:live
```

For visible debugging:

```bash
npm run test:browser:headed
```

The live walkthrough automatically completes Follow and Guide, chooses Tic-Tac-Toe, then checks the browser-visible integrity contracts exposed by the manual walkthrough:

- ordinary relative placement executes in Guide;
- a generated 3×3 structure starts visually empty;
- a delegated Raku turn produces a real visible X action;
- a learner O action remains learner-owned in both action data and narration;
- the running workflow identifies itself as r13.

Local `/api/chat` turns are also appended to ignored `.artifacts/walkthrough.ndjson`. Playwright keeps traces/screenshots/videos on failures under ignored artifact directories.

To point the tests at an already-running or deployed frontend instead of starting `vercel dev`:

```bash
BROWSER_BASE_URL=https://your-preview.example npm run test:browser:live
```
