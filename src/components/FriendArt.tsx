// The shared, self-contained art for each friend (CSS in app.css under .gal-*).
// Both the design gallery and the real in-game Friend render through this, so
// there's a single source of truth for how each friend looks.
import { memo } from 'react'

export type FriendKind =
  | 'lulu'
  | 'toki'
  | 'bobby'
  | 'gogo'
  | 'moki'
  | 'nuni'
  | 'piko'
  | 'dudi'
  | 'zuzu'
  | 'koko'
  // 11–20 — the bigger friends (built from rows of bumps)
  | 'toto'
  | 'lili'
  | 'momo'
  | 'riki'
  | 'shushu'
  | 'gili'
  | 'roni'
  | 'yoyo'
  | 'sofi'
  | 'kiki'
  // 21–30 — the biggest friends (also rows of bumps)
  | 'romi'
  | 'nini'
  | 'pupi'
  | 'tuti'
  | 'mishi'
  | 'buzi'
  | 'dagi'
  | 'lala'
  | 'chumi'
  | 'tsutsi'
  // 31–40 — a fresh bright "candy" rainbow (still rows of bumps)
  | 'tino'
  | 'rozi'
  | 'leo'
  | 'mika'
  | 'guzi'
  | 'bino'
  | 'tofi'
  | 'kimi'
  | 'shumi'
  | 'dini'
  // 41–50 — a brighter pastel rainbow
  | 'papo'
  | 'nibi'
  | 'luki'
  | 'rio'
  | 'mio'
  | 'goni'
  | 'buba'
  | 'kali'
  | 'shir'
  | 'dana'
  // 51–60 — a bright neon rainbow
  | 'roki'
  | 'nana'
  | 'pino'
  | 'moli'
  | 'miki'
  | 'libi'
  | 'domi'
  | 'nati'
  | 'peli'
  | 'ziv'
  // 61–70 — a deep vivid rainbow
  | 'riko'
  | 'dabi'
  | 'foki'
  | 'loti'
  | 'bibo'
  | 'toni'
  | 'nuki'
  | 'lumi'
  | 'gabi'
  | 'zumi'
  // 71–100 — the rest of the cast (full rainbow), each with a unique pool item
  | 'tika' | 'boomi' | 'lalo' | 'pini' | 'sasi' | 'momi' | 'dudu' | 'nono' | 'kuli' | 'raviv'
  | 'tami' | 'gigi' | 'lubi' | 'nimi' | 'poli' | 'zaza' | 'louie' | 'milo' | 'rina' | 'bobo'
  | 'koki' | 'lola' | 'didi' | 'pitsi' | 'nuna' | 'gaga' | 'tipo' | 'susu' | 'tomi' | 'maya'

// Friend index (0-based) → kind. Friend #1 (לולו) is index 0.
export const FRIEND_KINDS: FriendKind[] = [
  'lulu',
  'toki',
  'bobby',
  'gogo',
  'moki',
  'nuni',
  'piko',
  'dudi',
  'zuzu',
  'koko',
  'toto',
  'lili',
  'momo',
  'riki',
  'shushu',
  'gili',
  'roni',
  'yoyo',
  'sofi',
  'kiki',
  'romi',
  'nini',
  'pupi',
  'tuti',
  'mishi',
  'buzi',
  'dagi',
  'lala',
  'chumi',
  'tsutsi',
  'tino',
  'rozi',
  'leo',
  'mika',
  'guzi',
  'bino',
  'tofi',
  'kimi',
  'shumi',
  'dini',
  'papo',
  'nibi',
  'luki',
  'rio',
  'mio',
  'goni',
  'buba',
  'kali',
  'shir',
  'dana',
  'roki',
  'nana',
  'pino',
  'moli',
  'miki',
  'libi',
  'domi',
  'nati',
  'peli',
  'ziv',
  'riko',
  'dabi',
  'foki',
  'loti',
  'bibo',
  'toni',
  'nuki',
  'lumi',
  'gabi',
  'zumi',
  'tika', 'boomi', 'lalo', 'pini', 'sasi', 'momi', 'dudu', 'nono', 'kuli', 'raviv',
  'tami', 'gigi', 'lubi', 'nimi', 'poli', 'zaza', 'louie', 'milo', 'rina', 'bobo',
  'koki', 'lola', 'didi', 'pitsi', 'nuna', 'gaga', 'tipo', 'susu', 'tomi', 'maya',
]

// ---- 11–20: the bigger friends ----
// Each is built from rows of bumps (the silhouette reveals the number), with a
// single identity colour, a face, and a persona accessory. The same FriendArt
// below renders them — it's just data-driven from here.
export const BIG_KINDS = [
  'toto', 'lili', 'momo', 'riki', 'shushu',
  'gili', 'roni', 'yoyo', 'sofi', 'kiki',
  'romi', 'nini', 'pupi', 'tuti', 'mishi',
  'buzi', 'dagi', 'lala', 'chumi', 'tsutsi',
  'tino', 'rozi', 'leo', 'mika', 'guzi',
  'bino', 'tofi', 'kimi', 'shumi', 'dini',
  'papo', 'nibi', 'luki', 'rio', 'mio',
  'goni', 'buba', 'kali', 'shir', 'dana',
  'roki', 'nana', 'pino', 'moli', 'miki',
  'libi', 'domi', 'nati', 'peli', 'ziv',
  'riko', 'dabi', 'foki', 'loti', 'bibo',
  'toni', 'nuki', 'lumi', 'gabi', 'zumi',
  'tika', 'boomi', 'lalo', 'pini', 'sasi', 'momi', 'dudu', 'nono', 'kuli', 'raviv',
  'tami', 'gigi', 'lubi', 'nimi', 'poli', 'zaza', 'louie', 'milo', 'rina', 'bobo',
  'koki', 'lola', 'didi', 'pitsi', 'nuna', 'gaga', 'tipo', 'susu', 'tomi', 'maya',
] as const
type BigKind = (typeof BIG_KINDS)[number]
export type BigAccessory =
  | 'cone' | 'bow' | 'glasses' | 'cap' | 'flower'
  | 'star' | 'earmuffs' | 'propeller' | 'tiara' | 'crown'
  // every friend gets a UNIQUE one — these are the extra distinct designs
  | 'bunnyears' | 'sunglasses' | 'catears' | 'beret' | 'feather'
  | 'headband' | 'antennae' | 'mohawk' | 'sprout' | 'wizardhat'
  | 'horns' | 'toque' | 'bandana' | 'mustache' | 'mortarboard'
  // 31–40
  | 'fez' | 'sunhat' | 'heart' | 'halo' | 'topknot'
  | 'rainbow' | 'pompoms' | 'bell' | 'moon' | 'flowercrown'
  // 41–50
  | 'unicornhorn' | 'donut' | 'lollipop' | 'clover' | 'wings'
  | 'snorkelmask' | 'icecream' | 'lightning' | 'musicnote' | 'supermask'

