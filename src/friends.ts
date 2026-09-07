// The cast of "friends" — the heart of the whole app.
// Each friend IS a number: friend #1 is לולו, #2 טוקי, #3 בובי ... so the
// friends carry numeric meaning and help with counting / adding / subtracting.
//
// `name` is what's shown on screen. `say` is a niqqud (vowel-pointed) spelling
// used only for the Hebrew voice, so names like מימי / בובי are pronounced
// correctly. Tweak a single `say` here if the voice still gets one wrong.

export type Friend = {
  color: string
  name: string
  say: string
  gender?: 'f' | 'm' // set per batch as voices are recorded; defaults 'm'
  special?: number // index into FriendWorld's LIKES (the friend's special button); defaults index % 12
  game?: string // registry id the special button leads to; undefined = no matching game yet
}

export const FRIENDS: Friend[] = [
  { color: '#ef4444', name: 'לולו', say: 'לוּלוּ', gender: 'f', special: 0, game: 'skipcount' }, // 1 red — קפיצה → קפיצות
  { color: '#f97316', name: 'טוקי', say: 'טוּקִי', gender: 'm', special: 1, game: 'dance' }, // 2 orange — ריקוד → משחק ריקוד
  { color: '#facc15', name: 'בובי', say: 'בּוּבִּי', gender: 'm', special: 2, game: 'laugh' }, // 3 yellow — צחוק → משחק צחוק
  { color: '#4ade80', name: 'גוגו', say: 'גוּגוּ', gender: 'f', special: 8, game: 'draw' }, // 4 green — ציור → משחק ציור
  { color: '#14b8a6', name: 'דובי', say: 'דּוּבִּי', gender: 'm', special: 4, game: 'parrot' }, // 5 teal — שיר → משחק תוכי
  { color: '#22d3ee', name: 'נוני', say: 'נוּנִי', gender: 'f', special: 6, game: 'who' }, // 6 cyan — מחבואים → מי נעלם?
  { color: '#3b82f6', name: 'פיקו', say: 'פִּיקוֹ', gender: 'm', special: 12, game: 'goal' }, // 7 blue — כדורגל → בעיטה לשער
  { color: '#8b5cf6', name: 'דודי', say: 'דוּדִי', gender: 'm', special: 7, game: 'icecream' }, // 8 violet — גלידה → משחק גלידה
  { color: '#ec4899', name: 'זוזו', say: 'זוּזוּ', gender: 'f', special: 13, game: 'colorme' }, // 9 pink — צביעה → צובעים חבר
  { color: '#f43f5e', name: 'קוקו', say: 'קוֹקוֹ', gender: 'f', special: 9, game: 'bubbles' }, // 10 red-pink — בועות → משחק בועות (Coco)
  // 11–20 — the bigger friends (deeper rainbow); colours match BIG in FriendArt
  { color: '#e11d48', name: 'טוטו', say: 'טוֹטוֹ', gender: 'm', special: 14, game: 'piano' }, // 11 — נגינה → פסנתר חברים
  { color: '#ea580c', name: 'לילי', say: 'לִילִי', gender: 'f', special: 15, game: 'sort' }, // 12 — מיון
  { color: '#ca8a04', name: 'מומו', say: 'מוֹמוֹ', gender: 'm', special: 16, game: 'memory' }, // 13 — זיכרון
  { color: '#65a30d', name: 'ריקי', say: 'רִיקִי', gender: 'm', special: 17, game: 'pattern' }, // 14 — תבניות
  { color: '#0d9488', name: 'שושו', say: 'שׁוּשׁוּ', gender: 'f', special: 18, game: 'pet' }, // 15 — חיית מחמד (בת)
  { color: '#0891b2', name: 'גילי', say: 'גִילִי', gender: 'm', special: 19, game: 'dice' }, // 16 — קובייה
  { color: '#2563eb', name: 'רוני', say: 'רוֹנִי', gender: 'f', special: 20, game: 'catch' }, // 17 — תופסים
  { color: '#7c3aed', name: 'יויו', say: 'יוֹיוֹ', gender: 'm', special: 21, game: 'basket' }, // 18 — כדורסל
  { color: '#c026d3', name: 'סופי', say: 'סוֹפִי', gender: 'f', special: 22, game: 'letter' }, // 19 — אותיות
  { color: '#be123c', name: 'קיקי', say: 'קִיקִי', gender: 'f', special: 23, game: 'paintnum' }, // 20 — צביעה לפי מספר
  // 21–34 — the biggest friends (deepest, jewel-tone rainbow); colours match BIG.
  // Batch 3: adopting the last of the orphaned games (ROSTER-PLAN.md § אצווה 3).
  { color: '#be185d', name: 'רומי', say: 'רוֹמִי', gender: 'f', special: 24, game: 'race' }, // 21 — מרוץ מכוניות
  { color: '#c2410c', name: 'ניני', say: 'נִינִי', gender: 'f', special: 25, game: 'placevalue' }, // 22 — עשרות ואחדות
  { color: '#a16207', name: 'פופי', say: 'פּוּפִּי', gender: 'm', special: 26, game: 'build' }, // 23 — בונים מספר
  { color: '#4d7c0f', name: 'תותי', say: 'תּוּתִי', gender: 'f', special: 27, game: 'missing' }, // 24 — המספר החסר
  { color: '#047857', name: 'מישי', say: 'מִישִׁי', gender: 'm', special: 28, game: 'bigsmall' }, // 25 — גדול או קטן
  { color: '#0e7490', name: 'בוזי', say: 'בּוּזִי', gender: 'm', special: 29, game: 'sequence' }, // 26 — חבר חסר ברצף
  { color: '#1d4ed8', name: 'דגי', say: 'דַּגִּי', gender: 'm', special: 30, game: 'quantity' }, // 27 — מספר וכמות
  { color: '#6d28d9', name: 'לאלה', say: 'לַאלָה', gender: 'f', special: 31, game: 'calc' }, // 28 — מחשבון
  { color: '#a21caf', name: 'חומי', say: 'חוּמִי', gender: 'm', special: 32, game: 'challenge' }, // 29 — אתגר חשבון
  { color: '#9f1239', name: 'צוצי', say: 'צוּצִי', gender: 'f', special: 33, game: 'pop' }, // 30 — פיצוץ חברים
  // 31–40 — a fresh, bright rainbow (a new "candy" set); colours match BIG
  { color: '#dc2626', name: 'טינו', say: 'טִינוֹ', gender: 'm', special: 34, game: 'hockey' }, // 31 — הוקי אוויר
  { color: '#f59e0b', name: 'רוזי', say: 'רוֹזִי', gender: 'f', special: 35, game: 'bowling' }, // 32 — באולינג
  { color: '#eab308', name: 'ליאו', say: 'לֵיאוֹ', gender: 'm', special: 36, game: 'dots' }, // 33 — חיבור נקודות
  { color: '#84cc16', name: 'מיקה', say: 'מִיקָה', gender: 'f', special: 37, game: 'drawnum' }, // 34 — מציירים מספר
  // 35–52 — remaining registry orphans, adopted one-per-friend (no more orphaned
  // games after this point). gender follows ROSTER-PLAN's temporary odd/even rule.
  { color: '#10b981', name: 'גוזי', say: 'גוּזִי', gender: 'm', special: 38, game: 'blend' }, // 35 — להרכיב צליל
  { color: '#06b6d4', name: 'בינו', say: 'בִּינוֹ', gender: 'f', special: 39, game: 'sortshelf' }, // 36 — מכולת
  { color: '#0ea5e9', name: 'טופי', say: 'טוֹפִי', gender: 'm', special: 40, game: 'train' }, // 37 — רכבת מספרים
  { color: '#6366f1', name: 'קימי', say: 'קִימִי', gender: 'f', special: 41, game: 'spell' }, // 38 — אותיות חיות
  { color: '#a855f7', name: 'שומי', say: 'שׁוּמִי', gender: 'm', special: 42, game: 'hole' }, // 39 — בולעים הכול
  { color: '#d946ef', name: 'דיני', say: 'דִּינִי', gender: 'f', special: 43, game: 'firstletter' }, // 40 — באיזו אות
  // 41–50 — a brighter pastel rainbow (a fresh set); colours match BIG
  { color: '#e23670', name: 'פפו', say: 'פַּפּוֹ', gender: 'm', special: 44, game: 'coinsort' }, // 41 — מטבעות חברים
  { color: '#fb923c', name: 'ניבי', say: 'נִיבִּי', gender: 'f', special: 45, game: 'shop' }, // 42 — קופה
  { color: '#fcd34d', name: 'לוקי', say: 'לוּקִי', gender: 'm', special: 46, game: 'schedule' }, // 43 — סדר יום
  { color: '#a3e635', name: 'ריו', say: 'רִיוֹ', gender: 'f', special: 47, game: 'potty' }, // 44 — גמילה מטיטול
  { color: '#34d399', name: 'מיו', say: 'מִיוֹ', gender: 'm', special: 48, game: 'feedanimals' }, // 45 — מאכילים חיות
  { color: '#2dd4bf', name: 'גוני', say: 'גוֹנִי', gender: 'f', special: 49, game: 'garden' }, // 46 — גינה
  { color: '#38bdf8', name: 'בובא', say: 'בּוּבָּה', gender: 'm', special: 50, game: 'rhyme' }, // 47 — מכונת חרוזים
  { color: '#818cf8', name: 'קלי', say: 'קָלִי', gender: 'f', special: 51, game: 'encount' }, // 48 — ספירה באנגלית
  { color: '#c084fc', name: 'שיר', say: 'שִׁיר', gender: 'f', special: 52, game: 'trace' }, // 49 — לצייר אות חיה
  { color: '#f0abfc', name: 'דנה', say: 'דָּנָה', gender: 'f', special: 53, game: 'cake' }, // 50 — מכינים עוגה
  // 51–60 — a bright neon rainbow; colours match BIG in FriendArt
  { color: '#fb7185', name: 'רוקי', say: 'רוֹקִי', gender: 'm', special: 54, game: 'help' }, // 51 — מבקשים עזרה
  { color: '#fdba74', name: 'ננה', say: 'נָנָה', gender: 'f', special: 55, game: 'feelings' }, // 52 — איך אני מרגיש
  { color: '#fde047', name: 'פינו', say: 'פִּינוֹ', gender: 'm', game: 'lettertalk' }, // 53 — האות שלי מדברת
  { color: '#a3e635', name: 'מולי', say: 'מוֹלִי', gender: 'f', game: 'syllables' }, // 54 — תופסים הברות
  { color: '#34d399', name: 'מיקי', say: 'מִיקִי', gender: 'm', game: 'letterbus' }, // 55 — אוטובוס האותיות
  { color: '#22d3ee', name: 'ליבי', say: 'לִיבִּי', gender: 'f', game: 'nametower' }, // 56 — מגדל השם שלי
  { color: '#60a5fa', name: 'דומי', say: 'דּוֹמִי', gender: 'm', game: 'letterhunt' }, // 57 — מוצאים את האות
  { color: '#818cf8', name: 'נטי', say: 'נָטִי', gender: 'f', game: 'tracehe' }, // 58 — לצייר אות חיה
  { color: '#c084fc', name: 'פלי', say: 'פְּלִי', gender: 'f', game: 'soundwheel' }, // 59 — גלגל הצלילים
  { color: '#e879f9', name: 'זיו', say: 'זִיו', gender: 'm', game: 'letterdrawer' }, // 60 — אות במגירה
  // 61–70 — a deep vivid rainbow; colours match BIG in FriendArt
  // 61–62 are the musicians-decade flagships (host their own music games). Both
  // hosts are referred to with masculine verbs in the GDD (ריקו מנצח, דאבי רוקד).
  { color: '#f43f5e', name: 'ריקו', say: 'רִיקוֹ', gender: 'm', game: 'band' }, // 61 — להקת החברים
  { color: '#fb923c', name: 'דאבי', say: 'דָּאבִּי', gender: 'm', game: 'rhythmblocks' }, // 62 — מכונת הקצב
  { color: '#fbbf24', name: 'פוקי', say: 'פוֹקִי' }, // 63
  { color: '#a3e635', name: 'לוטי', say: 'לוֹטִי' }, // 64
  { color: '#22c55e', name: 'ביבו', say: 'בִּיבּוֹ' }, // 65
  { color: '#14b8a6', name: 'טוני', say: 'טוֹנִי' }, // 66
  { color: '#06b6d4', name: 'נוקי', say: 'נוּקִי' }, // 67
  { color: '#3b82f6', name: 'לומי', say: 'לוּמִי' }, // 68
  { color: '#8b5cf6', name: 'גבי', say: 'גָּבִּי' }, // 69
  { color: '#d946ef', name: 'זומי', say: 'זוּמִי' }, // 70
  // 71–100 — the rest of the cast (full rainbow); colours match BIG in FriendArt
  { color: '#ef4444', name: 'טיקה', say: 'טִיקָה' }, // 71
  { color: '#f97316', name: 'בומי', say: 'בּוּמִי' }, // 72
  { color: '#f59e0b', name: 'לאלו', say: 'לָאלוֹ' }, // 73
  { color: '#eab308', name: 'פיני', say: 'פִּינִי' }, // 74
  { color: '#84cc16', name: 'ססי', say: 'סָסִי' }, // 75
  { color: '#22c55e', name: 'מומי', say: 'מוֹמִי' }, // 76
  { color: '#10b981', name: 'דודו', say: 'דּוּדוּ' }, // 77
  { color: '#14b8a6', name: 'נונו', say: 'נוֹנוֹ' }, // 78
  { color: '#06b6d4', name: 'קולי', say: 'קוּלִי' }, // 79
  { color: '#0ea5e9', name: 'רביב', say: 'רָבִיב' }, // 80
  { color: '#3b82f6', name: 'תמי', say: 'תָּמִי' }, // 81
  { color: '#6366f1', name: 'גיגי', say: 'גִיגִי' }, // 82
  { color: '#8b5cf6', name: 'לובי', say: 'לוּבִּי' }, // 83
  { color: '#a855f7', name: 'נימי', say: 'נִימִי' }, // 84
  { color: '#d946ef', name: 'פולי', say: 'פּוֹלִי' }, // 85
  { color: '#ec4899', name: 'זאזא', say: 'זָאזָא' }, // 86
  { color: '#f43f5e', name: 'לואי', say: 'לוּאִי' }, // 87
  { color: '#fb7185', name: 'מילו', say: 'מִילוֹ' }, // 88
  { color: '#fb923c', name: 'רינה', say: 'רִינָה' }, // 89
  { color: '#fbbf24', name: 'בובו', say: 'בּוֹבּוֹ' }, // 90
  { color: '#a3e635', name: 'קוקי', say: 'קוֹקִי' }, // 91
  { color: '#34d399', name: 'לולה', say: 'לוֹלָה' }, // 92
  { color: '#2dd4bf', name: 'דידי', say: 'דִּידִי' }, // 93
  { color: '#22d3ee', name: 'פיצי', say: 'פִּיצִי' }, // 94
  { color: '#38bdf8', name: 'נונה', say: 'נוּנָה' }, // 95
  { color: '#818cf8', name: 'גאגא', say: 'גָּאגָּא' }, // 96
  { color: '#c084fc', name: 'טיפו', say: 'טִיפּוֹ' }, // 97
  { color: '#e879f9', name: 'סוסו', say: 'סוּסוּ' }, // 98
  { color: '#f0abfc', name: 'תומי', say: 'תּוֹמִי' }, // 99
  { color: '#fda4af', name: 'מאיה', say: 'מָאיָה' }, // 100
]

