// Last.fm provider — returns data shaped like our Spotify aggregator so the
// existing personality classifier in lib/personality.ts works unchanged.
//
// Last.fm only needs an API key (no secret) for read-only public methods,
// which is why this works for any user without an allowlist or OAuth.

import type { SpotifyArtist, SpotifyTrack } from "./spotify"

const LASTFM_API = "https://ws.audioscrobbler.com/2.0/"

function apiKey(): string {
  return process.env.NEXT_PUBLIC_LASTFM_API_KEY || ""
}

async function call<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(LASTFM_API)
  url.search = new URLSearchParams({
    ...params,
    api_key: apiKey(),
    format: "json",
  }).toString()
  const res = await fetch(url.toString(), { cache: "no-store" })
  const data = await res.json()
  if (!res.ok || data.error) {
    throw new Error(data.message || `Last.fm ${params.method} failed`)
  }
  return data as T
}

// --- Raw Last.fm response types (just what we use) ----------------------
interface LfmArtist {
  name: string
  mbid?: string
  playcount?: string
  url?: string
}
interface LfmTrack {
  name: string
  playcount?: string
  artist: { name: string; mbid?: string } | { "#text": string }
  album?: { "#text": string }
  url?: string
}
interface LfmTagInfo {
  artist?: {
    name: string
    listeners?: string
    stats?: { listeners?: string; playcount?: string }
    tags?: { tag: { name: string }[] }
  }
}

// --- Output shape matches lib/spotify.ts AggregatedTaste ----------------
export type LastfmPeriod = "7day" | "1month" | "6month" | "12month" | "overall"

export interface LastfmTaste {
  artists: SpotifyArtist[]
  tracks: SpotifyTrack[]
  totalPlays: number
}

export interface LastfmUserInfo {
  name: string
  realname?: string
  playcount: number
  image?: string
}

// --- Monthly snapshot (for the "story cards" section) ---------------------

export interface MonthlySnapshot {
  topTrack: { name: string; artist: string; playcount: number } | null
  topArtist: { name: string; playcount: number } | null
  lastPlayed: {
    name: string
    artist: string
    album: string
    image: string | null
    playedAt: Date | null
    nowPlaying: boolean
  } | null
  totalMonthlyPlays: number
  uniqueArtistsThisMonth: number
}

export async function getMonthlySnapshot(
  username: string,
): Promise<MonthlySnapshot> {
  const [topTracksRes, topArtistsRes, recentRes] = await Promise.all([
    call<{
      toptracks: {
        track: { name: string; playcount: string; artist: { name: string } }[]
        "@attr"?: { total: string }
      }
    }>({
      method: "user.getTopTracks",
      user: username,
      period: "1month",
      limit: "1",
    }),
    call<{
      topartists: {
        artist: { name: string; playcount: string }[]
        "@attr"?: { total: string }
      }
    }>({
      method: "user.getTopArtists",
      user: username,
      period: "1month",
      limit: "50",
    }),
    call<{
      recenttracks: {
        track: {
          name: string
          artist: { "#text": string }
          album: { "#text": string }
          image: { "#text": string; size: string }[]
          date?: { uts: string }
          "@attr"?: { nowplaying: string }
        }[]
      }
    }>({
      method: "user.getRecentTracks",
      user: username,
      limit: "1",
    }),
  ])

  const tt = topTracksRes.toptracks?.track?.[0]
  const ta = topArtistsRes.topartists?.artist?.[0]
  const recent = recentRes.recenttracks?.track?.[0]

  const totalMonthlyPlays = (topArtistsRes.topartists?.artist ?? []).reduce(
    (s, a) => s + (parseInt(a.playcount, 10) || 0),
    0,
  )
  const uniqueArtistsThisMonth = parseInt(
    topArtistsRes.topartists?.["@attr"]?.total || "0",
    10,
  )

  return {
    topTrack: tt
      ? {
          name: tt.name,
          artist: tt.artist.name,
          playcount: parseInt(tt.playcount, 10) || 0,
        }
      : null,
    topArtist: ta
      ? { name: ta.name, playcount: parseInt(ta.playcount, 10) || 0 }
      : null,
    lastPlayed: recent
      ? {
          name: recent.name,
          artist: recent.artist["#text"],
          album: recent.album?.["#text"] || "",
          image:
            recent.image?.find((i) => i.size === "large")?.["#text"] ||
            recent.image?.[recent.image.length - 1]?.["#text"] ||
            null,
          playedAt: recent.date ? new Date(parseInt(recent.date.uts, 10) * 1000) : null,
          nowPlaying: recent["@attr"]?.nowplaying === "true",
        }
      : null,
    totalMonthlyPlays,
    uniqueArtistsThisMonth,
  }
}

