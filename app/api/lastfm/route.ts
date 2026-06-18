import { NextRequest, NextResponse } from "next/server"

// Server-side proxy for Last.fm. Hides the API key from the browser
// (Network tab, JS bundle) by attaching it here instead of in client code.

const LASTFM_API = "https://ws.audioscrobbler.com/2.0/"

// Whitelist of methods the proxy is willing to forward. Prevents anyone
// from abusing this endpoint as a free Last.fm proxy for arbitrary calls.
const ALLOWED_METHODS = new Set([
  "user.getInfo",
  "user.getTopArtists",
  "user.getTopTracks",
  "user.getRecentTracks",
  "artist.getInfo",
])

export async function GET(req: NextRequest) {
  const apiKey =
    process.env.LASTFM_API_KEY || process.env.NEXT_PUBLIC_LASTFM_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server missing LASTFM_API_KEY env var" },
      { status: 500 },
    )
  }

  const incoming = req.nextUrl.searchParams
  const method = incoming.get("method")
  if (!method || !ALLOWED_METHODS.has(method)) {
    return NextResponse.json(
      { error: `Method "${method}" not allowed` },
      { status: 400 },
    )
  }

  // Rebuild the upstream URL — drop any client-supplied api_key/format,
  // attach our own server-side key.
  const upstream = new URL(LASTFM_API)
  incoming.forEach((value, key) => {
    if (key === "api_key" || key === "format") return
    upstream.searchParams.append(key, value)
  })
  upstream.searchParams.append("api_key", apiKey)
  upstream.searchParams.append("format", "json")

  const res = await fetch(upstream.toString(), { cache: "no-store" })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
