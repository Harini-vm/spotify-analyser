"use client"

import type { MoodSpectrum } from "@/lib/personality"

interface Axis {
  key: keyof MoodSpectrum
  label: string
  low: string
  high: string
  help: string
}

const AXES: Axis[] = [
  {
    key: "energy",
    label: "Energy",
    low: "Chill",
    high: "Pumped up",
    help: "How loud, fast, and lively your music tends to be.",
  },
  {
    key: "valence",
    label: "Mood",
    low: "Sad",
    high: "Happy",
    help: "Whether your songs feel bright and upbeat or moody and melancholic.",
  },
  {
    key: "intensity",
    label: "Heaviness",
    low: "Soft",
    high: "Heavy",
    help: "How aggressive your tracks hit — gentle acoustic vs. full-on heavy.",
  },
  {
    key: "eclecticism",
    label: "Variety",
    low: "One lane",
    high: "All over the place",
    help: "Whether you stick to one genre or jump between many different styles.",
  },
  {
    key: "obscurity",
    label: "How underground",
    low: "Mainstream",
    high: "Hidden gems",
    help: "Are your artists chart-toppers everyone knows, or niche names most people haven't heard?",
  },
  {
    key: "nostalgia",
    label: "How old-school",
    low: "Brand new",
    high: "Throwback",
    help: "Do you listen to recent releases or classics from past decades?",
  },
]

export function MoodSpectrumChart({ mood }: { mood: MoodSpectrum }) {
  return (
    <div className="space-y-5">
      {AXES.map((axis) => {
        const value = mood[axis.key]
        const pct = Math.round(value * 100)
        return (
          <div key={axis.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">{axis.label}</span>
              <span className="text-xs font-mono text-muted-foreground">
                {pct} / 100
              </span>
            </div>
            <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/40 to-primary"
                style={{ width: `${pct}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-foreground border-2 border-background"
                style={{ left: `calc(${pct}% - 6px)` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{axis.low}</span>
              <span>{axis.high}</span>
            </div>
            <p className="text-xs text-muted-foreground/80 italic">
              {axis.help}
            </p>
          </div>
        )
      })}
    </div>
  )
}
