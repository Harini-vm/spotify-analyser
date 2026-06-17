"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ARCHETYPES } from "@/lib/personality"
import { Sparkles, Disc3, Activity, Share2 } from "lucide-react"

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  )
}

function HomeInner() {
  const router = useRouter()
  const params = useSearchParams()
  const oauthError = params.get("spotify_error")
  const [lfmUsername, setLfmUsername] = useState("")

  function handleLastfmSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = lfmUsername.trim()
    if (!name) return
    router.push(`/lastfm/${encodeURIComponent(name)}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 sticky top-0 bg-background/80 backdrop-blur z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            Music Personality
          </Link>
          <Button asChild>
            <Link href="/auth/spotify/start">Connect Spotify</Link>
          </Button>
        </div>
      </header>

      <section className="container mx-auto px-6 py-16">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium uppercase tracking-wider">
            <Disc3 className="w-3.5 h-3.5" /> Spotify Wrapped, reimagined
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight">
            What does your <span className="text-primary">listening</span> say about you?
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Deep personality analysis from your real listening habits — music type, genre breakdown, mood profile, and a shareable card.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-6 pb-16">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
          {/* Last.fm card — primary path */}
          <div className="rounded-2xl border-2 border-primary bg-card p-6 space-y-5 relative">
            <span className="absolute -top-3 left-6 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold uppercase tracking-wider">
              Recommended · works for everyone
            </span>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold">Use Last.fm</h2>
              <p className="text-sm text-muted-foreground">
                Free, no login, works in 30 seconds.
              </p>
            </div>

            <ol className="space-y-3 text-sm">
              <Step n={1}>
                Have a Last.fm account?{" "}
                <a
                  href="https://www.last.fm/join"
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-primary"
                >
                  If not, sign up here
                </a>{" "}
                (free, takes 20s).
              </Step>
              <Step n={2}>
                Connect Spotify to Last.fm so it records what you play.{" "}
                <a
                  href="https://www.last.fm/settings/applications"
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-primary"
                >
                  Open Last.fm settings → Connect Spotify
                </a>
                . Play 5–10 songs after connecting.
              </Step>
              <Step n={3}>Type your username below and hit Analyze.</Step>
            </ol>

            <form onSubmit={handleLastfmSubmit} className="flex flex-col sm:flex-row gap-2 pt-1">
              <Input
                value={lfmUsername}
                onChange={(e) => setLfmUsername(e.target.value)}
                placeholder="Your Last.fm username"
                className="h-12 text-base"
                autoComplete="off"
              />
              <Button type="submit" size="lg" className="h-12 px-6">
                Analyze
              </Button>
            </form>

            <p className="text-xs text-muted-foreground">
              Profile must be public (it is by default). Already a Last.fm scrobbler? Skip steps 1–2.
            </p>
          </div>

          {/* Spotify card — secondary path */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold">Connect Spotify directly</h2>
              <p className="text-sm text-muted-foreground">
                Better data, but requires the developer to allowlist you first.
              </p>
            </div>

            <ol className="space-y-3 text-sm">
              <Step n={1}>
                Email the developer your Spotify-registered email and full name (case-sensitive).
              </Step>
              <Step n={2}>
                Wait until they reply confirming you've been added to the app's User Management list.
              </Step>
              <Step n={3}>Click below, authorize Spotify, and you're in.</Step>
            </ol>

            <Button size="lg" variant="outline" className="w-full h-12" asChild>
              <Link href="/auth/spotify/start">Connect Spotify</Link>
            </Button>

            <div className="rounded-lg bg-secondary/60 border border-border p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Why the allowlist?</p>
              <p>
                Spotify keeps new apps in "Development Mode" (max 25 testers) until they manually
                approve the app for public use. This app's approval is{" "}
                <span className="italic">pending</span>. Until then, only allowlisted users can log in.
              </p>
            </div>

            {oauthError && (
              <p className="text-xs text-destructive">
                Spotify said: {decodeURIComponent(oauthError)}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-6 py-16 border-t border-border/40">
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { icon: Disc3, title: "Genre DNA", body: "Every artist you stream gets rolled into a macro-genre breakdown, weighted by ranking." },
            { icon: Activity, title: "Mood Spectrum", body: "Six axes — energy, valence, intensity, eclecticism, obscurity, nostalgia — derived from your taste." },
            { icon: Share2, title: "Persona Card", body: "One-tap PNG export designed to drop straight into Stories — your music alter ego, summed up." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border p-6 space-y-3 bg-card">
              <f.icon className="w-6 h-6 text-primary" />
              <h3 className="font-semibold text-lg">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="archetypes" className="container mx-auto px-6 py-20 border-t border-border/40">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-4xl font-bold">Eight ways to be a listener</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Our classifier picks the closest fit from these archetypes based on your genre DNA and mood spectrum.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ARCHETYPES.map((a) => (
              <div
                key={a.id}
                className="rounded-2xl p-5 text-white space-y-2 min-h-[180px] flex flex-col justify-between"
                style={{ background: `linear-gradient(160deg, ${a.gradient[0]}, ${a.gradient[1]})` }}
              >
                <span className="text-3xl">{a.emoji}</span>
                <div>
                  <h3 className="font-bold text-lg leading-tight">{a.name}</h3>
                  <p className="text-xs italic opacity-90 mt-1">"{a.tagline}"</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border/40 py-8 mt-10">
        <div className="container mx-auto px-6 flex flex-col sm:flex-row gap-2 justify-between text-xs text-muted-foreground">
          <span>Music Personality · Built for the 8x Engineer challenge</span>
          <div className="flex gap-4">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
        {n}
      </span>
      <span className="flex-1 leading-relaxed">{children}</span>
    </li>
  )
}
