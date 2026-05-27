# Privacy

Sidekick is designed to run as a local browser extension. There is no project-owned backend in this repo.

## Data Stored Locally

Sidekick may store:

- AI provider mode
- Provider order
- API keys
- Ollama URL and model name
- Voice settings
- Theme choice
- Task state and recent logs
- Lightweight workflow preferences and memory

This data is stored with Chrome extension storage on your machine.

## Data Sent To AI Providers

When you ask Sidekick to complete a task, it may send task text, page summaries, visible page context, extracted links, form metadata, product data, or readable article text to the AI provider you configured.

If you choose Local Ollama, requests are sent to your configured Ollama server, usually `http://127.0.0.1:11434`.

If you choose Cloud API mode, requests are sent to the selected provider or fallback provider using your API key.

## Data Not Collected By This Repo

Sidekick does not include analytics, advertising tracking, or a project-owned telemetry service.

## Your Controls

- Remove API keys in Settings.
- Disable or remove the notch from the popup.
- Clear extension storage from the browser extension settings.
- Unload or uninstall the extension at any time.
