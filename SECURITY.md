# Security Policy

Sidekick is a browser automation extension, so security reports matter a lot.

## Supported Version

The current `main` branch is the supported development line.

## Reporting A Vulnerability

If you find a vulnerability, do not open a public issue with exploit details. Use GitHub private vulnerability reporting if it is enabled for the repo. If it is not enabled, contact the maintainer privately first and share the smallest useful reproduction.

Helpful report details:

- Browser and version
- Sidekick commit or release version
- Affected page or workflow
- Steps to reproduce
- Expected behavior
- Actual behavior
- Impact, especially if secrets, page data, or unwanted browser actions are involved

## Security Notes

- API keys are stored in `chrome.storage.local`.
- Sidekick can read and act on normal webpages after you load it.
- AI providers may receive task context when you ask Sidekick to use them.
- Never load an unpacked extension build from code you do not trust.