export function friendColor(index: number) {
  return FRIENDS[index % FRIENDS.length].color
}

export function friendName(index: number) {
  return FRIENDS[index % FRIENDS.length].name
}

// What the voice should say (niqqud spelling for correct pronunciation).
export function friendSay(index: number) {
  return FRIENDS[index % FRIENDS.length].say
}

// Boy/girl — drives the recorded voice + spoken verb agreement. Defaults male
// until set per batch. Kept in sync with GENDER in scripts/gen-voice.mjs.
export function friendGender(index: number): 'f' | 'm' {
  return FRIENDS[index % FRIENDS.length].gender ?? 'm'
}

// Which special button this friend has (index into FriendWorld's LIKES).
export function friendSpecial(index: number): number {
  return FRIENDS[index % FRIENDS.length].special ?? index % 12
}

// The game id this friend's special button leads to (or undefined if its game
// isn't built yet). Two-way: every friend should eventually point at a game,
// and every game should be reachable from at least one friend.
export function friendGame(index: number): string | undefined {
  return FRIENDS[index % FRIENDS.length].game
}

// The recorded Narakeet voice for this friend — boys cycle the male voices,
// girls the female ones, by rank within their gender. MUST mirror voiceFor in
// scripts/gen-voice.mjs so the per-voice button clips (fx-*-<Voice>) line up.
const FEMALE_VOICES = ['Ayelet', 'Tamar', 'Nurit']
const MALE_VOICES = ['Erez', 'Doron']
// EXPLICIT voice per friend, PINNED so a gender change doesn't ripple others'
// voices. Matches what's recorded for 0–20 (Shusho 14 = Tamar). MUST mirror VOICE
// in scripts/gen-voice.mjs. Unset → rank fallback.
const VOICE: Record<number, string> = {
  0: 'Ayelet', 1: 'Erez', 2: 'Doron', 3: 'Tamar', 4: 'Erez', 5: 'Nurit', 6: 'Doron',
  7: 'Erez', 8: 'Ayelet', 9: 'Tamar', 10: 'Doron', 11: 'Nurit', 12: 'Erez', 13: 'Doron',
  14: 'Tamar', 15: 'Doron', 16: 'Ayelet', 17: 'Erez', 18: 'Tamar', 19: 'Nurit',
}
export function friendVoice(index: number): string {
  const i = index % FRIENDS.length
  if (VOICE[i]) return VOICE[i]
  const g = friendGender(i)
  const pool = g === 'f' ? FEMALE_VOICES : MALE_VOICES
  let rank = 0
  for (let j = 0; j < i; j++) if (friendGender(j) === g) rank++
  return pool[rank % pool.length]
}