const BU = 46 // bump size (px) for big friends — keep in sync with .gal-big --u
const H_OVER = 0.16 // horizontal overlap of bumps within a row
const V_OVER = 0.26 // vertical overlap between rows

export const BIG: Record<BigKind, {
  rows: number[] // bumps per row, top → bottom (centred); the sum is the number
  bc: string // identity colour
  shoe: string
  acc: BigAccessory
  face: 'plain' | 'girl'
}> = {
  toto:   { rows: [3, 5, 3],       bc: '#e11d48', shoe: '#1e3a8a', acc: 'cone',      face: 'plain' }, // 11
  lili:   { rows: [2, 4, 4, 2],    bc: '#ea580c', shoe: '#1e3a8a', acc: 'bunnyears', face: 'girl' }, // 12
  momo:   { rows: [4, 5, 4],       bc: '#ca8a04', shoe: '#0e7490', acc: 'sunglasses',face: 'plain' }, // 13
  riki:   { rows: [3, 4, 4, 3],    bc: '#65a30d', shoe: '#b91c1c', acc: 'cap',       face: 'plain' }, // 14
  shushu: { rows: [1, 2, 3, 4, 5], bc: '#0d9488', shoe: '#db2777', acc: 'catears',   face: 'girl' }, // 15 ▲
  gili:   { rows: [4, 4, 4, 4],    bc: '#0891b2', shoe: '#f59e0b', acc: 'star',      face: 'plain' }, // 16 ■
  roni:   { rows: [1, 4, 4, 4, 4], bc: '#2563eb', shoe: '#f43f5e', acc: 'earmuffs',  face: 'plain' }, // 17 house
  yoyo:   { rows: [3, 4, 4, 4, 3], bc: '#7c3aed', shoe: '#22c55e', acc: 'propeller', face: 'plain' }, // 18
  sofi:   { rows: [3, 4, 5, 4, 3], bc: '#c026d3', shoe: '#f59e0b', acc: 'beret',     face: 'girl' }, // 19 ◆
  kiki:   { rows: [5, 5, 5, 5],    bc: '#be123c', shoe: '#1e3a8a', acc: 'feather',   face: 'girl' }, // 20
  romi:   { rows: [4, 4, 5, 4, 4], bc: '#be185d', shoe: '#1e3a8a', acc: 'headband',  face: 'plain' }, // 21
  nini:   { rows: [4, 5, 4, 5, 4], bc: '#c2410c', shoe: '#db2777', acc: 'antennae',  face: 'girl' }, // 22
  pupi:   { rows: [4, 5, 5, 5, 4], bc: '#a16207', shoe: '#f59e0b', acc: 'mohawk',    face: 'plain' }, // 23
  tuti:   { rows: [4, 5, 6, 5, 4], bc: '#4d7c0f', shoe: '#b91c1c', acc: 'sprout',    face: 'girl' }, // 24 ◆
  mishi:  { rows: [5, 5, 5, 5, 5], bc: '#047857', shoe: '#0e7490', acc: 'wizardhat', face: 'plain' }, // 25 ■
  buzi:   { rows: [5, 5, 6, 5, 5], bc: '#0e7490', shoe: '#f43f5e', acc: 'horns',     face: 'plain' }, // 26
  dagi:   { rows: [5, 6, 5, 6, 5], bc: '#1d4ed8', shoe: '#22c55e', acc: 'toque',     face: 'plain' }, // 27
  lala:   { rows: [5, 6, 6, 6, 5], bc: '#6d28d9', shoe: '#f59e0b', acc: 'bandana',   face: 'girl' }, // 28
  chumi:  { rows: [6, 6, 5, 6, 6], bc: '#a21caf', shoe: '#1e3a8a', acc: 'mustache',  face: 'plain' }, // 29
  tsutsi: { rows: [6, 6, 6, 6, 6], bc: '#9f1239', shoe: '#facc15', acc: 'mortarboard',face: 'girl' }, // 30 ■
  tino:   { rows: [5, 7, 7, 7, 5],    bc: '#dc2626', shoe: '#1e3a8a', acc: 'fez',        face: 'plain' }, // 31 ◆
  rozi:   { rows: [6, 7, 6, 7, 6],    bc: '#f59e0b', shoe: '#0e7490', acc: 'sunhat',     face: 'girl' }, // 32
  leo:    { rows: [6, 7, 7, 7, 6],    bc: '#eab308', shoe: '#b91c1c', acc: 'heart',      face: 'plain' }, // 33
  mika:   { rows: [6, 7, 8, 7, 6],    bc: '#84cc16', shoe: '#db2777', acc: 'halo',       face: 'girl' }, // 34 ◆
  guzi:   { rows: [7, 7, 7, 7, 7],    bc: '#10b981', shoe: '#f59e0b', acc: 'topknot',    face: 'girl' }, // 35 ■
  bino:   { rows: [6, 6, 6, 6, 6, 6], bc: '#06b6d4', shoe: '#f43f5e', acc: 'rainbow',    face: 'plain' }, // 36 ■
  tofi:   { rows: [6, 6, 7, 6, 6, 6], bc: '#0ea5e9', shoe: '#1e3a8a', acc: 'pompoms',    face: 'girl' }, // 37
  kimi:   { rows: [6, 7, 6, 7, 6, 6], bc: '#6366f1', shoe: '#facc15', acc: 'bell',       face: 'plain' }, // 38
  shumi:  { rows: [6, 7, 7, 7, 6, 6], bc: '#a855f7', shoe: '#22c55e', acc: 'moon',       face: 'plain' }, // 39
  dini:   { rows: [6, 7, 7, 7, 7, 6], bc: '#d946ef', shoe: '#0e7490', acc: 'flowercrown',face: 'girl' }, // 40
  papo:   { rows: [6, 7, 8, 7, 7, 6],    bc: '#e23670', shoe: '#1e3a8a', acc: 'unicornhorn', face: 'plain' }, // 41
  nibi:   { rows: [7, 7, 7, 7, 7, 7],    bc: '#fb923c', shoe: '#0e7490', acc: 'donut',       face: 'girl' }, // 42 ■
  luki:   { rows: [7, 7, 8, 7, 7, 7],    bc: '#fcd34d', shoe: '#b91c1c', acc: 'lollipop',    face: 'plain' }, // 43
  rio:    { rows: [7, 8, 7, 8, 7, 7],    bc: '#a3e635', shoe: '#7c3aed', acc: 'clover',      face: 'plain' }, // 44
  mio:    { rows: [7, 8, 8, 8, 7, 7],    bc: '#34d399', shoe: '#db2777', acc: 'wings',       face: 'girl' }, // 45
  goni:   { rows: [7, 8, 8, 8, 8, 7],    bc: '#2dd4bf', shoe: '#f59e0b', acc: 'snorkelmask', face: 'plain' }, // 46
  buba:   { rows: [8, 8, 8, 7, 8, 8],    bc: '#38bdf8', shoe: '#1e3a8a', acc: 'icecream',    face: 'girl' }, // 47
  kali:   { rows: [8, 8, 8, 8, 8, 8],    bc: '#818cf8', shoe: '#f43f5e', acc: 'lightning',   face: 'girl' }, // 48 ■
  shir:   { rows: [8, 8, 9, 8, 8, 8],    bc: '#c084fc', shoe: '#15803d', acc: 'musicnote',   face: 'girl' }, // 49
  dana:   { rows: [8, 9, 8, 9, 8, 8],    bc: '#f0abfc', shoe: '#0e7490', acc: 'supermask',   face: 'girl' }, // 50
  roki:   { rows: [8, 9, 9, 9, 8, 8],     bc: '#fb7185', shoe: '#1e3a8a', acc: 'tiara',     face: 'girl' }, // 51
  nana:   { rows: [8, 9, 9, 9, 9, 8],     bc: '#fdba74', shoe: '#0e7490', acc: 'crown',     face: 'plain' }, // 52
  pino:   { rows: [9, 9, 9, 9, 9, 8],     bc: '#fde047', shoe: '#b91c1c', acc: 'bow',       face: 'girl' }, // 53
  moli:   { rows: [9, 9, 9, 9, 9, 9],     bc: '#a3e635', shoe: '#db2777', acc: 'flower',    face: 'girl' }, // 54 ■
  miki:   { rows: [9, 9, 10, 9, 9, 9],    bc: '#34d399', shoe: '#f59e0b', acc: 'cone',      face: 'plain' }, // 55
  libi:   { rows: [9, 10, 9, 10, 9, 9],   bc: '#22d3ee', shoe: '#f43f5e', acc: 'cap',       face: 'plain' }, // 56
  domi:   { rows: [9, 10, 10, 10, 9, 9],  bc: '#60a5fa', shoe: '#22c55e', acc: 'star',      face: 'plain' }, // 57
  nati:   { rows: [9, 10, 10, 10, 10, 9], bc: '#818cf8', shoe: '#facc15', acc: 'glasses',   face: 'plain' }, // 58
  peli:   { rows: [10, 10, 10, 9, 10, 10],   bc: '#c084fc', shoe: '#15803d', acc: 'propeller', face: 'plain' }, // 59
  ziv:    { rows: [10, 10, 10, 10, 10, 10],  bc: '#e879f9', shoe: '#7c3aed', acc: 'earmuffs',  face: 'girl' }, // 60 ■
  riko:   { rows: [9, 9, 9, 9, 9, 8, 8],        bc: '#f43f5e', shoe: '#1e3a8a', acc: 'crown',     face: 'plain' }, // 61
  dabi:   { rows: [9, 9, 9, 9, 9, 9, 8],        bc: '#fb923c', shoe: '#0e7490', acc: 'star',      face: 'plain' }, // 62
  foki:   { rows: [9, 9, 9, 9, 9, 9, 9],        bc: '#fbbf24', shoe: '#b91c1c', acc: 'bow',       face: 'girl' }, // 63 ■
  loti:   { rows: [9, 9, 10, 9, 9, 9, 9],       bc: '#a3e635', shoe: '#db2777', acc: 'flower',    face: 'girl' }, // 64
  bibo:   { rows: [9, 10, 9, 10, 9, 9, 9],      bc: '#22c55e', shoe: '#f59e0b', acc: 'cap',       face: 'plain' }, // 65
  toni:   { rows: [9, 10, 10, 10, 9, 9, 9],     bc: '#14b8a6', shoe: '#f43f5e', acc: 'tiara',     face: 'girl' }, // 66
  nuki:   { rows: [9, 10, 10, 10, 10, 9, 9],    bc: '#06b6d4', shoe: '#22c55e', acc: 'cone',      face: 'plain' }, // 67
  lumi:   { rows: [9, 10, 10, 10, 10, 10, 9],   bc: '#3b82f6', shoe: '#facc15', acc: 'propeller', face: 'plain' }, // 68
  gabi:   { rows: [10, 10, 10, 9, 10, 10, 10],  bc: '#8b5cf6', shoe: '#15803d', acc: 'earmuffs',  face: 'plain' }, // 69
  zumi:   { rows: [10, 10, 10, 10, 10, 10, 10], bc: '#d946ef', shoe: '#7c3aed', acc: 'glasses',   face: 'girl' }, // 70 ■
  // 71–100 — the rest of the cast. `acc` is unused here (a unique pool item shows instead).
  tika:  { rows: [10, 10, 10, 11, 10, 10, 10], bc: '#ef4444', shoe: '#1e3a8a', acc: 'star', face: 'girl' }, // 71
  boomi: { rows: [10, 10, 11, 10, 11, 10, 10], bc: '#f97316', shoe: '#0e7490', acc: 'star', face: 'plain' }, // 72
  lalo:  { rows: [10, 10, 11, 11, 11, 10, 10], bc: '#f59e0b', shoe: '#b91c1c', acc: 'star', face: 'plain' }, // 73
  pini:  { rows: [10, 11, 11, 10, 11, 11, 10], bc: '#eab308', shoe: '#db2777', acc: 'star', face: 'girl' }, // 74
  sasi:  { rows: [10, 11, 11, 11, 11, 11, 10], bc: '#84cc16', shoe: '#f59e0b', acc: 'star', face: 'girl' }, // 75
  momi:  { rows: [11, 11, 11, 10, 11, 11, 11], bc: '#22c55e', shoe: '#f43f5e', acc: 'star', face: 'plain' }, // 76
  dudu:  { rows: [11, 11, 11, 11, 11, 11, 11], bc: '#10b981', shoe: '#22c55e', acc: 'star', face: 'plain' }, // 77 ■
  nono:  { rows: [9, 10, 10, 10, 10, 10, 10, 9], bc: '#14b8a6', shoe: '#facc15', acc: 'star', face: 'girl' }, // 78
  kuli:  { rows: [10, 10, 10, 9, 10, 10, 10, 10], bc: '#06b6d4', shoe: '#15803d', acc: 'star', face: 'plain' }, // 79
  raviv: { rows: [10, 10, 10, 10, 10, 10, 10, 10], bc: '#0ea5e9', shoe: '#7c3aed', acc: 'star', face: 'plain' }, // 80 ■
  tami:  { rows: [10, 10, 10, 11, 10, 10, 10, 10], bc: '#3b82f6', shoe: '#1e3a8a', acc: 'star', face: 'girl' }, // 81
  gigi:  { rows: [10, 10, 10, 11, 11, 10, 10, 10], bc: '#6366f1', shoe: '#0e7490', acc: 'star', face: 'girl' }, // 82
  lubi:  { rows: [10, 10, 11, 11, 11, 10, 10, 10], bc: '#8b5cf6', shoe: '#b91c1c', acc: 'star', face: 'plain' }, // 83
  nimi:  { rows: [10, 10, 11, 11, 11, 11, 10, 10], bc: '#a855f7', shoe: '#db2777', acc: 'star', face: 'girl' }, // 84
  poli:  { rows: [10, 11, 11, 11, 11, 11, 10, 10], bc: '#d946ef', shoe: '#f59e0b', acc: 'star', face: 'plain' }, // 85
  zaza:  { rows: [10, 11, 11, 11, 11, 11, 11, 10], bc: '#ec4899', shoe: '#f43f5e', acc: 'star', face: 'girl' }, // 86
  louie: { rows: [11, 11, 11, 11, 11, 11, 11, 10], bc: '#f43f5e', shoe: '#22c55e', acc: 'star', face: 'plain' }, // 87
  milo:  { rows: [11, 11, 11, 11, 11, 11, 11, 11], bc: '#fb7185', shoe: '#facc15', acc: 'star', face: 'plain' }, // 88 ■
  rina:  { rows: [10, 10, 10, 10, 9, 10, 10, 10, 10], bc: '#fb923c', shoe: '#15803d', acc: 'star', face: 'girl' }, // 89
  bobo:  { rows: [10, 10, 10, 10, 10, 10, 10, 10, 10], bc: '#fbbf24', shoe: '#7c3aed', acc: 'star', face: 'plain' }, // 90 ■
  koki:  { rows: [10, 10, 10, 10, 11, 10, 10, 10, 10], bc: '#a3e635', shoe: '#1e3a8a', acc: 'star', face: 'girl' }, // 91
  lola:  { rows: [10, 10, 10, 11, 10, 11, 10, 10, 10], bc: '#34d399', shoe: '#0e7490', acc: 'star', face: 'girl' }, // 92
  didi:  { rows: [10, 10, 10, 11, 11, 11, 10, 10, 10], bc: '#2dd4bf', shoe: '#b91c1c', acc: 'star', face: 'plain' }, // 93
  pitsi: { rows: [10, 10, 11, 11, 10, 11, 11, 10, 10], bc: '#22d3ee', shoe: '#db2777', acc: 'star', face: 'girl' }, // 94
  nuna:  { rows: [10, 10, 11, 11, 11, 11, 11, 10, 10], bc: '#38bdf8', shoe: '#f59e0b', acc: 'star', face: 'girl' }, // 95
  gaga:  { rows: [10, 11, 11, 11, 10, 11, 11, 11, 10], bc: '#818cf8', shoe: '#f43f5e', acc: 'star', face: 'plain' }, // 96
  tipo:  { rows: [10, 11, 11, 11, 11, 11, 11, 11, 10], bc: '#c084fc', shoe: '#22c55e', acc: 'star', face: 'plain' }, // 97
  susu:  { rows: [11, 11, 11, 11, 10, 11, 11, 11, 11], bc: '#e879f9', shoe: '#facc15', acc: 'star', face: 'plain' }, // 98
  tomi:  { rows: [11, 11, 11, 11, 11, 11, 11, 11, 11], bc: '#f0abfc', shoe: '#15803d', acc: 'star', face: 'girl' }, // 99 ■
  maya:  { rows: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10], bc: '#fda4af', shoe: '#7c3aed', acc: 'star', face: 'girl' }, // 100 ■
}

