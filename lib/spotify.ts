// Spotify Web API helpers + PKCE OAuth utilities.

export const SPOTIFY_SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-read-recently-played",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
].join(" ")

export const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize"
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
export const SPOTIFY_API = "https://api.spotify.com/v1"

export function getClientId(): string {
  return process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || ""
}

export function getRedirectUri(): string {
  if (process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI) {
    return process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/spotify/callback`
  }
  return "http://127.0.0.1:3000/api/spotify/callback"
}

// PKCE helpers (browser-only)
function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let str = ""
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function randomString(length = 64): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const arr = new Uint8Array(length)
  crypto.getRandomValues(arr)
  return Array.from(arr, (n) => chars[n % chars.length]).join("")
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  )
  return base64UrlEncode(hash)
}

export interface SpotifyImage {
  url: string
  height?: number
  width?: number
}
export interface SpotifyArtist {
  id: string
  name: string
  genres: string[]
  popularity: number
  images?: SpotifyImage[]
}
export interface SpotifyTrack {
  id: string
  name: string
  popularity: number
  duration_ms: number
  explicit: boolean
  album: { name: string; release_date: string; images: SpotifyImage[] }
  artists: { id: string; name: string }[]
}
export interface SpotifyUser {
  id: string
  display_name: string | null
  email?: string
  images?: SpotifyImage[]
}

export async function spotifyFetch<T>(
  accessToken: string,
  path: string,
): Promise<T> {
  const res = await fetch(`${SPOTIFY_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(
      `Spotify API ${path} failed: ${res.status} ${await res.text()}`,
    )
  }
  return (await res.json()) as T
}

// --- Taste aggregation (Premium-free path) -------------------------------
// /me/top/* is gated by the app owner having Premium in Dev Mode, so we
// rebuild the same kind of signal from endpoints that aren't gated:
//   • /me/player/recently-played  (last 50 plays)
//   • /me/playlists → /playlists/{id}/tracks  (user's curated playlists)
//   • /me/tracks  (saved/"liked" library)
// We dedupe to unique artists, batch-fetch /artists?ids= (needed for genres),
// and rank by how often each artist shows up across sources.

interface PlaylistSummary {
  id: string
  name: string
  tracks: { total: number }
  owner: { id: string }
}

export type TasteSource = "recent" | "playlists" | "liked"

export interface AggregatedTaste {
  artists: SpotifyArtist[] // ranked, deduped, with genres
  tracks: SpotifyTrack[] // deduped, capped
  counts: Record<TasteSource, number>
}

const MAX_ARTISTS = 50

export async function gatherTaste(
  accessToken: string,
  meId: string,
  sources: TasteSource[],
): Promise<AggregatedTaste> {
  const trackById = new Map<string, SpotifyTrack>()
  const artistWeight = new Map<string, number>()
  const counts: Record<TasteSource, number> = { recent: 0, playlists: 0, liked: 0 }

  const ingestTrack = (track: SpotifyTrack | null | undefined, weight: number) => {
    if (!track || !track.id) return
    if (!trackById.has(track.id)) trackById.set(track.id, track)
    track.artists.forEach((a) => {
      if (!a.id) return
      artistWeight.set(a.id, (artistWeight.get(a.id) ?? 0) + weight)
    })
  }

  if (sources.includes("recent")) {
    try {
      const recent = await spotifyFetch<{
        items: { track: SpotifyTrack }[]
      }>(accessToken, "/me/player/recently-played?limit=50")
      recent.items.forEach((item) => ingestTrack(item.track, 1.2)) // recent plays weigh slightly more
      counts.recent = recent.items.length
    } catch {
      // silently skip — user may have no recent plays
    }
  }

  if (sources.includes("playlists")) {
    const playlists = await spotifyFetch<{ items: PlaylistSummary[] }>(
      accessToken,
      "/me/playlists?limit=50",
    )
    // Only the user's own playlists count as "curated taste" — followed
    // playlists could be anyone's selection.
    const owned = playlists.items.filter((p) => p.owner.id === meId).slice(0, 8)
    counts.playlists = owned.length
    for (const pl of owned) {
      try {
        const tracks = await spotifyFetch<{
          items: { track: SpotifyTrack | null }[]
        }>(
          accessToken,
          `/playlists/${pl.id}/tracks?limit=50&fields=items(track(id,name,popularity,duration_ms,explicit,album(name,release_date,images),artists(id,name)))`,
        )
        tracks.items.forEach((item) => ingestTrack(item.track, 1.0))
      } catch {
        // skip private/unavailable playlists
      }
    }
  }

  if (sources.includes("liked")) {
    try {
      const liked = await spotifyFetch<{ items: { track: SpotifyTrack }[] }>(
        accessToken,
        "/me/tracks?limit=50",
      )
      liked.items.forEach((item) => ingestTrack(item.track, 1.1))
      counts.liked = liked.items.length
    } catch {
      // skip if library scope rejected
    }
  }

  // Rank artists by accumulated weight, take top N, fetch genre data in batches.
  const rankedIds = Array.from(artistWeight.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ARTISTS)
    .map(([id]) => id)

  const artists: SpotifyArtist[] = []
  for (let i = 0; i < rankedIds.length; i += 50) {
    const chunk = rankedIds.slice(i, i + 50)
    if (chunk.length === 0) continue
    const res = await spotifyFetch<{ artists: SpotifyArtist[] }>(
      accessToken,
      `/artists?ids=${chunk.join(",")}`,
    )
    artists.push(...res.artists.filter(Boolean))
  }

  // Cap track list so the dashboard stays snappy.
  const tracks = Array.from(trackById.values()).slice(0, 50)

  return { artists, tracks, counts }
}