// Simple, kid-friendly colour name per friend (for the spoken "my colour is…").
const COLOR_NAMES = [
  'אדום', 'כתום', 'צהוב', 'ירוק', 'טורקיז', 'תכלת', 'כחול', 'סגול', 'ורוד', 'ורוד',
  'אדום', 'כתום', 'צהוב', 'ירוק', 'טורקיז', 'תכלת', 'כחול', 'סגול', 'ורוד', 'אדום',
  'ורוד', 'כתום', 'צהוב', 'ירוק', 'ירוק', 'טורקיז', 'כחול', 'סגול', 'ורוד', 'אדום',
  'אדום', 'כתום', 'צהוב', 'ירוק', 'ירוק', 'טורקיז', 'תכלת', 'כחול', 'סגול', 'ורוד',
  'ורוד', 'כתום', 'צהוב', 'ירוק', 'ירוק', 'טורקיז', 'תכלת', 'כחול', 'סגול', 'ורוד',
  'ורוד', 'כתום', 'צהוב', 'ירוק', 'ירוק', 'טורקיז', 'כחול', 'כחול', 'סגול', 'ורוד',
  'אדום', 'כתום', 'צהוב', 'ירוק', 'ירוק', 'טורקיז', 'תכלת', 'כחול', 'סגול', 'ורוד',
  'אדום', 'כתום', 'כתום', 'צהוב', 'ירוק', 'ירוק', 'ירוק', 'טורקיז', 'טורקיז', 'תכלת',
  'כחול', 'כחול', 'סגול', 'סגול', 'ורוד', 'ורוד', 'אדום', 'ורוד', 'כתום', 'צהוב',
  'ירוק', 'ירוק', 'טורקיז', 'טורקיז', 'תכלת', 'כחול', 'סגול', 'ורוד', 'ורוד', 'ורוד',
]
export function friendColorName(index: number) {
  return COLOR_NAMES[index % COLOR_NAMES.length]
}

// Each friend's number identity (לולו = 1, טוקי = 2, ...).
export function friendNumber(index: number) {
  return index + 1
}

// Bigger numbers are bigger creatures, so the child sees real magnitudes
// (לולו small, קוקו big). Tunable per screen.
export function friendSize(n: number, base = 70, step = 13, max = 220) {
  return Math.min(max, Math.round(base + (n - 1) * step))
}
