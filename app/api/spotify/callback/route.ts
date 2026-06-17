import { NextRequest, NextResponse } from "next/server"
import { SPOTIFY_TOKEN_URL } from "@/lib/spotify"

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const error = url.searchParams.get("error")
  const origin = url.origin

  if (error) {
    return NextResponse.redirect(`${origin}/?spotify_error=${encodeURIComponent(error)}`)
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/?spotify_error=missing_code`)
  }

  // Bounce to a client page that completes PKCE token exchange
  // (verifier lives in sessionStorage, which the server cannot read).
  return NextResponse.redirect(
    `${origin}/auth/spotify/complete?code=${encodeURIComponent(code)}`,
  )
}

// Token exchange happens server-side via POST so the verifier is sent over
// HTTPS body rather than logged in browser navigation history.
export async function POST(req: NextRequest) {
  const { code, code_verifier, redirect_uri } = await req.json()
  if (!code || !code_verifier || !redirect_uri) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 })
  }
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: "missing_client_id" }, { status: 500 })
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri,
    client_id: clientId,
    code_verifier,
  })

  const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  const data = await tokenRes.json()
  if (!tokenRes.ok) {
    return NextResponse.json(
      { error: data.error_description || data.error || "token_exchange_failed" },
      { status: 400 },
    )
  }
  return NextResponse.json(data)
}
