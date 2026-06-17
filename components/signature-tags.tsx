"use client"

export function SignatureTags({
  tags,
}: {
  tags: { tag: string; weight: number }[]
}) {
  if (tags.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No micro-tags surfaced — your sources didn't return genre data.
      </p>
    )
  }
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map(({ tag, weight }) => {
        // Map weight (0–1) to font size 12–28 and opacity 0.55–1
        const size = 12 + weight * 16
        const opacity = 0.55 + weight * 0.45
        return (
          <span
            key={tag}
            className="rounded-full bg-primary/10 text-primary px-3 py-1 font-medium capitalize"
            style={{ fontSize: `${size}px`, opacity }}
          >
            {tag}
          </span>
        )
      })}
    </div>
  )
}