const bigNatural = Object.fromEntries(
  BIG_KINDS.map((k) => {
    const rows = BIG[k].rows
    const cols = Math.max(...rows)
    const w = Math.round(BU * (1 + (cols - 1) * (1 - H_OVER))) + 30
    const h = Math.round(BU * (1 + (rows.length - 1) * (1 - V_OVER))) + 26
    return [k, { w, h }]
  }),
) as Record<BigKind, { w: number; h: number }>

const bigOrder = Object.fromEntries(
  BIG_KINDS.map((k) => [k, BIG[k].rows.flatMap((c) => Array.from({ length: c }, () => 'bump'))]),
) as Record<BigKind, string[]>

// Natural design box (matches the px sizes in app.css), used for scaling.
export const FRIEND_NATURAL: Record<FriendKind, { w: number; h: number }> = {
  lulu: { w: 104, h: 104 },
  toki: { w: 176, h: 106 },
  bobby: { w: 168, h: 166 },
  gogo: { w: 180, h: 178 },
  moki: { w: 168, h: 210 },
  nuni: { w: 216, h: 150 },
  piko: { w: 214, h: 224 },
  dudi: { w: 242, h: 138 },
  zuzu: { w: 208, h: 206 },
  koko: { w: 278, h: 130 },
  ...bigNatural,
}

