# Contributing to Nabby

Thanks for considering a contribution.

## Bugs

Open an issue at https://github.com/NJPTeam/nabby/issues. Please include:

- What URL / site you were trying
- Expected vs actual behavior
- `yt-dlp --version` and `python --version`
- Any relevant log output (strip personal info)

## Features

Open an issue first to discuss. Nabby intentionally stays minimal — not every feature belongs here. Features likely to be accepted:

- New supported sites
- UX improvements (keyboard, accessibility, mobile)
- Deployment guides for additional hosting providers
- Performance improvements

Features likely to be declined:

- YouTube support (deliberate, see `/about` and `/faq`)
- Multi-user accounts (out of scope — Nabby is single-user by design)
- A built-in queue or persistent library (use MeTube or youtubedl-material)
- Analytics or telemetry

## Development

```sh
git clone https://github.com/NJPTeam/nabby
cd nabby
./run.sh
```

Dev server runs on `http://127.0.0.1:5000` with auto-reload. See `app.py` for the request flow.

## Pull requests

- Keep changes small and focused.
- Match the existing style (vanilla JS, no framework, no build step).
- Update `CLAUDE.md` or `README.md` if you change user-visible behavior.
- No binary blobs unless strictly necessary.

## Code of conduct

Be decent. Harassment, discrimination, or bad-faith behavior gets you removed from the issue tracker without warning.
