// Batch-2 generator — covers every NEW Hebrew line added since gen-voice.mjs's
// last pass (see docs/plan-2026-07/voice-lines-needed.md): the daily schedule,
// "מבקשים עזרה", the potty jingle/stop&go/body-signal lines, the hole-count
// finale, all 6 letter games' shared letter data (names/sounds/acrophonic
// words), "אות במגירה"'s word bank, "תופסים הברות"'s syllable breakdowns, the
// number-train station lines, and the calm-corner opener. Writes .mp3 files to
// public/voice/<lang>/ exactly like gen-voice.mjs — src/voice.ts's playClip()
// picks them up automatically and falls back to browser TTS if a file is
// missing, so this is purely additive.
//
// Separate FILE (not folded into gen-voice.mjs) because this batch has its own
// data model (id → plain line, mostly ONE shared narrator voice) instead of
// gen-voice.mjs's per-friend/per-number model — keeps both scripts readable.
//
// DEFAULT provider is 'edge' — Microsoft's free, keyless neural Hebrew voice
// (no card, no key), same engine + prosody as gen-voice.mjs's edge path:
//     node scripts/gen-voice-batch2.mjs
// 'narakeet' stays available for a future 1:1 premium re-record by id (see
// docs/VOICE.md) — the whole point of stable clip ids.
//
// Recipe (matches voice-lines-needed.md): PLAIN text by default; niqqud ONLY
// where the app's own source already carries it as a deliberate TTS hint
// (i18n `say` fields, the letter data's `name`, LetterDrawer's `say`, NameTower's
// `say`) — never IPA (Edge reads `[..]{ipa}` markup literally, breaking it).
//
// SAFETY: never overwrites a clip that already exists on disk — only fills in
// missing ids. Re-run any time; already-generated (or hand-replaced) files are
// left untouched.
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'

const PROVIDER = process.env.VOICE_PROVIDER || 'edge'
const LANG = process.env.VOICE_LANG || 'he'
const DELAY = Number(process.env.VOICE_DELAY || 350)

// strip emoji / other pictographic symbols before sending text to the synth —
// a couple of i18n strings (e.g. help.solved) end with a decorative emoji that
// reads oddly out loud.
const stripEmoji = (s) =>
  s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, '').trim()

// ── letter data — mirrors src/games/LetterTalk.tsx's BASE_LETTERS/FINAL_LETTERS
// (glyph → slug → name/sound/word). Keep in sync; this is the shared foundation
// for LetterTalk, LetterBus, LetterHunt, NameTower, TraceHe, LetterDrawer. ────
const LETTERS = [
  // slug, name (niqqud), sound (plain onset), word (plain, no niqqud)
  ['alef', 'אָלֶף', 'אה', 'ארנב'],
  ['bet', 'בֵּית', 'בה', 'בננה'],
  ['gimel', 'גִּימֶל', 'גה', 'גלידה'],
  ['dalet', 'דָּלֶת', 'דה', 'דג'],
  ['he', 'הֵא', 'הה', 'הר'],
  ['vav', 'וָו', 'וה', 'ורד'],
  ['zayin', 'זַיִן', 'זה', 'זברה'],
  ['het', 'חֵית', 'חה', 'חתול'],
  ['tet', 'טֵית', 'טה', 'טרקטור'],
  ['yod', 'יוּד', 'יה', 'ירח'],
  ['kaf', 'כָּף', 'כה', 'כלב'],
  ['lamed', 'לָמֶד', 'לה', 'לימון'],
  ['mem', 'מֵם', 'מה', 'מכונית'],
  ['nun', 'נוּן', 'נה', 'נחש'],
  ['samekh', 'סָמֶךְ', 'סה', 'סוס'],
  ['ayin', 'עַיִן', 'עה', 'עץ'],
  ['pe', 'פֵּא', 'פה', 'פיל'],
  ['tsadi', 'צָדִי', 'צה', 'צב'],
  ['qof', 'קוּף', 'קה', 'קוף'],
  ['resh', 'רֵישׁ', 'רה', 'רכבת'],
  ['shin', 'שִׁין', 'שה', 'שמש'],
  ['tav', 'תָּו', 'תה', 'תות'],
]
// finals: name/sound clips are SHARED with their base twin (identical audio —
// only the WORD clip is generated here); [slug, word] only.
const FINAL_WORDS = [
  ['mem-sof', 'לחם'],
  ['nun-sof', 'בלון'],
  ['tsadi-sof', 'עץ'],
  ['pe-sof', 'קוף'],
  ['kaf-sof', 'מלך'],
]