// Each friend's coloured parts, listed in COUNT ORDER (bottom-up, left→right),
// so lighting them up 1..N feels natural. Each entry is the part's CSS classes.
const PART_ORDER: Record<FriendKind, string[]> = {
  lulu: ['bump solo'],
  toki: ['lobe left', 'lobe right'],
  bobby: ['bump bl', 'bump br', 'bump top'],
  gogo: ['bump bl', 'bump br', 'bump tl', 'bump tr'],
  moki: ['bump bl', 'bump br', 'bump tl', 'bump tr', 'bump top'],
  nuni: ['bump c4', 'bump c5', 'bump c6', 'bump c1', 'bump c2', 'bump c3'],
  piko: ['bump p4', 'bump p3', 'bump p5', 'bump p2', 'bump p6', 'bump p1', 'bump cn'],
  dudi: ['bump b5', 'bump b6', 'bump b7', 'bump b8', 'bump b1', 'bump b2', 'bump b3', 'bump b4'],
  zuzu: ['bump m7', 'bump m8', 'bump m9', 'bump m4', 'bump m5', 'bump m6', 'bump m1', 'bump m2', 'bump m3'],
  koko: [
    'bump m6',
    'bump m7',
    'bump m8',
    'bump m9',
    'bump m10',
    'bump m1',
    'bump m2',
    'bump m3',
    'bump m4',
    'bump m5',
  ],
  ...bigOrder,
}

export function friendKindForIndex(index: number) {
  return FRIEND_KINDS[index % FRIEND_KINDS.length]
}
export function friendMaxDim(index: number) {
  const n = FRIEND_NATURAL[friendKindForIndex(index)]
  return Math.max(n.w, n.h)
}
export function friendPartCount(kind: FriendKind) {
  return PART_ORDER[kind].length
}

// Bump centres for a big friend (11–30), in its own cluster pixels, listed in
// COUNT ORDER (matches how litUnits lights them up). The connect-the-dots game
// uses this so each numbered dot sits exactly on a bump. Returns null for the
// hand-placed small friends (1–10). w/h are the cluster's natural size.
export function bigBumpLayout(
  kind: FriendKind,
): { centers: { x: number; y: number }[]; w: number; h: number } | null {
  if (!(BIG_KINDS as readonly string[]).includes(kind)) return null
  const rows = BIG[kind as BigKind].rows
  const stepH = BU * (1 - H_OVER) // horizontal distance between bump centres
  const stepV = BU * (1 - V_OVER) // vertical distance between row centres
  const maxCols = Math.max(...rows)
  const w = BU + (maxCols - 1) * stepH
  const h = BU + (rows.length - 1) * stepV
  const centers: { x: number; y: number }[] = []
  rows.forEach((c, r) => {
    const rowW = BU + (c - 1) * stepH
    const rowLeft = (w - rowW) / 2
    const y = r * stepV + BU / 2
    // rows are flex + RTL, so DOM index 0 is the right-most bump
    for (let j = 0; j < c; j++) centers.push({ x: rowLeft + rowW - BU / 2 - j * stepH, y })
  })
  return { centers, w, h }
}

