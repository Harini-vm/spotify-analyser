"use client"

import type { ArchetypeScore } from "@/lib/personality"

export function ArchetypeBlend({ blend }: { blend: ArchetypeScore[] }) {
  const total = blend.reduce((s, b) => s + b.score, 0) || 1
  return (
    <div className="space-y-3">
      <div className="flex h-3 rounded-full overflow-hidden bg-secondary">
        {blend.map((b) => (
          <div
            key={b.archetype.id}
            style={{
              width: `${(b.score / total) * 100}%`,
              background: `linear-gradient(90deg, ${b.archetype.gradient[0]}, ${b.archetype.gradient[1]})`,
            }}
            title={`${b.archetype.name} · ${Math.round((b.score / total) * 100)}%`}
          />
        ))}
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {blend.map((b, i) => (
          <div
            key={b.archetype.id}
            className="rounded-xl border border-border p-3 space-y-1"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{i === 0 ? "Mostly" : i === 1 ? "Also" : "A bit of"}</span>
              <span className="font-mono">
                {Math.round((b.score / total) * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{b.archetype.emoji}</span>
              <span className="font-semibold leading-tight">
                {b.archetype.name}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