// ── LetterDrawer's word bank — mirrors src/games/LetterDrawer.tsx BANK / ──────
// FINALS_BANK exactly (word display text is informational only; `say` is what
// gets recorded). letterSlug must match LETTERS above.
const LD_BANK = [
  ['alef', [
    ['אריה', 'אַריֵה'], ['ארנב', 'אַרנָב'], ['אבטיח', 'אֲבַטִּיחַ'], ['אוטובוס', 'אוֹטוֹבּוּס'],
    ['אורז', 'אוֹרֶז'], ['אווז', 'אַוָּז'], ['אוזן', 'אוֹזֶן'], ['אוהל', 'אוֹהֶל'],
  ]],
  ['bet', [
    ['בננה', 'בָּנָנָה'], ['בלון', 'בָּלוֹן'], ['בית', 'בַּיִת'], ['בקבוק', 'בַּקבּוּק'],
    ['ברווז', 'בַּרוָז'], ['בצל', 'בָּצָל'], ['ביצה', 'בֵּיצָה'], ['בורג', 'בּוֹרֶג'],
  ]],
  ['gimel', [
    ['גלידה', 'גלִידָה'], ['גזר', 'גֶּזֶר'], ['גמל', 'גָּמָל'], ['גיטרה', 'גִיטָרָה'],
    ['גרב', 'גֶּרֶב'], ['גבינה', 'גבִינָה'], ['גלגל', 'גַּלגַּל'], ['גדר', 'גָּדֵר'],
  ]],
  ['dalet', [
    ['דג', 'דָּג'], ['דבש', 'דבַשׁ'], ['דלת', 'דֶּלֶת'], ['דוב', 'דּוֹב'],
    ['דובדבן', 'דּוּבדְבָן'], ['דלי', 'דּלִי'], ['דגל', 'דֶּגֶל'], ['דלעת', 'דּלַעַת'],
  ]],
  ['kaf', [
    ['כלב', 'כֶּלֶב'], ['כדור', 'כַּדּוּר'], ['כובע', 'כּוֹבַע'], ['כתר', 'כֶּתֶר'],
    ['כוכב', 'כּוֹכָב'], ['כיסא', 'כִּסֵּא'], ['כרוב', 'כרוּב'], ['כפית', 'כַּפִּית'],
  ]],
  ['lamed', [
    ['לימון', 'לִימוֹן'], ['ליצן', 'לֵיצָן'], ['לוויתן', 'לוִייָתָן'], ['לטאה', 'לטָאָה'],
    ['לגו', 'לֶגוֹ'], ['לפת', 'לֶפֶת'], ['לוח', 'לוּחַ'], ['לביבה', 'לבִיבָה'],
  ]],
  ['mem', [
    ['מכונית', 'מכוֹנִית'], ['מטרייה', 'מִטרִייָה'], ['מפתח', 'מַפתֵּחַ'], ['מנורה', 'מנוֹרָה'],
    ['מברשת', 'מִברֶשֶׁת'], ['מזוודה', 'מִזווָדָה'], ['מסוק', 'מָסוֹק'], ['מגדל', 'מִגדָּל'],
  ]],
  ['nun', [
    ['נחש', 'נָחָשׁ'], ['נר', 'נֵר'], ['נמלה', 'נמָלָה'], ['נעל', 'נַעַל'],
    ['נמר', 'נָמֵר'], ['נוצה', 'נוֹצָה'], ['נקניק', 'נַקנִיק'], ['נשר', 'נֶשֶׁר'],
  ]],
  ['resh', [
    ['רכבת', 'רַכֶּבֶת'], ['רגל', 'רֶגֶל'], ['רובוט', 'רוֹבּוֹט'], ['רדיו', 'רַדיוֹ'],
    ['רמזור', 'רַמזוֹר'], ['ראי', 'ראִי'], ['רוח', 'רוּחַ'], ['רכב', 'רֶכֶב'],
  ]],
  ['shin', [
    ['שמש', 'שֶׁמֶשׁ'], ['שועל', 'שוּעָל'], ['שלג', 'שֶׁלֶג'], ['שמלה', 'שִׂמלָה'],
    ['שק', 'שַׂק'], ['שבלול', 'שַׁבּלוּל'], ['שולחן', 'שוּלחָן'], ['שרביט', 'שַׁרבִיט'],
  ]],
]
const LD_FINALS = [
  ['לחם', 'לֶחֶם'], ['בלון', 'בָּלוֹן'], ['שעון', 'שָׁעוֹן'], ['עץ', 'עֵץ'], ['קוף', 'קוֹף'],
  ['מלך', 'מֶלֶך'], ['כסף', 'כֶּסֶף'], ['חלון', 'חַלּוֹן'], ['עוף', 'עוֹף'], ['גשם', 'גֶּשֶׁם'],
]