// What a dressed-up friend can wear.
export type Outfit = { hat?: string; face?: string; body?: string; held?: string }

// Where worn items sit on each friend, in the friend's OWN design coordinates:
// x is always centred (50% — every face is symmetric), so we only need the
// vertical anchor (% of the design box) per slot, plus a head width (natural px)
// that drives the item size. Items render inside the design box, so they scale
// with the friend automatically. hat = on top of the head, eye = over the eyes,
// body = on the torso, held = beside the friend.
type DressAnchor = { hat: number; eye: number; body: number; heldTop: number; heldLeft: number; hw: number }
const DRESS: Record<string, DressAnchor> = {
  lulu: { hat: 8, eye: 39, body: 66, heldTop: 70, heldLeft: 90, hw: 66 },
  toki: { hat: 2, eye: 35, body: 62, heldTop: 68, heldLeft: 86, hw: 64 },
  bobby: { hat: 2, eye: 19, body: 60, heldTop: 70, heldLeft: 86, hw: 84 },
  gogo: { hat: 4, eye: 31, body: 60, heldTop: 72, heldLeft: 86, hw: 90 },
  moki: { hat: -2, eye: 14, body: 62, heldTop: 76, heldLeft: 86, hw: 80 },
  nuni: { hat: 2, eye: 27, body: 58, heldTop: 70, heldLeft: 88, hw: 78 },
  piko: { hat: 6, eye: 47, body: 74, heldTop: 82, heldLeft: 86, hw: 80 },
  dudi: { hat: 2, eye: 28, body: 60, heldTop: 70, heldLeft: 88, hw: 88 },
  zuzu: { hat: 4, eye: 46, body: 72, heldTop: 82, heldLeft: 86, hw: 86 },
  koko: { hat: 2, eye: 25, body: 54, heldTop: 62, heldLeft: 88, hw: 64 },
  big: { hat: -6, eye: 40, body: 72, heldTop: 80, heldLeft: 84, hw: 54 },
}

// clothing emoji are drawn as a real CSS garment (a coloured top that drapes over
// the body) instead of an emoji just laid on top — so it looks WORN. The value is
// the garment colour. Non-clothing body items stay as their emoji.
const GARMENT_COLOR: Record<string, string> = {
  '👕': '#4f9fe0', // t-shirt
  '👗': '#ec4899', // dress
  '🦺': '#f59e0b', // vest
  '🧥': '#8b5a2b', // coat
  '👔': '#3b4a6b', // shirt + tie
  '🎽': '#22c55e', // tank top
  '🩱': '#a855f7', // swimsuit
  '🥋': '#eef2f7', // gi
  '🧣': '#e11d48', // scarf
  '🧤': '#6366f1', // gloves (worn-ish)
}

// Pool of 100 UNIQUE personal items, one per friend from #51 onward (index 0 =
// friend 51, index 49 = friend 100, with 50 more in reserve as the cast grows).
// Keep every entry distinct so no two friends share an item. `slot` = where it
// sits on the friend: worn on the head / face / body, or held beside the hand.
type ItemSlot = 'hat' | 'face' | 'body' | 'held'
export const ITEMS: { emoji: string; slot: ItemSlot }[] = [
  { emoji: '👜', slot: 'held' }, // 51 bag
  { emoji: '⌚', slot: 'held' }, // 52 watch
  { emoji: '👛', slot: 'held' }, // 53 wallet
  { emoji: '🧸', slot: 'held' }, // 54 doll
  { emoji: '👓', slot: 'face' }, // 55 glasses
  { emoji: '📿', slot: 'held' }, // 56 bracelet
  { emoji: '🧣', slot: 'body' }, // 57 scarf
  { emoji: '👔', slot: 'body' }, // 58 tie
  { emoji: '🧥', slot: 'body' }, // 59 sweater
  { emoji: '🎒', slot: 'held' }, // 60 backpack
  { emoji: '🕶️', slot: 'face' }, // 61 sunglasses
  { emoji: '🎩', slot: 'hat' }, // 62 top hat
  { emoji: '🧢', slot: 'hat' }, // 63 cap
  { emoji: '👑', slot: 'hat' }, // 64 crown
  { emoji: '🌂', slot: 'held' }, // 65 umbrella
  { emoji: '🎁', slot: 'held' }, // 66 gift
  { emoji: '🎀', slot: 'hat' }, // 67 bow
  { emoji: '👟', slot: 'held' }, // 68 sneaker
  { emoji: '🧤', slot: 'held' }, // 69 gloves
  { emoji: '🪀', slot: 'held' }, // 70 yoyo
  { emoji: '⚽', slot: 'held' }, // 71 soccer
  { emoji: '🏀', slot: 'held' }, // 72 basketball
  { emoji: '🌊', slot: 'held' }, // 73 sea
  { emoji: '🌧️', slot: 'held' }, // 74 rain
  { emoji: '☀️', slot: 'hat' }, // 75 sun
  { emoji: '🍌', slot: 'held' }, // 76 banana
  { emoji: '🎈', slot: 'held' }, // 77 balloon
  { emoji: '🚀', slot: 'held' }, // 78 rocket
  { emoji: '🌈', slot: 'held' }, // 79 rainbow
  { emoji: '⭐', slot: 'hat' }, // 80 star
  { emoji: '🎸', slot: 'held' }, // 81 guitar
  { emoji: '🎮', slot: 'held' }, // 82 game controller
  { emoji: '🍕', slot: 'held' }, // 83 pizza
  { emoji: '🦄', slot: 'held' }, // 84 unicorn
  { emoji: '🐱', slot: 'held' }, // 85 cat
  { emoji: '🌷', slot: 'held' }, // 86 flower
  { emoji: '🪁', slot: 'held' }, // 87 kite
  { emoji: '🛹', slot: 'held' }, // 88 skateboard
  { emoji: '🎺', slot: 'held' }, // 89 trumpet
  { emoji: '🍓', slot: 'held' }, // 90 strawberry
  { emoji: '🧁', slot: 'held' }, // 91 cupcake
  { emoji: '🪐', slot: 'held' }, // 92 planet
  { emoji: '🦋', slot: 'held' }, // 93 butterfly
  { emoji: '🥁', slot: 'held' }, // 94 drum
  { emoji: '🍎', slot: 'held' }, // 95 apple
  { emoji: '🍦', slot: 'held' }, // 96 ice cream
  { emoji: '📚', slot: 'held' }, // 97 books
  { emoji: '📸', slot: 'held' }, // 98 camera
  { emoji: '🎨', slot: 'held' }, // 99 paint palette
  { emoji: '🏆', slot: 'held' }, // 100 trophy
  // 101+ reserve — more unique items as the cast keeps growing
  { emoji: '🐶', slot: 'held' },
  { emoji: '🐰', slot: 'held' },
  { emoji: '🐢', slot: 'held' },
  { emoji: '🐝', slot: 'held' },
  { emoji: '🐠', slot: 'held' },
  { emoji: '🐧', slot: 'held' },
  { emoji: '🦊', slot: 'held' },
  { emoji: '🐼', slot: 'held' },
  { emoji: '🦁', slot: 'held' },
  { emoji: '🐸', slot: 'held' },
  { emoji: '🐙', slot: 'held' },
  { emoji: '🦉', slot: 'held' },
  { emoji: '🐞', slot: 'held' },
  { emoji: '🐳', slot: 'held' },
  { emoji: '🦜', slot: 'held' },
  { emoji: '🐴', slot: 'held' },
  { emoji: '🐮', slot: 'held' },
  { emoji: '🐷', slot: 'held' },
  { emoji: '🐵', slot: 'held' },
  { emoji: '🦓', slot: 'held' },
  { emoji: '🍉', slot: 'held' },
  { emoji: '🍇', slot: 'held' },
  { emoji: '🍒', slot: 'held' },
  { emoji: '🍍', slot: 'held' },
  { emoji: '🥕', slot: 'held' },
  { emoji: '🌽', slot: 'held' },
  { emoji: '🍄', slot: 'held' },
  { emoji: '🍩', slot: 'held' },
  { emoji: '🍪', slot: 'held' },
  { emoji: '🍫', slot: 'held' },
  { emoji: '🍿', slot: 'held' },
  { emoji: '🧃', slot: 'held' },
  { emoji: '🚗', slot: 'held' },
  { emoji: '🚂', slot: 'held' },
  { emoji: '✈️', slot: 'held' },
  { emoji: '⛵', slot: 'held' },
  { emoji: '🚲', slot: 'held' },
  { emoji: '🎠', slot: 'held' },
  { emoji: '🎡', slot: 'held' },
  { emoji: '🪂', slot: 'held' },
  { emoji: '⛄', slot: 'held' },
  { emoji: '🔥', slot: 'held' },
  { emoji: '❄️', slot: 'held' },
  { emoji: '💎', slot: 'held' },
  { emoji: '🔮', slot: 'held' },
  { emoji: '🧩', slot: 'held' },
  { emoji: '🎲', slot: 'held' },
  { emoji: '🪅', slot: 'held' },
  { emoji: '🎯', slot: 'held' },
  { emoji: '🏐', slot: 'held' },
]
function itemStyle(slot: ItemSlot, A: DressAnchor): React.CSSProperties {
  if (slot === 'hat') return { top: `${A.hat}%`, left: '50%', fontSize: `${A.hw}px` }
  if (slot === 'face') return { top: `${A.eye}%`, left: '50%', fontSize: `${Math.round(A.hw * 0.82)}px` }
  if (slot === 'body') return { top: `${A.body}%`, left: '50%', fontSize: `${A.hw}px` }
  return { top: `${A.heldTop}%`, left: `${A.heldLeft}%`, fontSize: `${Math.round(A.hw * 0.66)}px` }
}

