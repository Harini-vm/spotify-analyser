"use client"

import type { MonthlySnapshot } from "@/lib/lastfm"
import type { GenreSlice, MoodSpectrum } from "@/lib/personality"
import { Music, Mic2, Heart, Headphones, Sparkles, Activity } from "lucide-react"

interface Props {
  snapshot: MonthlySnapshot
  mood: MoodSpectrum
  dna: GenreSlice[]
}

export function StoryCards({ snapshot, mood, dna }: Props) {
  const dominantGenre = dna[0]
  const moodLine = describeMood(mood)
  const lastPlayedTime = snapshot.lastPlayed?.playedAt
    ? formatTimeAgo(snapshot.lastPlayed.playedAt)
    : null

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {snapshot.topTrack && (
        <Card
          icon={<Music className="w-4 h-4" />}
          label="Song on repeat this month"
          accent="from-rose-500/20 to-orange-500/20"
        >
          <p className="text-lg font-bold leading-tight truncate">
            {snapshot.topTrack.name}
          </p>
          <p className="text-sm text-muted-foreground truncate">
            {snapshot.topTrack.artist}
          </p>
          <p className="text-xs mt-2">
            <span className="font-mono font-semibold text-foreground">
              {snapshot.topTrack.playcount}
            </span>{" "}
            plays this month
          </p>
        </Card>
      )}

      {snapshot.topArtist && (
        <Card
          icon={<Mic2 className="w-4 h-4" />}
          label="Artist of the month"
          accent="from-violet-500/20 to-fuchsia-500/20"
        >
          <p className="text-lg font-bold leading-tight truncate">
            {snapshot.topArtist.name}
          </p>
          <p className="text-xs mt-3">
            <span className="font-mono font-semibold text-foreground">
              {snapshot.topArtist.playcount}
            </span>{" "}
            plays · roughly{" "}
            <span className="font-semibold text-foreground">
              {percentOfTotal(snapshot.topArtist.playcount, snapshot.totalMonthlyPlays)}%
            </span>{" "}
            of your listening
          </p>
        </Card>
      )}

      <Card
        icon={<Activity className="w-4 h-4" />}
        label="The mood you've been in"
        accent="from-emerald-500/20 to-cyan-500/20"
      >
        <p className="text-base font-semibold leading-snug">{moodLine}</p>
        <p className="text-xs text-muted-foreground mt-2">
          Based on the feel of what you've been playing.
        </p>
      </Card>

      {dominantGenre && (
        <Card
          icon={<Sparkles className="w-4 h-4" />}
          label="You can't stop listening to"
          accent="from-amber-500/20 to-yellow-500/20"
        >
          <p className="text-lg font-bold leading-tight">{dominantGenre.macro}</p>
          <p className="text-xs mt-2">
            <span className="font-mono font-semibold text-foreground">
              {Math.round(dominantGenre.weight * 100)}%
            </span>{" "}
            of your top artists are this genre
          </p>
          {dominantGenre.examples.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1 truncate capitalize">
              like {dominantGenre.examples.slice(0, 2).join(", ")}
            </p>
          )}
        </Card>
      )}

      {snapshot.totalMonthlyPlays > 0 && (
        <Card
          icon={<Headphones className="w-4 h-4" />}
          label="This month's listening"
          accent="from-blue-500/20 to-indigo-500/20"
        >
          <p className="text-3xl font-black tabular-nums">
            {snapshot.totalMonthlyPlays.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            songs played across{" "}
            <span className="font-semibold text-foreground">
              {snapshot.uniqueArtistsThisMonth || "many"}
            </span>{" "}
            artists
          </p>
        </Card>
      )}

      {snapshot.lastPlayed && (
        <Card
          icon={<Heart className="w-4 h-4" />}
          label={snapshot.lastPlayed.nowPlaying ? "Playing right now" : "Just played"}
          accent="from-pink-500/20 to-red-500/20"
        >
          <p className="text-base font-bold leading-tight truncate">
            {snapshot.lastPlayed.name}
          </p>
          <p className="text-sm text-muted-foreground truncate">
            {snapshot.lastPlayed.artist}
          </p>
          {(lastPlayedTime || snapshot.lastPlayed.nowPlaying) && (
            <p className="text-xs text-muted-foreground mt-2">
              {snapshot.lastPlayed.nowPlaying ? "▶ Live" : lastPlayedTime}
            </p>
          )}
        </Card>
      )}
    </div>
  )
}

function Card({
  icon,
  label,
  accent,
  children,
}: {
  icon: React.ReactNode
  label: string
  accent: string
  children: React.ReactNode
}) {
  return (
    <div className="relative rounded-2xl border border-border bg-card p-4 overflow-hidden">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-60 pointer-events-none`}
      />
      <div className="relative space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          {icon}
          {label}
        </div>
        {children}
      </div>
    </div>
  )
}

function describeMood(mood: MoodSpectrum): string {
  const hi = (n: number) => n > 0.6
  const lo = (n: number) => n < 0.4

  let core: string
  if (hi(mood.valence) && hi(mood.energy)) core = "Hyped and happy"
  else if (lo(mood.valence) && hi(mood.energy)) core = "Restless and intense"
  else if (hi(mood.valence) && lo(mood.energy)) core = "Warm and laid-back"
  else if (lo(mood.valence) && lo(mood.energy)) core = "Melancholy and reflective"
  else if (hi(mood.energy)) core = "High-energy"
  else if (lo(mood.energy)) core = "Mellow"
  else core = "Balanced"

  const extras: string[] = []
  if (hi(mood.intensity)) extras.push("with serious bite")
  if (hi(mood.obscurity)) extras.push("digging deep cuts")
  if (hi(mood.nostalgia)) extras.push("with throwback energy")

  return extras.length ? `${core}, ${extras.slice(0, 2).join(", ")}` : core
}

function percentOfTotal(part: number, total: number): number {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}