// ── Syllables (תופסים הברות) — mirrors src/games/Syllables.tsx's tier arrays; ─
// only the per-SYLLABLE breakdown is recorded (see id-scheme note in the game).
const SYL_TIERS = [
  ['e', [
    ['בה', 'ית'], ['סה', 'פר'], ['כה', 'לב'], ['חה', 'תול'], ['שה', 'מש'],
    ['פה', 'רח'], ['עו', 'גה'], ['כה', 'דור'], ['דה', 'לת'], ['יה', 'לד'],
  ]],
  ['m', [
    ['מה', 'כו', 'נית'], ['שו', 'קו', 'לד'], ['בה', 'נה', 'נה'], ['תה', 'פו', 'אח'], ['אה', 'בה', 'טיח'],
    ['טה', 'לה', 'פון'], ['מיט', 'רי', 'יה'], ['עו', 'גי', 'יה'], ['עה', 'נה', 'בים'], ['אם', 'בט', 'יה'],
  ]],
  ['h', [
    ['טה', 'לה', 'ויז', 'יה'], ['די', 'נו', 'זה', 'אור'], ['מה', 'לה', 'פה', 'פון'], ['מיס', 'פה', 'רה', 'ים'],
    ['קה', 'רו', 'סה', 'לה'], ['טרם', 'פו', 'לי', 'נה'], ['כה', 'דו', 'רה', 'גל'], ['או', 'פה', 'נו', 'עה'],
    ['מה', 'כו', 'ני', 'ות'], ['קלה', 'מן', 'טי', 'נה'],
  ]],
  ['n', [
    ['לו', 'לו'], ['טו', 'קי'], ['בו', 'בי'], ['גו', 'גו'], ['דו', 'בי'],
    ['נו', 'ני'], ['זו', 'זו'], ['קו', 'קו'], ['מו', 'מו'], ['רו', 'מי'],
  ]],
]

// ── NameTower's non-friend "family" names — mirrors NameTower.tsx's ───────────
// FAMILY_NAME_CLIP (friend-linked names already have a full intro sentence
// recorded, not an isolated word — see the comment there).
const FAMILY_NAMES = [
  ['name-asaf', 'אָסָף'], ['name-tal', 'טַל'], ['name-gal', 'גַּל'], ['name-ron', 'רוֹן'], ['name-noam', 'נֹעַם'],
  ['name-noa', 'נֹעָה'],
  ['name-lior', 'לִיאוֹר'], ['name-yonatan', 'יוֹנָתָן'], ['name-hodaya', 'הוֹדִיָּה'],
  ['name-shirli', 'שִׁירְלִי'], ['name-avichai', 'אֲבִיחַי'], ['name-avigail', 'אֲבִיגַיִל'],
]

// ── Schedule cards (visual routine strip) — mirrors he.ts sch.* ───────────────
const SCH_CARDS = [
  ['wake', 'התעוררנו'], ['toilet', 'שירותים'], ['handwash', 'רחצת ידיים'], ['brush', 'צחצוח'],
  ['dress', 'התלבשנו'], ['breakfast', 'ארוחת בוקר'], ['snack', 'חטיף'], ['drink', 'שתייה'],
  ['bag', 'תיק'], ['shoes', 'נעליים'], ['play', 'משחק'], ['kindergarten', 'גן'], ['rest', 'מנוחה'],
  ['dinner', 'ארוחת ערב'], ['bath', 'אמבטיה'], ['pajamas', "פיג'מה"], ['story', 'סיפור'], ['bed', 'מיטה'],
]

// ── Help (מבקשים עזרה) — mirrors he.ts help.* (plain text, no say field yet) ──
const HELP_LINES = [
  ['help-frust-jar', 'אוף, הצנצנת לא נפתחת…'],
  ['help-frust-puzzle', 'החלק לא נכנס…'],
  ['help-frust-shoe', 'השרוך מסתבך…'],
  ['help-frust-tower', 'המגדל גבוה מדי…'],
  ['help-frust-shelf', 'הצעצוע גבוה מדי…'],
  ['help-mirror-intro', 'עכשיו תורך!'],
  ['help-prompt', 'מה עושים? לחצו עזרה או הפסקה'],
  ['help-tryalone-say', 'ניסיתי לבד… עכשיו מבקשים!'],
  ['help-who-q', 'בחרו את מי לבקש'],
  ['help-say-help', 'אני צריך עזרה בבקשה'],
  ['help-helper-coming', 'אני עוזר לך!'],
  ['help-say-break', 'אני צריך הפסקה'],
  ['help-break-breathe', 'נושמים לאט…'],
  ['help-break-back', 'עכשיו יותר טוב. אפשר לנסות שוב'],
  ['help-solved', 'הצלחנו! תודה רבה'],
  ['help-solved-self', 'ההפסקה עזרה. הצלחתי לבד!'],
  ['help-cheer', 'כל הכבוד! ביקשת יפה!'],
]