type Props = {
  kind: FriendKind
  /** Number shown on the floating halo above the head. */
  number?: number
  showHalo?: boolean
  /** How many parts are lit (coloured). The rest are faint outlines. Default = all. */
  litUnits?: number
  /** Open + chew the mouth (eating animation). */
  eating?: boolean
  /** Dress-up items worn on the friend. A filled slot replaces the matching
   *  built-in accessory; clearing it brings the built-in one back. */
  outfit?: Outfit
  /** Colouring mode — each body bump becomes a tappable, paint-it-in button.
   *  `colors[i]` is the chosen colour for part i (null = still blank). */
  paint?: PaintProps
  /** "Alive" mode — the friend blinks gently (for a featured friend, not the
   *  whole grid). Calm + respects reduced-motion. */
  lively?: boolean
  /** Face-borne emotion — morphs the friend's OWN mouth (and brows, where the
   *  friend has them) between a smile / neutral line / soft frown. Crossfaded in
   *  CSS. Default 'smile' keeps the cheerful resting face. */
  mood?: 'smile' | 'neutral' | 'frown'
  /** A one-shot gesture the friend performs (arms + pseudo-3D body lean). */
  action?: 'five' | 'hug' | 'kiss' | null
  /** Looping locomotion — the friend marches in place: legs step, arms pump,
   *  body bobs + sways. Game-controlled state (not a one-shot like `action`). */
  walking?: boolean
  /** Raise the near (right) arm and wave it — a friendly goodbye. Pairs with
   *  `walking` (the wave overrides the near arm's pump). */
  waving?: boolean
  /** Baby look — a freshly-hatched little one: bigger head + big baby eyes. */
  baby?: boolean
}

export type PaintProps = { colors: (string | null)[]; onPick: (i: number) => void }

