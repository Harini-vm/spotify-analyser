// Pure classifier — takes Spotify top artists + tracks, derives:
//  - genre DNA (rolled-up macro genres with weights)
//  - mood spectrum (energy, valence, intensity, eclecticism, obscurity, nostalgia)
//  - one of 8 archetypes
//  - persona name/tagline

import type { SpotifyArtist, SpotifyTrack } from "./spotify"

export type MacroGenre =
  | "Pop"
  | "Hip-Hop"
  | "R&B / Soul"
  | "Rock"
  | "Metal / Punk"
  | "Indie / Alternative"
  | "Electronic"
  | "Jazz / Classical"
  | "Folk / Country"
  | "Latin / Global"
  | "Other"

const MACRO_RULES: { macro: MacroGenre; keywords: string[] }[] = [
  { macro: "Metal / Punk", keywords: ["metal", "punk", "hardcore", "grindcore", "thrash", "death core", "screamo"] },
  { macro: "Hip-Hop", keywords: ["hip hop", "hip-hop", "rap", "trap", "drill", "grime"] },
  { macro: "R&B / Soul", keywords: ["r&b", "rnb", "soul", "neo soul", "funk", "motown"] },
  { macro: "Electronic", keywords: ["edm", "house", "techno", "trance", "dubstep", "electro", "drum and bass", "dnb", "garage", "ambient", "idm", "synthwave", "future bass", "bass"] },
  { macro: "Indie / Alternative", keywords: ["indie", "alternative", "shoegaze", "dream pop", "bedroom", "lo-fi", "lofi", "emo", "math rock"] },
  { macro: "Rock", keywords: ["rock", "grunge", "britpop", "classic rock", "garage rock"] },
  { macro: "Jazz / Classical", keywords: ["jazz", "bebop", "classical", "baroque", "orchestra", "opera", "piano"] },
  { macro: "Folk / Country", keywords: ["folk", "country", "americana", "bluegrass", "singer-songwriter", "acoustic"] },
  { macro: "Latin / Global", keywords: ["latin", "reggaeton", "salsa", "k-pop", "j-pop", "afrobeats", "amapiano", "bossa", "bollywood", "desi", "arabic", "afro"] },
  { macro: "Pop", keywords: ["pop"] },
]

export function macroGenreFor(genre: string): MacroGenre {
  const g = genre.toLowerCase()
  for (const rule of MACRO_RULES) {
    if (rule.keywords.some((k) => g.includes(k))) return rule.macro
  }
  return "Other"
}

export interface GenreSlice {
  macro: MacroGenre
  weight: number
  examples: string[]
}

export function buildGenreDNA(artists: SpotifyArtist[]): GenreSlice[] {
  const buckets = new Map<MacroGenre, { weight: number; examples: Set<string> }>()
  artists.forEach((a, idx) => {
    // Higher-ranked artists weigh more (Spotify already orders by relevance)
    const rankWeight = 1 / Math.log2(idx + 2)
    if (a.genres.length === 0) {
      const slot = buckets.get("Other") ?? { weight: 0, examples: new Set() }
      slot.weight += rankWeight
      buckets.set("Other", slot)
      return
    }
    a.genres.forEach((g) => {
      const macro = macroGenreFor(g)
      const slot = buckets.get(macro) ?? { weight: 0, examples: new Set() }
      slot.weight += rankWeight / a.genres.length
      if (slot.examples.size < 3) slot.examples.add(g)
      buckets.set(macro, slot)
    })
  })
  const total = Array.from(buckets.values()).reduce((s, b) => s + b.weight, 0) || 1
  return Array.from(buckets.entries())
    .map(([macro, b]) => ({
      macro,
      weight: b.weight / total,
      examples: Array.from(b.examples),
    }))
    .sort((a, b) => b.weight - a.weight)
}

export interface MoodSpectrum {
  energy: number // 0–1: how loud/fast the catalogue trends
  valence: number // 0–1: bright vs melancholic
  intensity: number // 0–1: aggressive vs gentle
  eclecticism: number // 0–1: variety across macro-genres
  obscurity: number // 0–1: how niche the artists are (1 - avg popularity)
  nostalgia: number // 0–1: how far back the catalogue leans
}

