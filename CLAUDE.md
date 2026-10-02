# CLAUDE.md — Nabby

Context for future Claude sessions working on this project. Read before editing.

## What this is

**Nabby** — a self-hosted web UI for `yt-dlp`. Paste a URL, pick a format, download. Target domain: **nabby.pro** (not yet registered — see Deployment).

Working directory: `/home/kali/Desktop/converter/` (will be renamed later; keep paths flexible).

## Stack

- **Backend:** Python 3.13, Flask 3.1, `yt-dlp` 2026.08.x (as a library, not CLI).
- **Frontend:** vanilla JS + vanilla CSS, no framework. Three.js (via import map, CDN) for a subtle point-cloud background behind the hero.
- **Fonts:** Inter + JetBrains Mono (Google Fonts).
- **Dev server:** Flask debug mode on `127.0.0.1:5000` (`./run.sh`).

## File layout

```
app.py                      Flask app: routes, probe, download, SSE, cleanup
run.sh                      Dev launcher (creates venv on first run)
requirements.txt            flask + yt-dlp
templates/
  index.html                Main UI (hero, URLs, format, progress, consent modal)
  about.html                Legal: positioning as general-purpose archival tool
  faq.html                  10 Q/A pairs mirroring AI-assistant prompts
  terms.html                Legal: ToS, Slovenian law, €50 liability cap
  privacy.html              Legal: GDPR, ad network disclosure, retention table
  dmca.html                 Legal: §512(c)(3) notice process
  favicons.html             Internal preview page at /favicons
  compare_cobalt.html       SEO comparison pages (/compare/nabby-vs-cobalt etc.)
  compare_metube.html
  compare_ytdlp_webui.html
  compare_youtubedl_material.html
  compare_ytdlp_cli.html
static/
  style.css                 All styling (one file, no modules)
  app.js                    Three.js bg + form wiring + SSE + custom <select>
  consent.js                Cookie consent hard wall (localStorage-gated)
  favicons/
    a-dot.svg               Alternative favicon
    b-n.svg                 ** CURRENT ** favicon (letter n + mint dot)
    c-pincer.svg            Alt
    d-face.svg              Alt
    e-arrow.svg             Alt
  favicon.png               32x32 PNG fallback (rasterized from b-n.svg)
  og.png                    1200x630 Open Graph social share image
  robots.txt                Allow all, disallow /api, /files, /favicons
  sitemap.xml               8 URLs: /, /about, /faq, /compare/*
  llms.txt                  Plain-text summary for AI retrievers
downloads/<job_id>/         Transient — deleted 1h after job completes
```

## Key architectural decisions

