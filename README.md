# Music Personality — Spotify Wrapped reimagined

A web app for the [8x Engineer "Spotify Wrapped Personality" contest](https://8xengineer.com/contests/spotify-wrapped-personality-app). Built on the [8xsocial/template-webapp](https://github.com/8xsocial/template-webapp) starter (Next.js 16 + React 19 + Tailwind 4) — Supabase scaffolding stripped in favor of Spotify OAuth, since the prompt only requires a Spotify-connected personality analyzer.

## Two ways in

The app ships with **two interchangeable data providers** so it works for everyone, not just users on the Spotify dev-mode allowlist:

- **Last.fm (primary, recommended)** — Type any public Last.fm username. No login, no OAuth, no allowlist. Works for any user worldwide. Last.fm scrobbles auto-record from Spotify/Apple Music/YouTube Music — millions of people already have this set up at <https://www.last.fm/settings/applications>.
- **Spotify OAuth (secondary)** — PKCE flow against the user's own Spotify. Better data, but Spotify's Development Mode requires the developer to manually allowlist each user (≤ 25). Use this once you're approved for Extended Quota.

Both paths feed the **same** classifier ([lib/personality.ts](lib/personality.ts)) so archetype, DNA chart, and persona card render identically regardless of source.

## What it does

Pick a path → we read your top artists and top tracks → you get:

- **One of 8 listening archetypes** — Underground Curator, Main Character, Midnight Mystic, Rage Architect, Throwback Romantic, Dancefloor Diplomat, Soft-Focus Poet, Global Nomad. Classifier in [`lib/personality.ts`](lib/personality.ts).
- **Genre DNA pie chart** — every artist's micro-genres are rolled up into 11 macro buckets and weighted by ranking. SVG donut + per-genre bar breakdown.
- **Mood spectrum** — six axes (energy, valence, intensity, eclecticism, obscurity, nostalgia) derived from genre priors, popularity, and release-year stats.
- **Music alter ego** — a deterministic persona name generated from your archetype + dominant genre.
- **Shareable persona card** — a 400×700 gradient card that exports as a 2× PNG via [`html-to-image`](https://github.com/bubkoo/html-to-image), with a `navigator.share` fallback so mobile users get the system share sheet.
- **Time-range selector** — 4 weeks / 6 months / all time.

## Why genre-derived mood instead of `audio-features`?

Spotify deprecated the `audio-features` and `audio-analysis` endpoints for apps that weren't approved before Nov 2024 — new apps can't read tempo/danceability/valence directly anymore. So mood is derived from per-genre priors weighted by your genre DNA, plus popularity (obscurity axis) and release-date (nostalgia axis). It works for any Spotify user without extension review.

## Quick start

### 1. Get a free Last.fm API key (60 seconds)

1. Go to <https://www.last.fm/api/account/create>.
2. Fill in any application name + description. Callback URL can be blank.
3. Copy the **API key** you're shown.

### 2. (Optional) Create a Spotify app

Only needed if you want the OAuth path too. Skip if Last.fm is enough.

1. Go to <https://developer.spotify.com/dashboard> → create an app.
2. Under **Redirect URIs** add: `http://127.0.0.1:3000/api/spotify/callback` (Spotify requires `127.0.0.1`, not `localhost`).
3. Under **Settings → User Management**, add each tester's Spotify email exactly as they have it on file.
4. Copy the **Client ID**.

### 3. Configure env

```bash
cp .env.example .env.local
```

Paste your Last.fm API key into `NEXT_PUBLIC_LASTFM_API_KEY` and (optionally) your Spotify Client ID into `NEXT_PUBLIC_SPOTIFY_CLIENT_ID`.

### 4. Install + run

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:3000>. Type a Last.fm username (yours or any public one) and hit **Analyze** — you'll land on `/lastfm/<username>` with the full analysis.

## Tech stack

- **Next.js 16** (App Router) + **React 19**
- **TypeScript** end-to-end
- **Tailwind CSS 4** + **shadcn/ui** primitives
- **Spotify Web API** via Authorization Code + PKCE (no client secret, no backend session)
- **html-to-image** for the share card export

## Project structure

```
app/
  page.tsx                 # Landing page + archetype gallery
  wrapped/page.tsx         # Main analyzer dashboard
  auth/spotify/
    start/page.tsx         # Generates PKCE verifier, redirects to Spotify
    complete/page.tsx      # Exchanges code → token (client-side)
  api/spotify/callback/    # GET: redirect target. POST: PKCE token exchange.
components/
  genre-dna.tsx            # SVG donut + bar list
  mood-spectrum.tsx        # 6-axis horizontal bars
  persona-card.tsx         # Exportable share card
lib/
  spotify.ts               # PKCE helpers + typed API fetch
  personality.ts           # Classifier, genre DNA, mood derivation, archetypes
```

## How the classifier works

1. **Genre DNA** ([`buildGenreDNA`](lib/personality.ts)). Each of the user's top 30 artists contributes a `1 / log2(rank + 2)` weight, split across their listed Spotify genres, then mapped onto 11 macro genres. Result: sorted slices summing to 1.0.
2. **Mood spectrum** ([`buildMoodSpectrum`](lib/personality.ts)). Each macro genre has a prior `{ energy, valence, intensity }` profile (e.g. Metal/Punk = high intensity, low valence). We weighted-average those by the DNA. The remaining three axes are computed directly: **eclecticism** = Shannon entropy of the DNA distribution, **obscurity** = `1 - avg(popularity)`, **nostalgia** = how far the average release year is from today (capped at 30 years).
3. **Archetype** ([`classifyArchetype`](lib/personality.ts)). Each of the 8 archetypes has a small scoring function over `(dna, mood)` and we pick the highest scorer with a tiny baseline so it's always deterministic.

## Sharing flow

The card uses `html-to-image.toPng` at `pixelRatio: 2` to render a crisp 800×1400 image. We then try `navigator.share({ files })` first — that opens the iOS/Android share sheet for one-tap to Stories. If `canShare` returns false (most desktops), we fall back to a direct download.

## What I'd improve with more time

- **Server-rendered OG image** for `/wrapped/[user]` so links unfurl with the persona card on Twitter/iMessage.
- **More archetypes + finer mood weighting** — current classifier is rule-based; with more data I'd swap to a learned k-NN over a labeled set of profiles.
- **Refresh-token rotation** so the session survives the 1-hour Spotify token window without re-auth.
- **A small "why this archetype?" explainer** under the result, surfacing the top signals that pushed the score.
- **Real audio-feature endpoint** for apps that have extension approval — it'd refine the mood axes meaningfully.

## Notes

- No data is persisted server-side. Access tokens live in `sessionStorage` and are cleared on disconnect.
- The Spotify redirect URI hostname in the dashboard must exactly match what the app posts; if you change the port or run behind a tunnel, update both `.env.local` and the Spotify dashboard.
