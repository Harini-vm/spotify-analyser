"use client"

import { useEffect } from "react"
import {
  SPOTIFY_AUTH_URL,
  SPOTIFY_SCOPES,
  getClientId,
  getRedirectUri,
  pkceChallenge,
  randomString,
} from "@/lib/spotify"

export default function SpotifyStartPage() {
  useEffect(() => {
    ;(async () => {
      const clientId = getClientId()
      if (!clientId) {
        document.body.innerText =
          "Missing NEXT_PUBLIC_SPOTIFY_CLIENT_ID. Set it in .env.local and restart."
        return
      }
      const verifier = randomString(96)
      const challenge = await pkceChallenge(verifier)
      sessionStorage.setItem("spotify_pkce_verifier", verifier)
      const state = randomString(16)
      sessionStorage.setItem("spotify_oauth_state", state)
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: getRedirectUri(),
        code_challenge_method: "S256",
        code_challenge: challenge,
        state,
        scope: SPOTIFY_SCOPES,
      })
      window.location.href = `${SPOTIFY_AUTH_URL}?${params.toString()}`
    })()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Redirecting you to Spotify…</p>
    </div>
  )
}
