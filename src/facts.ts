// Per-friend VISUAL facts, aligned 1:1 with the recorded AUDIO lines
// (fact-<index>-0..3 in scripts/gen-voice.mjs). facts[L] is the big-digit display
// for audio level L, so the ✨ fact button SHOWS and SAYS the same fact (multiply
// → shows ×, even → shows "I'm even", etc.). Levels are ordered קל→אלוף, matching
// the audio. `big` renders LTR (like a number line / equation). Friends without an
// entry (21+, no audio yet) fall back to the generic factsFor(n) in FriendWorld.
export type FactView = { label: string; big: string }

export const FACT_VIEWS: Record<number, FactView[]> = {
  0: [ // 1 לולו
    { label: 'אני!', big: '1' },
    { label: 'השכן', big: '1 → 2' },
    { label: 'הכי קטן', big: '1 < 2 < 3' },
    { label: 'כפל', big: '1 × 5 = 5' },
  ],
  1: [ // 2 טוקי
    { label: 'אני!', big: '1 → 2' },
    { label: 'זוג', big: '✋ ✋' },
    { label: 'חיבור', big: '1 + 1 = 2' },
    { label: 'זוגי', big: '2 · 4 · 6' },
  ],
  2: [ // 3 בובי
    { label: 'אני!', big: '3' },
    { label: 'חיבור', big: '1 + 1 + 1 = 3' },
    { label: 'פינות', big: '△ = 3' },
    { label: 'אי-זוגי', big: '3' },
  ],
  3: [ // 4 גוגו
    { label: 'אני!', big: '4' },
    { label: 'חיבור', big: '2 + 2 = 4' },
    { label: 'פינות', big: '⬛ = 4' },
    { label: 'זוגי', big: '2 + 2 = 4' },
  ],
  4: [ // 5 דובי
    { label: 'אני!', big: '5' },
    { label: 'חיבור', big: '4 + 1 = 5' },
    { label: 'אצבעות', big: '✋ = 5' },
    { label: 'אי-זוגי', big: '5' },
  ],
  5: [ // 6 נוני
    { label: 'אני!', big: '6' },
    { label: 'חיבור', big: '3 + 3 = 6' },
    { label: 'רגליים', big: '🐜 = 6' },
    { label: 'זוגי', big: '3 + 3 = 6' },
  ],
  6: [ // 7 פיקו
    { label: 'אני!', big: '7' },
    { label: 'חיבור', big: '6 + 1 = 7' },
    { label: 'שבוע', big: '📅 = 7' },
    { label: 'אי-זוגי', big: '7' },
  ],
  7: [ // 8 דודי
    { label: 'אני!', big: '8' },
    { label: 'חיבור', big: '4 + 4 = 8' },
    { label: 'זרועות', big: '🐙 = 8' },
    { label: 'זוגי', big: '4 + 4 = 8' },
  ],
  8: [ // 9 זוזו
    { label: 'אני!', big: '9' },
    { label: 'חיבור', big: '8 + 1 = 9' },
    { label: 'כפל', big: '3 × 3 = 9' },
    { label: 'אי-זוגי', big: '9' },
  ],
  9: [ // 10 קוקו
    { label: 'אני!', big: '10' },
    { label: 'חיבור', big: '5 + 5 = 10' },
    { label: 'אצבעות', big: '🙌 = 10' },
    { label: 'זוגי', big: '5 + 5 = 10' },
  ],
  10: [ // 11 טוטו
    { label: 'אני!', big: '11' },
    { label: 'עשרות ואחדות', big: '10 + 1 = 11' },
    { label: 'נכתב', big: '1  1' },
    { label: 'אי-זוגי', big: '11' },
  ],
  11: [ // 12 לילי
    { label: 'אני!', big: '12' },
    { label: 'עשרות ואחדות', big: '10 + 2 = 12' },
    { label: 'זוגי', big: '6 + 6 = 12' },
    { label: 'כפל', big: '3 × 4 = 12' },
  ],
  12: [ // 13 מומו
    { label: 'אני!', big: '13' },
    { label: 'עשרות ואחדות', big: '10 + 3 = 13' },
    { label: 'אי-זוגי', big: '13 → 14' },
    { label: 'ראשוני', big: '13' },
  ],
  13: [ // 14 ריקי
    { label: 'אני!', big: '14' },
    { label: 'עשרות ואחדות', big: '10 + 4 = 14' },
    { label: 'זוגי', big: '7 + 7 = 14' },
    { label: 'כפל', big: '2 × 7 = 14' },
  ],
  14: [ // 15 שושו
    { label: 'אני!', big: '15' },
    { label: 'עשרות ואחדות', big: '10 + 5 = 15' },
    { label: 'אי-זוגי', big: '3 × 5 = 15' },
    { label: 'שורות', big: '5 + 5 + 5 = 15' },
  ],
  15: [ // 16 גילי
    { label: 'אני!', big: '16' },
    { label: 'עשרות ואחדות', big: '10 + 6 = 16' },
    { label: 'זוגי', big: '8 + 8 = 16' },
    { label: 'ריבוע', big: '4 × 4 = 16' },
  ],
  16: [ // 17 רוני
    { label: 'אני!', big: '17' },
    { label: 'עשרות ואחדות', big: '10 + 7 = 17' },
    { label: 'אי-זוגי', big: '17 → 18' },
    { label: 'ראשוני', big: '17' },
  ],
  17: [ // 18 יויו
    { label: 'אני!', big: '18' },
    { label: 'עשרות ואחדות', big: '10 + 8 = 18' },
    { label: 'זוגי', big: '9 + 9 = 18' },
    { label: 'כפל', big: '3 × 6 = 18' },
  ],
  18: [ // 19 סופי
    { label: 'אני!', big: '19' },
    { label: 'עשרות ואחדות', big: '10 + 9 = 19' },
    { label: 'אי-זוגי', big: '19 → 20' },
    { label: 'ראשוני', big: '19' },
  ],
  19: [ // 20 קיקי
    { label: 'אני!', big: '20' },
    { label: 'עשרות', big: '2 × 10 = 20' },
    { label: 'זוגי', big: '10 + 10 = 20' },
    { label: 'כפל', big: '4 × 5 = 20' },
  ],
}
