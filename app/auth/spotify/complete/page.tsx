"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getRedirectUri } from "@/lib/spotify"

export default function SpotifyCompletePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Loading…</p></div>}>
      <CompleteInner />
    </Suspense>
  )
}

function CompleteInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = params.get("code")
    const verifier = sessionStorage.getItem("spotify_pkce_verifier")
    if (!code || !verifier) {
      setError("Missing authorization code or PKCE verifier. Please try logging in again.")
      return
    }
    ;(async () => {
      try {
        const res = await fetch("/api/spotify/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            code_verifier: verifier,
            redirect_uri: getRedirectUri(),
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Token exchange failed")

        const expiresAt = Date.now() + data.expires_in * 1000
        sessionStorage.setItem("spotify_access_token", data.access_token)
        sessionStorage.setItem("spotify_expires_at", String(expiresAt))
        if (data.refresh_token) {
          sessionStorage.setItem("spotify_refresh_token", data.refresh_token)
        }
        sessionStorage.removeItem("spotify_pkce_verifier")
        router.replace("/wrapped")
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error")
      }
    })()
  }, [params, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-4">
        {error ? (
          <>
            <h1 className="text-2xl font-bold">Spotify login didn't work</h1>
            <p className="text-muted-foreground text-sm">{error}</p>
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-left space-y-2">
              <p className="font-semibold">Most likely cause</p>
              <p className="text-muted-foreground">
                Your Spotify account isn't on this app's tester allowlist.
                Spotify keeps new apps in "Development Mode" — only the developer can let people in
                until the app is approved for public use.
              </p>
              <p className="font-semibold pt-2">What to do</p>
              <p className="text-muted-foreground">
                Email the developer your Spotify-registered email + display name (exactly as it appears in
                your Spotify profile), or use the Last.fm option on the home page — it works for anyone.
              </p>
            </div>
            <a href="/" className="text-primary underline inline-block">
              ← Back to home (try Last.fm instead)
            </a>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Connecting to Spotify…</h1>
            <p className="text-muted-foreground">Decoding your taste DNA.</p>
          </>
        )}
      </div>
    </div>
  )
}