export async function getLastfmUser(username: string): Promise<LastfmUserInfo> {
  const data = await call<{
    user: {
      name: string
      realname?: string
      playcount: string
      image: { "#text": string; size: string }[]
    }
  }>({ method: "user.getInfo", user: username })
  const img =
    data.user.image?.find((i) => i.size === "large")?.["#text"] ||
    data.user.image?.[0]?.["#text"]
  return {
    name: data.user.name,
    realname: data.user.realname,
    playcount: parseInt(data.user.playcount, 10) || 0,
    image: img,
  }
}

// Aggregate listening data for a Last.fm username and normalize to the
// SpotifyArtist / SpotifyTrack shape the classifier consumes.
export async function gatherLastfmTaste(
  username: string,
  period: LastfmPeriod = "6month",
): Promise<LastfmTaste> {
  const [topArtistsRes, topTracksRes] = await Promise.all([
    call<{ topartists: { artist: (LfmArtist & { playcount: string })[] } }>({
      method: "user.getTopArtists",
      user: username,
      period,
      limit: "30",
    }),
    call<{ toptracks: { track: (LfmTrack & { playcount: string })[] } }>({
      method: "user.getTopTracks",
      user: username,
      period,
      limit: "30",
    }),
  ])

  const rawArtists = topArtistsRes.topartists?.artist ?? []
  const rawTracks = topTracksRes.toptracks?.track ?? []

  if (rawArtists.length === 0 && rawTracks.length === 0) {
    throw new Error(
      `No listening data found for "${username}". Make sure the profile is public and has scrobbles.`,
    )
  }

  // Enrich each artist with tags + listener count via artist.getInfo.
  // Last.fm allows a few req/sec; 30 sequential-ish calls are fine.
  const artists: SpotifyArtist[] = []
  for (const a of rawArtists) {
    try {
      const info = await call<LfmTagInfo>({
        method: "artist.getInfo",
        artist: a.name,
        autocorrect: "1",
      })
      const listeners = parseInt(
        info.artist?.stats?.listeners || info.artist?.listeners || "0",
        10,
      )
      const tags = info.artist?.tags?.tag?.slice(0, 5).map((t) => t.name) ?? []
      artists.push({
        id: a.mbid || a.name,
        name: a.name,
        genres: tags,
        popularity: listenersToPopularity(listeners),
      })
    } catch {
      // If artist.getInfo fails, still keep the artist with empty genres —
      // they'll fall into the "Other" bucket but won't break aggregation.
      artists.push({
        id: a.mbid || a.name,
        name: a.name,
        genres: [],
        popularity: 50,
      })
    }
  }

  const tracks: SpotifyTrack[] = rawTracks.map((t) => {
    const artistName =
      typeof t.artist === "object" && "name" in t.artist
        ? t.artist.name
        : (t.artist as { "#text": string })["#text"]
    return {
      id: t.url || `${t.name}-${artistName}`,
      name: t.name,
      // We don't get per-track listener count cheaply; approximate from playcount.
      popularity: clamp(Math.min(100, Math.log2(parseInt(t.playcount, 10) + 1) * 8)),
      duration_ms: 0,
      explicit: false,
      album: {
        name: t.album?.["#text"] || "",
        // Last.fm doesn't surface release dates on user.getTopTracks; we
        // leave it blank, which makes the nostalgia axis default to ~0.
        release_date: "",
        images: [],
      },
      artists: [{ id: artistName, name: artistName }],
    }
  })

  const totalPlays = rawArtists.reduce(
    (s, a) => s + (parseInt(a.playcount, 10) || 0),
    0,
  )

  return { artists, tracks, totalPlays }
}

// Last.fm reports total listeners per artist. Convert that to a 0–100
// popularity score on a log scale so giants (~10M listeners) sit near 100
// and obscure artists (~1k) sit near 10.
function listenersToPopularity(listeners: number): number {
  if (listeners <= 0) return 50
  const score = Math.log10(listeners) * 14 // 1k → 42, 100k → 70, 10M → 98
  return Math.max(0, Math.min(100, Math.round(score)))
}

function clamp(n: number) {
  if (isNaN(n)) return 0
  return Math.max(0, Math.min(100, n))
}
