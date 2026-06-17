"use client"

import { forwardRef } from "react"
import type { PersonaInsight } from "@/lib/personality"

export const PersonaCard = forwardRef<HTMLDivElement, { insight: PersonaInsight; displayName: string }>(
  function PersonaCard({ insight, displayName }, ref) {
    const { archetype, alterEgo, dna, mood, topArtists, topTracks } = insight
    const [c1, c2] = archetype.gradient

    return (
      <div
        ref={ref}
        className="relative w-[400px] h-[700px] rounded-3xl overflow-hidden text-white p-8 flex flex-col gap-6 shadow-2xl"
        style={{ background: `linear-gradient(160deg, ${c1} 0%, ${c2} 100%)` }}
      >
        <div className="absolute inset-0 opacity-20 pointer-events-none"
             style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 0%, transparent 50%)" }} />
        <div className="relative flex items-center justify-between text-xs uppercase tracking-[0.2em]">
          <span>Music Personality</span>
          <span className="opacity-70">2026</span>
        </div>

        <div className="relative space-y-2">
          <div className="text-5xl">{archetype.emoji}</div>
          <h2 className="text-3xl font-black leading-tight">{archetype.name}</h2>
          <p className="text-sm italic opacity-90">"{archetype.tagline}"</p>
        </div>

        <div className="relative bg-white/15 backdrop-blur-sm rounded-2xl p-4 space-y-1">
          <p className="text-xs uppercase tracking-wider opacity-70">Your alter ego</p>
          <p className="text-2xl font-bold">{alterEgo.name}</p>
        </div>

        <div className="relative space-y-2">
          <p className="text-xs uppercase tracking-wider opacity-70">Genre DNA</p>
          <div className="flex flex-wrap gap-2">
            {dna.slice(0, 4).map((slice) => (
              <span
                key={slice.macro}
                className="text-xs font-medium px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm"
              >
                {slice.macro} · {(slice.weight * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        </div>

        <div className="relative grid grid-cols-2 gap-3 text-xs">
          <Stat label="Energy" value={mood.energy} />
          <Stat label="Happy mood" value={mood.valence} />
          <Stat label="Underground" value={mood.obscurity} />
          <Stat label="Variety" value={mood.eclecticism} />
        </div>

        <div className="relative space-y-2">
          <p className="text-xs uppercase tracking-wider opacity-70">Top of mind</p>
          <div className="space-y-1 text-sm">
            {topArtists.slice(0, 3).map((a, i) => (
              <div key={a.id} className="flex gap-2">
                <span className="font-mono opacity-60 w-5">{i + 1}.</span>
                <span className="truncate font-medium">{a.name}</span>
              </div>
            ))}
            {topTracks.slice(0, 2).map((t) => (
              <div key={t.id} className="flex gap-2 opacity-80">
                <span className="font-mono opacity-60 w-5">♪</span>
                <span className="truncate">
                  {t.name} — {t.artists[0]?.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-auto flex items-center justify-between text-xs opacity-80">
          <span className="font-semibold">{displayName}</span>
          <span>music-personality.app</span>
        </div>
      </div>
    )
  },
)

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white/10 rounded-xl px-3 py-2">
      <div className="opacity-70 uppercase tracking-wider text-[10px]">{label}</div>
      <div className="text-lg font-bold">{Math.round(value * 100)}</div>
    </div>
  )
}