// ── Potty jingle + stop&go + body-signal — mirrors he.ts potty.* ──────────────
const POTTY_LINES = [
  ['potty-signal-ask', 'מה הגוף אומר?'],
  ['potty-signal-pee', 'פיפי מרגישים בבטן למטה!'],
  ['potty-signal-poop', 'קקי מרגישים בבטן למטה!'],
  ['potty-jingle', 'מרגישים פיפי? עוצרים והולכים! מורידים את המים ושוטפים ידיים!'],
  ['potty-sg-play', 'בונים מגדל מספרים!'],
  ['potty-sg-n1', 'אחת'],
  ['potty-sg-n2', 'שתיים'],
  ['potty-sg-n3', 'שלוש'],
  ['potty-sg-signal', 'הגוף אומר משהו! עוצרים והולכים?'],
  ['potty-sg-back', 'הכול חיכה לך!'],
  ['potty-sg-cheer', 'בנינו את המגדל! כל הכבוד!'],
]

// ── one-off i18n lines (niqqud `say` field — already vetted for TTS) ──────────
const MISC_SAY_LINES = [
  ['hole-count-done', 'כל הכבוד! ספרנו עד עשר!'],
  ['lt-final-say', 'אוֹת סוֹפִית'],
  ['lbus-starts', 'מִי מַתְחִיל בְּ'],
  ['lbus-ends', 'מִי נִגְמָר בְּ'],
  ['lbus-like', 'כְּמוֹ'],
  ['lbus-bye', 'כָּל הָאוֹתִיּוֹת עָלוּ! בַּיי בַּיי!'],
  ['lh-where', 'אֵיפֹה הָאוֹת'],
  ['ld-starts', 'מַתְחִיל בְּ'],
  ['ld-ends', 'נִגְמָר בְּ'],
  ['train-depart', 'כָּל הַקְּרוֹנוֹת בְּסֵדֶר — יוֹצְאִים!'],
  ['train-arrive', 'הִגַּעְנוּ לַתַּחֲנָה!'],
  ['train-tripDone', 'הִגַּעְנוּ לְסוֹף הַמְּסִלָּה!'],
  ['calm-say-open', 'בואו ניקח רגע לנשום יחד'],
]

// ── assemble every clip: { id, text } — ONE shared narrator voice (this batch
// isn't friend-voiced; see EDGE_VOICE below) ──────────────────────────────────
const lines = []
for (const [c, name] of SCH_CARDS) lines.push({ id: `sch-card-${c}`, text: name })
lines.push({ id: 'sch-tap-say', text: 'מה עושים עכשיו? לוחצים על הכרטיס המואר' })
lines.push({ id: 'sch-allDone-say', text: 'כל הכבוד, סיימנו את היום' })
for (const [id, text] of HELP_LINES) lines.push({ id, text })
for (const [id, text] of POTTY_LINES) lines.push({ id, text })
for (const [id, text] of MISC_SAY_LINES) lines.push({ id, text })
for (const [slug, name, sound, word] of LETTERS) {
  lines.push({ id: `letter-name-${slug}`, text: name })
  lines.push({ id: `letter-sound-${slug}`, text: sound })
  lines.push({ id: `letter-word-${slug}`, text: word })
}
for (const [slug, word] of FINAL_WORDS) lines.push({ id: `letter-word-${slug}`, text: word })
for (const [slug, words] of LD_BANK) words.forEach(([, say], i) => lines.push({ id: `ld-word-${slug}-${i}`, text: say }))
LD_FINALS.forEach(([, say], i) => lines.push({ id: `ld-word-final-${i}`, text: say }))
for (const [code, words] of SYL_TIERS) words.forEach((syl, wi) => syl.forEach((s, si) => lines.push({ id: `syl-${code}${wi}-${si}`, text: s })))
for (const [id, text] of FAMILY_NAMES) lines.push({ id, text })