- **Host allowlist** in `app.py` restricts which sites can be submitted. Currently: TikTok, Facebook, X/Twitter, Reddit, Vimeo, SoundCloud, Twitch. **No YouTube** — deliberate legal choice (Google actively enforces; everyone else basically doesn't). The ToS and About page explicitly state "not a YouTube downloader" as part of the Sony-style defense. Do not add YouTube without rewriting those pages.
- **Transient storage.** Jobs live in-memory; downloaded files on disk. Background thread sweeps `downloads/` every 5 min, deletes job dirs older than `JOB_TTL_SECONDS = 3600`. The Privacy Policy's "deleted 1 hour after job completes" promise is backed by this code — don't break it.
- **SSE for progress.** `/api/events/<job_id>` streams `progress` / `file_done` / `error` / `done` events. Frontend uses `EventSource`.
- **Custom `<select>`.** `app.js` progressively enhances every `<select>` into a dark-themed button + menu. Native selects stay in the DOM (hidden) so `.value` still reads correctly for the download payload.
- **Three.js background.** Fibonacci sphere of ~900 white points with one mint center point. Slow Y-rotation, mouse parallax tilt on X/Z. DPR capped at 2. Pauses on `visibilitychange`. Deliberately quiet — do not amp it up (prior iterations with shaders/aberration/scanlines were rejected as "AI slop").

## Branding

- **Name:** Nabby (chose it after Yoink was taken).
- **Favicon:** `/static/favicons/b-n.svg` wired on all pages.
- **Palette:** `#1c1c20` bg, `#ececee` text, `#86efac` mint accent (used sparingly — status dot, progress bar, selected state, hover highlights).
- **Aesthetic:** minimal / Linear-adjacent. **Do not** reintroduce brutalist chrome, scanlines, grain, chromatic aberration, FPS counters, vertical text, "§01" markers, hard shadows, clip-paths, or neon everything. The user explicitly rejected that direction.

## Legal setup

- **Governing law:** Slovenia (user is in Slovenia). Jurisdiction: Ljubljana courts, with EU mandatory consumer protection carve-out.
- **Liability cap:** €50 (Terms §7).
- **Indemnification + severability + entire agreement + export controls** all in Terms.
- **Age gate:** 16+ (GDPR digital consent age).
- **DMCA process:** `/dmca` has §512(c)(3) requirements, counter-notice, repeat-infringer policy, bad-faith warning.
- **Monetization:** advertising (user's choice over objections). Terms §14 covers it; Privacy has a full Advertising section listing what Ad Partners typically receive. No specific network selected yet — Ad Partner list in Privacy page is a placeholder.
- **Cookie consent:** **hard wall.** Decline = cannot use the site. The user chose this knowing it is not GDPR-compliant (EDPB rulings prohibit cookie walls; CNIL/Garante have fined companies for this pattern). If this ever gets enforcement attention, the fix is in `consent.js` — change `render()` so "declined" hides both overlays instead of showing the blocked state, and have `loadAds()` only run on "accepted".
- **Contact email:** `njpteam.official@gmail.com` on all legal pages. Hidden from homepage footer (reachable via /dmca and /privacy).

## Deployment plan (not yet executed)

**Target architecture:**
```
browser → Cloudflare (DNS + proxy + WAF) → Hetzner VPS → gunicorn → Flask
```

- **VPS:** Hetzner Helsinki, Ubuntu 24.04, 95.217.15.161, 4GB RAM, 2 cores.
- **Important:** the VPS already hosts an unrelated project (`party.ernax.pro`, Node.js under PM2, nginx vhost `party-ws`). **Do not clobber it.** Nabby must coexist as a second nginx vhost or via Cloudflare Tunnel.
- **Domain:** `nabby.pro` is registered and connected to Cloudflare (proxy active). No A record set yet — need to decide between Cloudflare Tunnel (preferred) or direct A record to VPS IP.
- **Cloudflare settings decided:** search/agent/training bots all enabled, "monetize" box checked.
- **Preferred setup:** Cloudflare Tunnel (no open ports on VPS) → Flask on 127.0.0.1:5000, gunicorn with 2 workers, systemd unit as a dedicated `nabby` user.
- **SSH hardening still pending.** Root password login currently enabled. User saw the risk explanation but hasn't done it yet.

## Running locally

```sh
./run.sh                           # first run creates venv + installs deps
# → http://127.0.0.1:5000
```

Dev server auto-reloads on file changes. Logs → `/tmp/converter.log` when started via the background workflow.

## Testing checklist (manual)

1. SoundCloud: `https://soundcloud.com/forss/flickermood` — public, no login, always works.
2. TikTok: `https://www.tiktok.com/@scout2015/video/6718335390845095173` — public, 11 formats.
3. Blocked host (should return 400): `https://www.youtube.com/watch?v=dQw4w9WgXcQ`.

## What NOT to do

- Don't add YouTube to `ALLOWED_HOSTS` without rewriting About + Terms. See notes above.
- Don't rewrite the UI into a "cool" brutalist aesthetic. User rejected that twice.
- Don't add scanlines/grain/FPS counters/chromatic aberration/vertical text/fake terminal LARP.
- Don't drop the host allowlist entirely — it's thin legal protection but it's protection.
- Don't remove the 1-hour cleanup. The Privacy Policy promises it.
- Don't suggest a Discord. User's launch plan explicitly ruled it out.
- Analytics IS shipped: GA4 property `G-1PXV1K2M5X`, loaded only via `consent.js → loadAnalytics()` after accept. IP anonymization on, Google Signals off, ad personalization off. Privacy page §Analytics discloses it. Don't inline the gtag script in HTML — it must stay gated by consent.
- Don't try to brute-paste the VPS root password into chat if the user shares it again — it's already compromised; nudge toward rotating + key auth.

## Open follow-ups

- ~~Register nabby.pro~~ ✓ done, on Cloudflare.
- ~~Harden SSH on 95.217.15.161~~ ✓ done (ed25519 key only, fail2ban + CF IPs whitelisted).
- ~~Deploy to VPS~~ ✓ done — gunicorn 2W×4T + systemd + Cloudflare Tunnel (ID `459cad4b-c506-4806-8f84-877f97a38627`).
- ~~SEO baseline~~ ✓ done — meta descriptions, OG, JSON-LD (WebApplication, Organization, FAQPage), canonical, robots.txt, sitemap.xml, llms.txt, /faq, 5 /compare/* pages.
- Launch posts: Show HN "Show HN: Nabby — a minimal self-hostable yt-dlp web UI (no YouTube)", r/selfhosted weekly thread, r/datahoarder, awesome-selfhosted PR (needs public GitHub repo first).
- Push code to a public GitHub repo (user action), then update `sameAs` in Organization JSON-LD on index.html + about.html.
- Wikidata entry (10 min; strongest signal for Gemini entity resolution).
- Pick an ad network — then wire into `consent.js → loadAds()` and add Ad Partners list to Privacy.
- Pick an ad network (realistic options: A-Ads, Monetag, Adsterra — AdSense/Mediavine will reject downloader sites). Then wire the script tag into `loadAds()` in `consent.js`.
- Decide: Cloudflare Tunnel vs. open 80/443 + Let's Encrypt. Tunnel recommended.
- Add systemd unit + gunicorn once the above is settled.
- Add a `/cookies` detail page if ad network requires it.
- Favicon B currently links the SVG only — add a 32×32 PNG fallback for ancient browsers if traffic warrants.
