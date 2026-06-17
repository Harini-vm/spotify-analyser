"use client"

import type { GenreSlice } from "@/lib/personality"

const PALETTE = [
  "#1DB954", "#a855f7", "#ec4899", "#f97316", "#facc15",
  "#22d3ee", "#3b82f6", "#10b981", "#ef4444", "#f472b6",
  "#94a3b8",
]

export function GenreDNA({ dna }: { dna: GenreSlice[] }) {
  const size = 240
  const r = 100
  const cx = size / 2
  const cy = size / 2

  let cursor = -Math.PI / 2
  const arcs = dna.map((slice, i) => {
    const angle = slice.weight * Math.PI * 2
    const start = cursor
    const end = cursor + angle
    cursor = end
    const x1 = cx + r * Math.cos(start)
    const y1 = cy + r * Math.sin(start)
    const x2 = cx + r * Math.cos(end)
    const y2 = cy + r * Math.sin(end)
    const large = angle > Math.PI ? 1 : 0
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
    return { d, color: PALETTE[i % PALETTE.length], slice }
  })

  return (
    <div className="flex flex-col md:flex-row items-center gap-8">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-56 h-56 flex-shrink-0">
        {arcs.map((a, i) => (
          <path key={i} d={a.d} fill={a.color} stroke="#0a0a0a" strokeWidth={1} />
        ))}
        <circle cx={cx} cy={cy} r={r * 0.45} fill="#0a0a0a" />
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fontSize={14}
          fontWeight={600}
          fill="#fff"
        >
          DNA
        </text>
      </svg>
      <ul className="flex-1 space-y-2 w-full">
        {dna.map((slice, i) => (
          <li key={slice.macro} className="flex items-center gap-3 text-sm">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ background: PALETTE[i % PALETTE.length] }}
            />
            <span className="font-medium min-w-[140px]">{slice.macro}</span>
            <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className="h-full"
                style={{
                  width: `${slice.weight * 100}%`,
                  background: PALETTE[i % PALETTE.length],
                }}
              />
            </div>
            <span className="text-muted-foreground tabular-nums w-12 text-right">
              {(slice.weight * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
