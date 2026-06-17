"use client"

import { use, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import * as htmlToImage from "html-to-image"
import { Button } from "@/components/ui/button"
import { GenreDNA } from "@/components/genre-dna"
import { MoodSpectrumChart } from "@/components/mood-spectrum"
import { ArchetypeBlend } from "@/components/archetype-blend"
import { SignatureTags } from "@/components/signature-tags"
import { PersonaCard } from "@/components/persona-card"
import {
  gatherLastfmTaste,
  getLastfmUser,
  getMonthlySnapshot,
  type LastfmPeriod,
  type LastfmUserInfo,
  type MonthlySnapshot,
} from "@/lib/lastfm"
import { StoryCards } from "@/components/story-cards"
import {
  buildGenreDNA,
  buildMoodSpectrum,
  buildSignatureTags,
  classifyArchetype,
  generateAlterEgo,
  type PersonaInsight,
} from "@/lib/personality"
import { ArrowLeft, Download, RefreshCw } from "lucide-react"
import Link from "next/link"

const PERIODS: { id: LastfmPeriod; label: string; blurb: string }[] = [
  { id: "7day", label: "Last week", blurb: "Right now" },
  { id: "1month", label: "Last month", blurb: "This vibe" },
  { id: "6month", label: "6 months", blurb: "This era" },
  { id: "12month", label: "12 months", blurb: "This year" },
  { id: "overall", label: "All time", blurb: "Lifetime" },
]

export default function LastfmDashboardPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = use(params)
  return <Inner username={decodeURIComponent(username)} />
}

function Inner({ username }: { username: string }) {
  const router = useRouter()
  const cardRef = useRef<HTMLDivElement>(null)
  const [user, setUser] = useState<LastfmUserInfo | null>(null)
  const [insight, setInsight] = useState<PersonaInsight | null>(null)
  const [snapshot, setSnapshot] = useState<MonthlySnapshot | null>(null)
  const [period, setPeriod] = useState<LastfmPeriod>("6month")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const [me, taste, snap] = await Promise.all([
          getLastfmUser(username),
          gatherLastfmTaste(username, period),
          getMonthlySnapshot(username).catch(() => null),
        ])
        setUser(me)
        setSnapshot(snap)
        const dna = buildGenreDNA(taste.artists)
        const mood = buildMoodSpectrum(taste.artists, taste.tracks, dna)
        const { winner: archetype, blend } = classifyArchetype(dna, mood)
        const signatureTags = buildSignatureTags(taste.artists)
        const alterEgo = generateAlterEgo(archetype, dna)
        setInsight({
          archetype,
          blend,
          dna,
          mood,
          signatureTags,
          alterEgo,
          topArtists: taste.artists,
          topTracks: taste.tracks,
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error")
        setInsight(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [username, period])

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
      // user cancelled
    }
  }

  if (loading && !insight) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-3 text-center">
          <div className="w-16 h-16 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground">Decoding {username}'s taste DNA…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <p className="text-sm text-muted-foreground">Music personality for</p>
              <p className="text-lg font-semibold">
                {user?.realname || user?.name || username}
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  via Last.fm
                </span>
              </p>
            </div>
          </div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Try another username →
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 space-y-10 max-w-6xl">
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                period === p.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary border-border hover:bg-secondary/80"
              }`}
            >
              {p.label}
              <span className="ml-2 opacity-70">{p.blurb}</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm space-y-1">
            <p className="font-medium">Couldn't load that profile</p>
            <p className="text-muted-foreground">{error}</p>
            <Link href="/" className="text-primary underline">
              Try a different username
            </Link>
          </div>
        )}

        {insight && (
          <div className="grid lg:grid-cols-[1fr_400px] gap-10 items-start">
            <div className="space-y-10">
              {snapshot && (
                <section className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-2xl font-semibold">This month at a glance</h2>
                    <span className="text-xs text-muted-foreground">
                      Last 30 days
                    </span>
                  </div>
                  <StoryCards snapshot={snapshot} mood={insight.mood} dna={insight.dna} />
                </section>
              )}

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
                  Six sliders that describe the feel of your music. Each one has an explanation underneath so you can see what it means.
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
                          {t.name}{" "}
                          <span className="text-muted-foreground">
                            — {t.artists[0]?.name}
                          </span>
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
                displayName={user?.realname || user?.name || username}
              />
              <div className="flex gap-2">
                <Button onClick={handleDownload} disabled={downloading} className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  {downloading ? "Rendering…" : "Download"}
                </Button>
                <Button onClick={handleShare} variant="secondary" className="flex-1">
                  Share
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPeriod(period)}
                  title="Re-analyze"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                One tap → PNG saved to your device.
              </p>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}