// The persona accessory worn by each big friend (11–20). Anchored at the top
// of the head (or, for glasses, on the face) by the .acc2 rules in app.css.
function bigAccessory(acc: BigAccessory) {
  switch (acc) {
    case 'cone':
      return (
        <span className="acc2 acc2-cone">
          <i className="pom" />
        </span>
      )
    case 'bow':
      return (
        <span className="acc2 acc2-bow">
          <i className="l" />
          <i className="r" />
          <i className="k" />
        </span>
      )
    case 'glasses':
      return (
        <span className="acc2 acc2-glasses">
          <i className="l" />
          <i className="b" />
          <i className="r" />
        </span>
      )
    case 'cap':
      return (
        <span className="acc2 acc2-cap">
          <i className="brim" />
        </span>
      )
    case 'flower':
      return (
        <span className="acc2 acc2-flower">
          <i />
          <i />
          <i />
          <i />
          <i />
          <b />
        </span>
      )
    case 'star':
      return <span className="acc2 acc2-star" />
    case 'earmuffs':
      return (
        <span className="acc2 acc2-earmuffs">
          <i className="l" />
          <i className="r" />
        </span>
      )
    case 'propeller':
      return (
        <span className="acc2 acc2-propeller">
          <i className="l" />
          <i className="r" />
          <b />
        </span>
      )
    case 'tiara':
      return (
        <span className="acc2 acc2-tiara">
          <i />
          <i />
          <i />
        </span>
      )
    case 'crown':
      return (
        <span className="acc2 acc2-crown">
          <i />
          <i />
          <i />
        </span>
      )
    case 'bunnyears':
      return (
        <span className="acc2 acc2-bunnyears">
          <i className="l" />
          <i className="r" />
        </span>
      )
    case 'sunglasses':
      return (
        <span className="acc2 acc2-sunglasses">
          <i className="l" />
          <i className="b" />
          <i className="r" />
        </span>
      )
    case 'catears':
      return (
        <span className="acc2 acc2-catears">
          <i className="l" />
          <i className="r" />
        </span>
      )
    case 'beret':
      return (
        <span className="acc2 acc2-beret">
          <b />
        </span>
      )
    case 'feather':
      return (
        <span className="acc2 acc2-feather">
          <i className="band" />
        </span>
      )
    case 'headband':
      return (
        <span className="acc2 acc2-headband">
          <i className="k" />
        </span>
      )
    case 'antennae':
      return (
        <span className="acc2 acc2-antennae">
          <i className="l" />
          <i className="r" />
        </span>
      )
    case 'mohawk':
      return (
        <span className="acc2 acc2-mohawk">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      )
    case 'sprout':
      return (
        <span className="acc2 acc2-sprout">
          <i className="l" />
          <i className="r" />
        </span>
      )
    case 'wizardhat':
      return (
        <span className="acc2 acc2-wizardhat">
          <b />
        </span>
      )
    case 'horns':
      return (
        <span className="acc2 acc2-horns">
          <i className="l" />
          <i className="r" />
        </span>
      )
    case 'toque':
      return (
        <span className="acc2 acc2-toque">
          <i className="band" />
        </span>
      )
    case 'bandana':
      return (
        <span className="acc2 acc2-bandana">
          <i className="k" />
          <i className="t1" />
          <i className="t2" />
        </span>
      )
    case 'mustache':
      return <span className="acc2 acc2-mustache" />
    case 'mortarboard':
      return (
        <span className="acc2 acc2-mortarboard">
          <i className="btn" />
          <i className="tassel" />
        </span>
      )
    case 'fez':
      return (
        <span className="acc2 acc2-fez">
          <i className="tassel" />
        </span>
      )
    case 'sunhat':
      return (
        <span className="acc2 acc2-sunhat">
          <i className="band" />
        </span>
      )
    case 'heart':
      return <span className="acc2 acc2-heart" />
    case 'halo':
      return <span className="acc2 acc2-halo" />
    case 'topknot':
      return (
        <span className="acc2 acc2-topknot">
          <i className="band" />
        </span>
      )
    case 'rainbow':
      return <span className="acc2 acc2-rainbow" />
    case 'pompoms':
      return (
        <span className="acc2 acc2-pompoms">
          <i className="l" />
          <i className="r" />
        </span>
      )
    case 'bell':
      return (
        <span className="acc2 acc2-bell">
          <i className="top" />
        </span>
      )
    case 'moon':
      return <span className="acc2 acc2-moon" />
    case 'flowercrown':
      return (
        <span className="acc2 acc2-flowercrown">
          <i />
          <i />
          <i />
        </span>
      )
    case 'unicornhorn':
      return <span className="acc2 acc2-unicornhorn" />
    case 'donut':
      return (
        <span className="acc2 acc2-donut">
          <i />
          <i />
          <i />
        </span>
      )
    case 'lollipop':
      return <span className="acc2 acc2-lollipop" />
    case 'clover':
      return (
        <span className="acc2 acc2-clover">
          <i />
          <i />
          <i />
          <i className="stem" />
        </span>
      )
    case 'wings':
      return (
        <span className="acc2 acc2-wings">
          <i className="l" />
          <i className="r" />
        </span>
      )
    case 'snorkelmask':
      return (
        <span className="acc2 acc2-snorkelmask">
          <i className="l" />
          <i className="r" />
        </span>
      )
    case 'icecream':
      return (
        <span className="acc2 acc2-icecream">
          <i className="cherry" />
        </span>
      )
    case 'lightning':
      return <span className="acc2 acc2-lightning" />
    case 'musicnote':
      return (
        <span className="acc2 acc2-musicnote">
          <i className="flag" />
        </span>
      )
    case 'supermask':
      return (
        <span className="acc2 acc2-supermask">
          <i className="l" />
          <i className="r" />
        </span>
      )
    default:
      return null
  }
}

