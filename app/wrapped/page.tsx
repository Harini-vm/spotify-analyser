"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import * as htmlToImage from "html-to-image"
import { Button } from "@/components/ui/button"
import { GenreDNA } from "@/components/genre-dna"
import { MoodSpectrumChart } from "@/components/mood-spectrum"
import { ArchetypeBlend } from "@/components/archetype-blend"
import { SignatureTags } from "@/components/signature-tags"
import { PersonaCard } from "@/components/persona-card"
import {
  gatherTaste,
  spotifyFetch,
  type SpotifyUser,
  type TasteSource,
} from "@/lib/spotify"
import {
  buildGenreDNA,
  buildMoodSpectrum,
  buildSignatureTags,
  classifyArchetype,
  generateAlterEgo,
  type PersonaInsight,
} from "@/lib/personality"
import { Download, LogOut, RefreshCw } from "lucide-react"

interface SourceOption {
  id: TasteSource
  label: string
  blurb: string
}
const SOURCES: SourceOption[] = [
  { id: "recent", label: "Recently played", blurb: "Last 50 plays" },
  { id: "playlists", label: "My playlists", blurb: "Your curated taste" },
  { id: "liked", label: "Liked songs", blurb: "Saved library" },
]

export default function WrappedPage() {
  const router = useRouter()
  const cardRef = useRef<HTMLDivElement>(null)
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<SpotifyUser | null>(null)
  const [insight, setInsight] = useState<PersonaInsight | null>(null)
  const [activeSources, setActiveSources] = useState<TasteSource[]>([
    "recent",
    "playlists",
    "liked",
  ])
  const [sampleCounts, setSampleCounts] = useState<Record<TasteSource, number> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  // Pull token from session storage on mount
  useEffect(() => {
    const t = sessionStorage.getItem("spotify_access_token")
    const exp = parseInt(sessionStorage.getItem("spotify_expires_at") || "0", 10)
    if (!t || !exp || Date.now() > exp) {
      router.replace("/")
      return
    }
    setToken(t)
  }, [router])

  // Fetch + analyze whenever token or active sources change
  useEffect(() => {
    if (!token) return
    if (activeSources.length === 0) {
      setError("Pick at least one taste source.")
      setInsight(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const me = await spotifyFetch<SpotifyUser>(token, "/me")
        setUser(me)
        const { artists, tracks, counts } = await gatherTaste(
          token,
          me.id,
          activeSources,
        )
        setSampleCounts(counts)
        if (artists.length === 0) {
          setError(
            "Spotify returned no usable listening data from the selected sources. Try enabling more sources or playing a few tracks first.",
          )
          setInsight(null)
          return
        }
        const dna = buildGenreDNA(artists)
        const mood = buildMoodSpectrum(artists, tracks, dna)
        const { winner: archetype, blend } = classifyArchetype(dna, mood)
        const signatureTags = buildSignatureTags(artists)
        const alterEgo = generateAlterEgo(archetype, dna)
        setInsight({
          archetype,
          blend,
          dna,
          mood,
          signatureTags,
          alterEgo,
          topArtists: artists,
          topTracks: tracks,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error"
        if (msg.includes("401")) {
          sessionStorage.clear()
          router.replace("/?spotify_error=session_expired")
        } else {
          setError(msg)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [token, activeSources, router])

  function toggleSource(id: TasteSource) {
    setActiveSources((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  async function handleDownload() {
    if (!cardRef.current || !insight) return
    setDownloading(true)
    try {
      const dataUrl = await htmlToImage.toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "transparent",
      })
      const link = document.createElement("a")
      link.download = `music-personality-${insight.archetype.id}.png`
      link.href = dataUrl
      link.click()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to export card")
    } finally {
      setDownloading(false)
    }
  }

  async function handleShare() {
    if (!cardRef.current || !insight) return
    try {
      const dataUrl = await htmlToImage.toPng(cardRef.current, { pixelRatio: 2 })
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], "music-personality.png", { type: "image/png" })
      const navAny = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean
      }
      if (navAny.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `I'm ${insight.archetype.name}`,
          text: insight.archetype.tagline,
        })
      } else {
        handleDownload()
      }
    } catch {
      // user cancelled or share unsupported
    }
  }

  function handleLogout() {
    sessionStorage.clear()
    router.replace("/")
  }

  if (loading && !insight) {
    return <LoadingState />
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Music personality for</p>
            <p className="text-lg font-semibold">{user?.display_name ?? "you"}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Disconnect
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 space-y-10 max-w-6xl">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Taste sources — pick any combination. Results re-analyze instantly.
          </p>
          <div className="flex flex-wrap gap-2">
            {SOURCES.map((s) => {
              const on = activeSources.includes(s.id)
              const got = sampleCounts?.[s.id]
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSource(s.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                    on
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary border-border hover:bg-secondary/80"
                  }`}
                >
                  {s.label}
                  <span className="ml-2 opacity-70">
                    {got != null && on ? `${got} items` : s.blurb}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            {error}
          </div>
        )}

        {insight && (
          <div className="grid lg:grid-cols-[1fr_400px] gap-10 items-start">
            <div className="space-y-10">
              <section className="space-y-4">
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                  Your music type
                </p>
                <div className="flex items-start gap-4">
                  <span className="text-6xl">{insight.archetype.emoji}</span>
                  <div>
                    <h1 className="text-4xl font-bold">{insight.archetype.name}</h1>
                    <p className="text-lg italic text-muted-foreground mt-1">
                      "{insight.archetype.tagline}"
                    </p>
                    <p className="mt-3 max-w-prose">{insight.archetype.description}</p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-2xl font-semibold">You're a mix</h2>
                <p className="text-muted-foreground text-sm max-w-prose">
                  No one fits a single type. Here's your top three — the percentages show how strongly each one shows up in your listening.
                </p>
                <ArchetypeBlend blend={insight.blend} />
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Your main genres</h2>
                <p className="text-muted-foreground text-sm max-w-prose">
                  The big genre families your top {insight.topArtists.length} artists fall into. Bigger slice = more of your listening lives there.
                </p>
                <GenreDNA dna={insight.dna} />
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Your specific vibes</h2>
                <p className="text-muted-foreground text-sm max-w-prose">
                  The exact style tags from your top artists — way more specific than the big genres above. Bigger text = shows up more often.
                </p>
                <SignatureTags tags={insight.signatureTags} />
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Your mood profile</h2>
                <p className="text-muted-foreground text-sm max-w-prose">
                  Six sliders that describe the feel of your music. Each one has an explanation underneath.
                </p>
                <MoodSpectrumChart mood={insight.mood} />
              </section>

              <section className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Top artists</h3>
                  <ol className="space-y-2 text-sm">
                    {insight.topArtists.slice(0, 8).map((a, i) => (
                      <li key={a.id} className="flex gap-3">
                        <span className="font-mono text-muted-foreground w-6">{i + 1}.</span>
                        <span className="truncate">{a.name}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Top tracks</h3>
                  <ol className="space-y-2 text-sm">
                    {insight.topTracks.slice(0, 8).map((t, i) => (
                      <li key={t.id} className="flex gap-3">
                        <span className="font-mono text-muted-foreground w-6">{i + 1}.</span>
                        <span className="truncate">
                          {t.name} <span className="text-muted-foreground">— {t.artists[0]?.name}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>
            </div>

            <aside className="lg:sticky lg:top-6 space-y-4 mx-auto">
              <PersonaCard
                ref={cardRef}
                insight={insight}
                displayName={user?.display_name || "Anonymous Listener"}
              />
              <div className="flex gap-2">
                <Button onClick={handleDownload} disabled={downloading} className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  {downloading ? "Rendering…" : "Download"}
                </Button>
                <Button onClick={handleShare} variant="secondary" className="flex-1">
                  Share
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setActiveSources([...activeSources])} title="Re-analyze">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                One tap → PNG saved to your device. Share-sheet falls back to download on desktop.
              </p>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="space-y-3 text-center">
        <div className="w-16 h-16 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-muted-foreground">Decoding your taste DNA…</p>
      </div>
    </div>
  )
}
