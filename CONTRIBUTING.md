# Contributing

Thanks for helping make Sidekick better. Keep changes focused, readable, and easy to review.

## Local Setup

```bash
npm install
npm run build
```

Load `dist` as an unpacked extension from `chrome://extensions`.

## Development Flow

1. Create a branch from the latest main branch.
2. Keep the change scoped to one topic.
3. Update docs when behavior, setup, permissions, or workflows change.
4. Run `npm run typecheck` and `npm run build`.
5. Open a pull request with a clear summary and test notes.

## Code Style

- Prefer boring, direct code over clever code.
- Keep extension runtime files in `public/`.
- Keep popup UI code in `src/`.
- Avoid adding new dependencies unless they clearly earn their spot.
- Do not commit secrets, local build output, logs, or personal workspace files.
- Keep user-facing copy casual but clear. No emoji-heavy copy.

## Pull Request Checklist

- The extension builds with `npm run build`.
- The popup opens from the built `dist` folder.
- New permissions are explained in the README.
- User-facing copy is clean and typo-free.
- No API keys or private local files are staged.