function FriendArt({
  kind,
  number,
  showHalo = false,
  litUnits,
  eating = false,
  outfit,
  paint,
  lively = false,
  mood = 'smile',
  action = null,
  walking = false,
  waving = false,
  baby = false,
}: Props) {
  const order = PART_ORDER[kind]
  const lit = litUnits ?? order.length
  const parts = order.map((cls, i) =>
    paint ? (
      <button
        key={cls}
        type="button"
        className={`${cls} paint-bump ${paint.colors[i] ? '' : 'is-off'}`}
        style={paint.colors[i] ? ({ '--bc': paint.colors[i] } as React.CSSProperties) : undefined}
        onClick={() => paint.onPick(i)}
        aria-label={`חלק ${i + 1}`}
      />
    ) : (
      <span key={cls} className={`${cls} ${i < lit ? '' : 'is-off'}`} />
    ),
  )

  const isBig = (BIG_KINDS as readonly string[]).includes(kind)
  // which slots are dressed → hide the matching built-in accessory
  const wHat = !!outfit?.hat
  const wFace = !!outfit?.face
  const wBody = !!outfit?.body
  // the worn items, rendered inside the design box so they sit on the friend
  const A = DRESS[isBig ? 'big' : kind] ?? DRESS.big
  const dress = outfit ? (
    <>
      {outfit.held && (
        <span
          className="don don-held"
          style={{ top: `${A.heldTop}%`, left: '50%', fontSize: `${Math.round(A.hw * 0.62)}px` }}
        >
          {outfit.held}
        </span>
      )}
      {outfit.body &&
        (GARMENT_COLOR[outfit.body] ? (
          // a real worn garment drawn in CSS (drapes over the body)
          <span
            className="don don-garment"
            style={{
              top: `${A.body + 6}%`,
              left: '50%',
              width: `${Math.round(A.hw * 1.5)}px`,
              height: `${Math.round(A.hw * 1.05)}px`,
              ['--gc']: GARMENT_COLOR[outfit.body],
            } as React.CSSProperties}
          />
        ) : (
          <span className="don" style={{ top: `${A.body}%`, left: '50%', fontSize: `${A.hw}px` }}>
            {outfit.body}
          </span>
        ))}
      {outfit.face && (
        <span className="don" style={{ top: `${A.eye}%`, left: '50%', fontSize: `${Math.round(A.hw * 0.82)}px` }}>
          {outfit.face}
        </span>
      )}
      {outfit.hat && (
        <span className="don" style={{ top: `${A.hat}%`, left: '50%', fontSize: `${A.hw}px` }}>
          {outfit.hat}
        </span>
      )}
    </>
  ) : null

  // friends #51+ each get a unique personal item from the pool (by index)
  const personalItem = ITEMS[FRIEND_KINDS.indexOf(kind) - 50]
  // if the item is a hat, lift the number badge above it so the hat never hides it
  const headItem = personalItem?.slot === 'hat'
  const halo =
    showHalo && number ? <span className={`gal-halo ${headItem ? 'gal-halo-up' : ''}`}>{number}</span> : null
  const face = (
    <>
      <span className="gf-cheek l" />
      <span className="gf-cheek r" />
      <span className="gf-eye l" />
      <span className="gf-eye r" />
      <span className="gf-mouth" />
    </>
  )
  const eyes = (
    <>
      <span className="gf-cheek l" />
      <span className="gf-cheek r" />
      <span className="gf-eye l" />
      <span className="gf-eye r" />
    </>
  )
  const arms = (
    <>
      <span className="gal-arm l">
        <span className="hand" />
      </span>
      <span className="gal-arm r">
        <span className="hand" />
      </span>
    </>
  )
  const feet = (
    <>
      <span className="gal-foot l" />
      <span className="gal-foot r" />
    </>
  )
  const lips = (
    <span className="lips">
      <span className="lips-line" />
    </span>
  )

  let design: React.ReactElement
  if (isBig) {
    const spec = BIG[kind as BigKind]
    let n = 0
    const rows = spec.rows.map((count, r) => (
      <span className="gal-big-row" key={r}>
        {Array.from({ length: count }).map((_, c) => {
          const idx = n
          n++
          if (paint) {
            return (
              <button
                key={c}
                type="button"
                className={`bump paint-bump ${paint.colors[idx] ? '' : 'is-off'}`}
                style={paint.colors[idx] ? ({ '--bc': paint.colors[idx] } as React.CSSProperties) : undefined}
                onClick={() => paint.onPick(idx)}
                aria-label={`חלק ${idx + 1}`}
              />
            )
          }
          return <span key={c} className={`bump ${idx < lit ? '' : 'is-off'}`} />
        })}
      </span>
    ))
    // some persona accessories sit on the face (glasses / shades / mustache) —
    // those are replaced by the dress-up "face" slot; the rest sit on the head
    // and are replaced by the "hat" slot. Hide whichever the child has dressed.
    const faceAcc =
      spec.acc === 'glasses' ||
      spec.acc === 'sunglasses' ||
      spec.acc === 'mustache' ||
      spec.acc === 'snorkelmask' ||
      spec.acc === 'supermask'
    const showAcc = faceAcc ? !wFace : !wHat
    design = (
      <div
        className={`gal-big big-${kind}`}
        style={{ '--bc': spec.bc, '--shoe': spec.shoe } as React.CSSProperties}
      >
        {arms}
        <span className="gal-big-rows">{rows}</span>
        {feet}
        {spec.face === 'girl' ? (
          <>
            {eyes}
            {lips}
          </>
        ) : (
          face
        )}
        {personalItem ? (
          <span className="don" aria-hidden="true" style={itemStyle(personalItem.slot, A)}>
            {personalItem.emoji}
          </span>
        ) : (
          showAcc && bigAccessory(spec.acc)
        )}
        {dress}
        {halo}
      </div>
    )
  } else if (kind === 'lulu') {
    design = (
      <div className="gal-blob">
        {arms}
        {parts}
        {feet}
        {face}
        {!wHat && (
          <span className="acc-bow">
            <span className="loop l" />
            <span className="loop r" />
            <span className="knot" />
          </span>
        )}
        {dress}
        {halo}
      </div>
    )
  } else if (kind === 'toki') {
    design = (
      <div className="gal-toki">
        {arms}
        {parts}
        {feet}
        {face}
        {!wHat && (
          <span className="acc-hat">
            <span className="brim" />
            <span className="dome" />
            <span className="pom" />
          </span>
        )}
        {dress}
        {halo}
      </div>
    )
  } else if (kind === 'bobby') {
    design = (
      <div className="gal-bobby">
        {arms}
        {parts}
        {feet}
        {face}
        {!wBody && (
          <span className="acc-tie">
            <span className="bow" />
            <span className="knot" />
          </span>
        )}
        {dress}
        {halo}
      </div>
    )
  } else if (kind === 'gogo') {
    design = (
      <div className="gal-gogo">
        {arms}
        {parts}
        {feet}
        {eyes}
        {lips}
        {!wBody && (
          <span className="necklace">
            <span className="pendant" />
          </span>
        )}
        {dress}
        {halo}
      </div>
    )
  } else if (kind === 'moki') {
    design = (
      <div className="gal-moki">
        {arms}
        {parts}
        {feet}
        {!wHat && <span className="cowlick" />}
        {face}
        <span className="brow l" />
        <span className="brow r" />
        {!wFace && (
          <span className="glasses">
            <span className="lens" />
            <span className="bridge" />
            <span className="lens" />
          </span>
        )}
        {dress}
        {halo}
      </div>
    )
  } else if (kind === 'nuni') {
    design = (
      <div className="gal-nuni">
        {arms}
        {parts}
        {feet}
        {!wHat && <span className="earring l" />}
        {!wHat && <span className="earring r" />}
        {eyes}
        {lips}
        {!wHat && (
          <span className="flower">
            <i />
            <i />
            <i />
            <i />
            <i />
            <b />
          </span>
        )}
        {dress}
        {halo}
      </div>
    )
  } else if (kind === 'piko') {
    design = (
      <div className="gal-piko">
        {arms}
        {parts}
        {feet}
        {face}
        {!wHat && (
          <span className="crown">
            <i />
            <i />
            <i />
          </span>
        )}
        {dress}
        {halo}
      </div>
    )
  } else if (kind === 'dudi') {
    design = (
      <div className="gal-dudi">
        {arms}
        {parts}
        {feet}
        {face}
        {!wHat && (
          <span className="headphones">
            <span className="band" />
            <span className="cup l" />
            <span className="cup r" />
          </span>
        )}
        {dress}
        {halo}
      </div>
    )
  } else if (kind === 'zuzu') {
    design = (
      <div className="gal-zuzu">
        {arms}
        {!wHat && <span className="pigtail l" />}
        {!wHat && <span className="pigtail r" />}
        {parts}
        {feet}
        {face}
        {dress}
        {halo}
      </div>
    )
  } else {
    design = (
      <div className="gal-koko">
        {arms}
        {parts}
        {feet}
        {eyes}
        {lips}
        {!wHat && (
          <span className="tiara">
            <i />
            <i />
            <i />
          </span>
        )}
        {dress}
        {halo}
      </div>
    )
  }

  // stagger the blink a touch per friend so a few lively friends don't blink in sync
  const liveStyle = lively ? ({ '--blink-delay': `${((number ?? 1) % 5) * 0.8}s` } as React.CSSProperties) : undefined
  return (
    <div
      className={`friend-art mood-${mood} ${eating ? 'is-eating' : ''} ${lively ? 'is-lively' : ''} ${action ? `act-${action}` : ''} ${walking ? 'is-walking' : ''} ${waving ? 'is-waving' : ''} ${baby ? 'is-baby' : ''}`}
      style={liveStyle}
    >
      {design}
    </div>
  )
}

// Memoized: Friend art is drawn in ~36 games and is dozens of DOM nodes each. Its
// props are almost always stable (index-derived kind/number + primitive flags), so
// score/timer/drag updates in the parent must NOT re-render every friend on screen.
export default memo(FriendArt)
