# Sidekick

Sidekick is a Chromium browser extension that puts an AI command notch on the page you are using. Ask it to summarize, search, compare, fill, write, scroll, click, or open things, and it turns that request into browser actions.

It is built for people who want the browser to feel less like chore mode and more like "cool, handle this for me."

## Status

Sidekick is installable as an unpacked Chromium extension. It is not packaged for the Chrome Web Store yet.

## What It Does

- Opens a clean extension popup for setup, model selection, and task control.
- Injects a persistent floating notch into normal webpages.
- Reads page context, visible controls, links, form fields, products, headings, tables, and readable article text.
- Runs browser actions like opening sites, clicking links/buttons, typing into fields, scrolling, searching, and extracting content.
- Supports cloud provider fallback order for Gemini, OpenRouter, Groq, OpenAI, and Claude.
- Supports local Ollama through `http://127.0.0.1:11434`.
- Stores API keys and learned preferences in `chrome.storage.local`.
- Includes workflow packs for shopping, YouTube, research, writing, productivity, and forms.

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- Chrome Extension Manifest V3
- Local helper bundle with Fuse, Readability, chrono-node, compromise, MiniSearch, localForage, linkify, currency.js, and Tesseract.js

## Project Structure

```text
Sidekick/
  public/
    background.js              Extension service worker and agent loop
    content.js                 Page runtime, DOM tools, and floating notch
    followupEngine.js          Follow-up prompts and reply parsing
    memoryManager.js           Local memory and preference helpers
    manifest.json              MV3 extension manifest
    sidekick_logo.png          Extension icon
    vendor/                    Built local helper libraries and OCR runtime
    workflows/                 Domain workflow packs
  src/
    App.jsx                    Popup UI
    main.jsx                   React entry
    sidekickLocalLibs.js       Source for the bundled helper runtime
    components/Illustrations.jsx
    styles/index.css
  index.html
  package.json
  vite.config.js
  vite.sidekick-libs.config.js
```

## Setup

Requirements:

- Node.js 20.19 or newer
- npm
- Chrome, Brave, Edge, or another Chromium browser

Install dependencies:

```bash
npm install
```

Build the extension:

```bash
npm run build
```

Load it in the browser:

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Click `Load unpacked`.
4. Select the `dist` folder.

For local popup development:

```bash
npm run dev
```

For a production preview:

```bash
npm run preview
```

## Scripts

```text
npm run dev          Start the Vite dev server for the popup UI.
npm run build:libs   Rebuild the local helper bundle in public/vendor.
npm run build        Rebuild helper libs, then build the extension into dist.
npm run preview      Preview the built popup.
npm run typecheck    Run TypeScript checks over JS/JSX project files.
```

## AI Setup

Sidekick can use cloud providers or a local Ollama server.

Cloud mode:

1. Open the extension popup.
2. Go to Settings.
3. Choose provider order.
4. Add at least one API key.
5. Save and launch the notch.

Local mode:

1. Install Ollama.
2. Pull a model, for example `ollama pull qwen2.5:3b`.
3. Keep Ollama running at `http://127.0.0.1:11434`.
4. Select Local Ollama in Settings.

## Permissions

Sidekick asks for broad extension permissions because browser automation is the whole point. The important ones:

- `tabs` and `activeTab`: find and control the current browser tab.
- `scripting`: inject the content runtime when needed.
- `storage`: keep settings, keys, tasks, and local memory.
- `clipboardRead` and `clipboardWrite`: support copy/paste browser tasks.
- `<all_urls>`: let the notch and DOM tools work across normal websites.

This is powerful access, so keep the extension loaded only from code you trust.

## Privacy

Short version: no hidden analytics, no project-owned backend, no random telemetry.

Sidekick stores settings and keys locally through Chrome storage. When you ask Sidekick to use an AI provider, relevant task context may be sent to the provider you configured. If you use Ollama, requests go to your local Ollama server.

Read [PRIVACY.md](PRIVACY.md) for the fuller version.

## Release Checklist

Before shipping a build:

1. Run `npm ci`.
2. Run `npm run typecheck`.
3. Run `npm run build`.
4. Load `dist` as an unpacked extension.
5. Check popup boot, settings, API key save/delete, Ollama check, notch launch/hide, and one simple browser action.
6. Confirm no secret keys or generated local folders are staged.

## Troubleshooting

Blank popup:

- Re-run `npm run build`.
- Reload the extension in `chrome://extensions`.
- Make sure the loaded folder is `dist`, not the repo root.

Notch will not launch:

- Use a normal webpage. Chrome pages like `chrome://extensions` cannot be injected.
- Refresh the tab after installing or rebuilding the extension.
- Check that at least one provider is configured, or select Local Ollama and verify connection.

Ollama is offline:

- Start Ollama.
- Open `http://127.0.0.1:11434/api/tags` in a browser to confirm the server responds.
- Make sure the model name in Settings matches an installed model.

## Contributing

Pull requests are welcome. Keep the vibe clean, practical, and low-drama. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