// Per-macro-genre prior mood profile. Numbers are rough but defensible.
const MACRO_MOOD: Record<MacroGenre, Omit<MoodSpectrum, "eclecticism" | "obscurity" | "nostalgia">> = {
  Pop: { energy: 0.65, valence: 0.75, intensity: 0.45 },
  "Hip-Hop": { energy: 0.7, valence: 0.55, intensity: 0.65 },
  "R&B / Soul": { energy: 0.5, valence: 0.6, intensity: 0.4 },
  Rock: { energy: 0.75, valence: 0.55, intensity: 0.7 },
  "Metal / Punk": { energy: 0.95, valence: 0.35, intensity: 0.95 },
  "Indie / Alternative": { energy: 0.5, valence: 0.45, intensity: 0.45 },
  Electronic: { energy: 0.8, valence: 0.6, intensity: 0.6 },
  "Jazz / Classical": { energy: 0.35, valence: 0.55, intensity: 0.3 },
  "Folk / Country": { energy: 0.4, valence: 0.55, intensity: 0.35 },
  "Latin / Global": { energy: 0.75, valence: 0.75, intensity: 0.55 },
  Other: { energy: 0.5, valence: 0.5, intensity: 0.5 },
}

export function buildMoodSpectrum(
  artists: SpotifyArtist[],
  tracks: SpotifyTrack[],
  dna: GenreSlice[],
): MoodSpectrum {
  // Weighted-average mood across macro genres.
  let energy = 0,
    valence = 0,
    intensity = 0
  dna.forEach((slice) => {
    const m = MACRO_MOOD[slice.macro]
    energy += m.energy * slice.weight
    valence += m.valence * slice.weight
    intensity += m.intensity * slice.weight
  })

  // Eclecticism — Shannon entropy across the genre DNA, normalised.
  const entropy = -dna.reduce(
    (s, slice) => s + (slice.weight > 0 ? slice.weight * Math.log2(slice.weight) : 0),
    0,
  )
  const maxEntropy = Math.log2(Math.max(dna.length, 2))
  const eclecticism = maxEntropy > 0 ? entropy / maxEntropy : 0

  // Obscurity — inverse popularity across top artists.
  const avgPop =
    artists.reduce((s, a) => s + (a.popularity ?? 50), 0) / Math.max(artists.length, 1)
  const obscurity = clamp01(1 - avgPop / 100)

  // Nostalgia — how old the average album release is.
  const now = new Date().getFullYear()
  const years = tracks
    .map((t) => parseInt(t.album.release_date?.slice(0, 4) || "", 10))
    .filter((y) => !isNaN(y))
  const avgYear = years.length ? years.reduce((s, y) => s + y, 0) / years.length : now
  const nostalgia = clamp01((now - avgYear) / 30)

  return {
    energy: clamp01(energy),
    valence: clamp01(valence),
    intensity: clamp01(intensity),
    eclecticism: clamp01(eclecticism),
    obscurity,
    nostalgia,
  }
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

export interface Archetype {
  id: string
  name: string
  tagline: string
  description: string
  gradient: [string, string]
  emoji: string
}

export const ARCHETYPES: Archetype[] = [
  {
    id: "underground-curator",
    name: "The Underground Curator",
    tagline: "You knew them before they were cool.",
    description:
      "High obscurity, high eclecticism. You treat new releases like a treasure hunt and your queue is a Pitchfork preview.",
    gradient: ["#0f172a", "#7c3aed"],
    emoji: "🔮",
  },
  {
    id: "main-character",
    name: "The Main Character",
    tagline: "Every walk is a music video.",
    description:
      "Bright valence, mainstream pop, high energy. You live soundtracked — entrances, montages, the works.",
    gradient: ["#f97316", "#ec4899"],
    emoji: "🌟",
  },
  {
    id: "midnight-mystic",
    name: "The Midnight Mystic",
    tagline: "Headphones in, world out.",
    description:
      "Low valence, low energy, leaning indie/alt or R&B. You like songs that feel like late-night drives through nowhere in particular.",
    gradient: ["#1e1b4b", "#06b6d4"],
    emoji: "🌙",
  },
  {
    id: "rage-architect",
    name: "The Rage Architect",
    tagline: "Built for the mosh pit.",
    description:
      "High intensity, low valence, metal/punk/heavy electronic. You don't listen so much as detonate.",
    gradient: ["#7f1d1d", "#111827"],
    emoji: "🔥",
  },
  {
    id: "throwback-romantic",
    name: "The Throwback Romantic",
    tagline: "They don't make them like they used to — and you noticed.",
    description:
      "High nostalgia, mid energy, often soul/jazz/classic rock. Your playlists are vintage and your taste is intergenerational.",
    gradient: ["#78350f", "#fde68a"],
    emoji: "📻",
  },
  {
    id: "dancefloor-diplomat",
    name: "The Dancefloor Diplomat",
    tagline: "BPM is a love language.",
    description:
      "High energy, high valence, electronic-heavy. You vet weekends by setlist and you have Opinions about transitions.",
    gradient: ["#0ea5e9", "#a855f7"],
    emoji: "🪩",
  },
  {
    id: "soft-focus-poet",
    name: "The Soft-Focus Poet",
    tagline: "Lyrics over everything.",
    description:
      "Folk, indie, singer-songwriter; gentle intensity. You'd rather feel one perfect line than survive a drop.",
    gradient: ["#064e3b", "#bef264"],
    emoji: "📝",
  },
  {
    id: "global-nomad",
    name: "The Global Nomad",
    tagline: "Your queue holds a passport.",
    description:
      "High eclecticism with a Latin/Global tilt. You hop continents per shuffle and your 'discover weekly' is multilingual.",
    gradient: ["#f59e0b", "#10b981"],
    emoji: "🌍",
  },
]

export interface ArchetypeScore {
  archetype: Archetype
  score: number // normalised 0–1
}

export function classifyArchetype(
  dna: GenreSlice[],
  mood: MoodSpectrum,
): { winner: Archetype; blend: ArchetypeScore[] } {
  const top = dna[0]?.macro ?? "Other"
  const second = dna[1]?.macro

  const scores: Record<string, number> = {}
  const add = (id: string, n: number) => (scores[id] = (scores[id] ?? 0) + n)

  if (mood.obscurity > 0.55) add("underground-curator", 2 + mood.eclecticism)
  if (top === "Pop" || second === "Pop")
    add("main-character", 1 + mood.valence + mood.energy)
  if (mood.valence < 0.5 && mood.energy < 0.55)
    add("midnight-mystic", 1.5 + (0.5 - mood.valence))
  if (top === "Metal / Punk" || mood.intensity > 0.8)
    add("rage-architect", 1.5 + mood.intensity)
  if (mood.nostalgia > 0.4) add("throwback-romantic", 1 + mood.nostalgia * 2)
  if (top === "Electronic" || second === "Electronic")
    add("dancefloor-diplomat", 1 + mood.energy)
  if (top === "Folk / Country" || top === "Indie / Alternative")
    add("soft-focus-poet", 1 + (1 - mood.intensity))
  if (top === "Latin / Global" || (mood.eclecticism > 0.7 && dna.length > 4))
    add("global-nomad", 1 + mood.eclecticism)

  ARCHETYPES.forEach((a) => add(a.id, 0.1))

  const total = Object.values(scores).reduce((s, n) => s + n, 0) || 1
  const blend: ArchetypeScore[] = ARCHETYPES.map((a) => ({
    archetype: a,
    score: (scores[a.id] ?? 0) / total,
  }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  return { winner: blend[0].archetype, blend }
}

export interface PersonaInsight {
  archetype: Archetype
  blend: ArchetypeScore[]
  dna: GenreSlice[]
  mood: MoodSpectrum
  signatureTags: { tag: string; weight: number }[]
  alterEgo: { name: string; line: string }
  topArtists: SpotifyArtist[]
  topTracks: SpotifyTrack[]
}

// Pull the raw micro-tags out of every artist, weight by how often they
// appear and the artist's rank, and return the top 20. This is what powers
// the "signature tags" tag cloud.
export function buildSignatureTags(
  artists: SpotifyArtist[],
): { tag: string; weight: number }[] {
  const counts = new Map<string, number>()
  artists.forEach((a, i) => {
    const rankWeight = 1 / Math.log2(i + 2)
    a.genres.forEach((g) => {
      const t = g.toLowerCase()
      counts.set(t, (counts.get(t) ?? 0) + rankWeight)
    })
  })
  const max = Math.max(...Array.from(counts.values()), 1)
  return Array.from(counts.entries())
    .map(([tag, w]) => ({ tag, weight: w / max }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 20)
}

// Tiny "music alter ego" generator — combines two ingredients deterministically
// so the same user gets the same alter ego per analysis.
const FIRST = ["Neon", "Velvet", "Static", "Echo", "Indigo", "Wildflower", "Midnight", "Marble", "Saffron", "Glass"]
const LAST = ["Cartographer", "Renegade", "Oracle", "Heir", "Diplomat", "Phantom", "Disciple", "Magnet", "Pilgrim", "Tycoon"]

export function generateAlterEgo(
  archetype: Archetype,
  dna: GenreSlice[],
): { name: string; line: string } {
  const seed = (dna[0]?.macro ?? "Other") + archetype.id
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const name = `${FIRST[h % FIRST.length]} ${LAST[(h >> 5) % LAST.length]}`
  const line = `${archetype.emoji} ${archetype.tagline}`
  return { name, line }
}