// clean up: emoji stripped, ids unique (dedupe defensively — a shared id must
// carry the same text everywhere it's used, which the code edits guarantee)
for (const l of lines) l.text = stripEmoji(l.text)
const seen = new Map()
for (const l of lines) {
  if (seen.has(l.id) && seen.get(l.id) !== l.text) {
    console.error(`⚠️  duplicate id with DIFFERENT text: ${l.id}`)
  }
  seen.set(l.id, l.text)
}

// selection ------------------------------------------------------------------
const ONLY = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean)
const PREFIX = process.env.PREFIX // e.g. PREFIX=letter- to run just the letters batch
let selected = lines.filter((l, i, arr) => arr.findIndex((x) => x.id === l.id) === i) // de-dup by id
if (ONLY.length) selected = selected.filter((l) => ONLY.includes(l.id))
if (PREFIX) selected = selected.filter((l) => l.id.startsWith(PREFIX))

const OUT = `public/voice/${LANG}`
mkdirSync(OUT, { recursive: true })
// never touch a clip that's already on disk — this script only fills gaps
const before = selected.length
selected = selected.filter((l) => !existsSync(`${OUT}/${l.id}.mp3`))
if (before !== selected.length) console.log(`skipping ${before - selected.length} already-recorded clip(s)`)

if (process.env.DRY_RUN) {
  for (const l of selected) console.log(`${l.id}\t${l.text}`)
  console.log(`\n${selected.length} clip(s) would be generated (of ${before} selected).`)
  process.exit(0)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let synth
if (PROVIDER === 'edge') {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts')
  const VOICE = process.env.EDGE_VOICE || (LANG === 'he' ? 'he-IL-HilaNeural' : 'en-US-AvaNeural')
  const PROSODY = { pitch: process.env.EDGE_PITCH || '+12%', rate: process.env.EDGE_RATE || '+6%' }
  console.log(`ספק: Edge Neural (חינם, בלי מפתח) · קול ${VOICE} · pitch ${PROSODY.pitch} rate ${PROSODY.rate} · ${selected.length} קליפים`)
  const connect = async () => {
    const t = new MsEdgeTTS()
    await t.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    return t
  }
  let tts = await connect()
  synth = async (text) => {
    let lastErr
    for (let i = 0; i < 2; i++) {
      try {
        const { audioStream } = await tts.toStream(text, PROSODY)
        const chunks = []
        await new Promise((res, rej) => {
          audioStream.on('data', (c) => chunks.push(c))
          audioStream.on('end', res)
          audioStream.on('error', rej)
        })
        const buf = Buffer.concat(chunks)
        if (buf.length < 800) throw new Error('empty')
        return buf
      } catch (e) {
        lastErr = e
        tts = await connect()
      }
    }
    throw lastErr
  }
} else if (PROVIDER === 'narakeet') {
  // premium 1:1 replacement path — same ids, so it drops straight in over Edge's
  const KEY = process.env.NARAKEET_API_KEY
  if (!KEY) throw new Error('צריך NARAKEET_API_KEY')
  const VOICE = process.env.NARAKEET_VOICE || 'Ayelet'
  const NSPEED = process.env.VOICE_SPEED || '1.0'
  console.log(`ספק: Narakeet · קול ${VOICE} · speed ${NSPEED} · ${selected.length} קליפים`)
  synth = async (text) => {
    const url = `https://api.narakeet.com/text-to-speech/mp3?voice=${encodeURIComponent(VOICE)}&voice-speed=${NSPEED}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'content-type': 'text/plain', accept: 'application/octet-stream' },
      body: Buffer.from(text, 'utf-8'),
    })
    if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => '')}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 800) throw new Error('empty')
    return buf
  }
} else {
  throw new Error(`ספק לא מוכר: ${PROVIDER}`)
}

let ok = 0
for (const l of selected) {
  let done = false
  for (let attempt = 0; attempt < 4 && !done; attempt++) {
    try {
      writeFileSync(`${OUT}/${l.id}.mp3`, await synth(l.text))
      ok++
      done = true
      if (ok % 20 === 0 || ok === selected.length) console.log(`  …${ok}/${selected.length}`)
    } catch (e) {
      const code = String(e.message)
      if ((code.includes('429') || code.includes('too small') || code.includes('empty')) && attempt < 3) {
        await sleep(4000 * (attempt + 1))
      } else {
        console.error(`❌ ${l.id}: ${e.message}`)
        done = true
      }
    }
  }
  await sleep(DELAY)
}
console.log(`\nנוצרו ${ok}/${selected.length} קליפים חדשים ב-${OUT}/`)
