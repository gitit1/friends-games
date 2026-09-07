// One-time generator for the natural-voice clips. Writes .mp3 files to
// public/voice/ which the app plays (src/voice.ts); a missing clip falls back to
// the browser voice, so everything works with or without these.
//
// DEFAULT provider is 'edge' — Microsoft's NATURAL neural voices via the Edge
// Read-Aloud service: FREE, no key, no card. Hebrew = he-IL-HilaNeural (natural,
// not robotic). Just run:
//     node scripts/gen-voice.mjs                     // Hebrew (voice/he)
//     $env:VOICE_LANG="en"; node scripts/gen-voice.mjs   // English (voice/en)
// then:  git add public/voice && git commit -m "voice clips" && git push
//
// Other providers stay available: 'gtx' (Google-translate free, robotic),
// 'azure' (needs key), 'google' (needs key). Pick a voice with EDGE_VOICE.
import { writeFileSync, mkdirSync } from 'node:fs'

const PROVIDER = process.env.VOICE_PROVIDER || 'edge'
const LANG = process.env.VOICE_LANG || 'he' // writes to public/voice/<LANG>/
const SPEED = Number(process.env.VOICE_SPEED || 0.9)
const DELAY = Number(process.env.VOICE_DELAY || 600)
// Generate just a batch of friends so they can be QA'd a few at a time before
// spending more (paid) minutes: `FROM=1 TO=5 ... node scripts/gen-voice.mjs`
// covers num-1..5 + intro-0..4. Extras (like-*/fx-*) come with the final batch.
const FROM = Number(process.env.FROM || 1)
const TO = Number(process.env.TO || 100)

// ── data (Hebrew) for the Narakeet voice. Recipe locked from manual QA:
//   • PLAIN text, NO niqqud — niqqud broke these voices (even "שתיים").
//   • IPA override `[..]{ipa}` for invented names that read as a real word
//     (e.g. מימי → "meimi") and for "המספר" (else "מסַפֵּר"). IPA is confirmed
//     working on the Ayelet voice.
//   • "לשחק" (not "נשחק").
//   Kept in sync with friends.ts / FriendWorld.tsx. 1–50, no colours.
const isEdge = PROVIDER === 'edge'
// "the number": use NIQQUD, not IPA. IPA works only on Ayelet/Lior, so it broke
// the other Narakeet voices; niqqud is read correctly as "ha-mispar" (not the
// look-alike "mesaper") by every voice, and by Edge too.
const HAMISPAR = 'הַמִּסְפָּר'
const NAME = ['לולו','טוקי','בובי','גוגו','דובי','נוני','פיקו','דודי','זוזו','קוֹקוֹ','טוטו','לילי','מומו','ריקי','שושו','גילי','רוני','יויו','סופי','קיקי','רומי','ניני','פופי','תותי','מישי','בוזי','דגי','לאלה','חומי','צוצי','טינו','רוזי','ליאו','מיקה','גוזי','בינו','טופי','קימי','שומי','דיני','פפו','ניבי','לוקי','ריו','מיו','גוני','בובה','קלי','שיר','דנה','רוקי','ננה','פינו','מולי','מיקי','ליבי','דומי','נטי','פלי','זיו','ריקו','דאבי','פוקי','לוטי','ביבו','טוני','נוקי','לומי','גבי','זומי','טיקה','בומי','לאלו','פיני','ססי','מומי','דודו','נונו','קולי','רביב','תמי','גיגי','לובי','נימי','פולי','זאזא','לואי','מילו','רינה','בובו','קוקי','לולה','דידי','פיצי','נונה','גאגא','טיפו','סוסו','תומי','מאיה']
// IPA override per name index — only where the plain reading is wrong. Grows as QA finds more.
const NAME_IPA = { 0: '[ˈlulu]{ipa}' } // 1 לולו → "Lulu" (plain reads wrong)
const nameToken = (i) => (isEdge ? NAME[i] : NAME_IPA[i] || NAME[i])
// indices 0–14 are batch 1; 15–23 are batch 2 (friends 12–20). Keep this order in
// sync with the LIKES array in src/components/FriendWorld.tsx and the
// world.like.<n> i18n keys, and with INVITE / INTRO_LIKE below.
const LIKES = ['לקפוץ','לרקוד','לצחוק','להתחבק','לשיר','לספור','לשחק מחבואים','לאכול גלידה','לצייר','להפריח בועות','לשחק בכדור','לחלק נשיקות','לשחק כדורגל','לצבוע','לנגן על פסנתר','למיין','לשחק זיכרון','לשחק בתבניות','חיות מחמד','לגלגל קובייה','לתפוס ולרוץ','לשחק כדורסל','את השפה העברית','לצבוע לפי מספרים']
// Closing invitation per like (same order as LIKES). The hug one is a warm
// "אשמח לחיבוק" rather than a plain "בואו נתחבק".
const INVITE = ['בואו נקפוץ','בואו נרקוד','בואו נצחק','אשמח לחיבוק','בואו נשיר','בואו נספור','בואו נשחק מחבואים','בואו נאכל גלידה','בואו נצייר','בואו נפריח בועות','בואו נשחק בכדור','בואו נחלק נשיקות','בואו נשחק כדורגל','בואו נצבע','בואו ננגן','בואו נמיין','בואו נשחק זיכרון','בואו נשחק בתבניות','בואו נְשַׂחֵק עם חיית מחמד','בואו נגלגל קובייה','בואו נתפוס חברים','בואו נשחק כדורסל','בואו נלמד אותיות','בואו נצבע לפי מספרים']
// short exclamation said when a friend's own "special" button is tapped (like-<n>);
// order matches LIKES / FriendWorld.tsx
const LIKE_FX = ['קפיצה!','ריקוד!','צחוק!','חיבוק!','שיר!','ספירה!','מחבואים!','גלידה!','ציור!','בועות!','כדור!','נשיקות!']

// Shared interaction buttons — recorded in EVERY chosen voice so each plays in
// the VISITED friend's voice. כיף via niqqud (works on all voices; IPA doesn't).
const SHARED = [
  { id: 'fx-five', text: 'תן לי כִּיף!' },
  { id: 'fx-hug', text: 'חיבוק גדול!' },
  { id: 'fx-kiss', text: 'נשיקה!' },
]

// Per-friend "special" button — 3 random lines in the friend's OWN voice,
// matching what they love. Indexed by friend index; filled in per batch
// (alongside GENDER) before generating.
const SPECIAL = {
  0: ['יאללה קופצים! hop hop hop', 'גבוה גבוה!', 'wow איזה קפיצה'],            // 1 לולו — קפיצה
  1: ['ולהזיז את הישבן!', 'ימינה ושמאלה', 'וסיבוב!'],                          // 2 טוקי — ריקוד
  2: ['איזה מצחיק אתה!', 'wow כמה צחקתי', 'חַה חַה חַה חַה!'],                   // 3 בובי — צחוק
  3: ['בואו נְצַיֵּיר!', 'איזה צבע אתם הכי אוהבים?', 'wow איזה יופי!'],          // 4 גוגו — ציור
  4: ['לה לה לה לה', 'איזה שיר אתם הכי אוהבים?', 'איזה שיר מקסים'],             // 5 דובי — שיר
  5: ['בואו נשחק מחבואים!', 'איפה אני?', 'מצאתם אותי!'],                       // 6 נוני — מחבואים
  6: ['גול גול גול!!!', 'איזה שַׁעַר!', 'בואו נשחק כדורגל!'],                   // 7 פיקו — כדורגל
  7: ['בא לי גלידה!', 'איזה טעם הכי טעים?', 'אמממ, טעים!'],                     // 8 דודי — גלידה
  8: ['בואו נצבע!', 'איזה צבע נבחר?', 'איזה יפה יצא!'],                         // 9 זוזו — צביעה
  9: ['בואו נפריח בועות!', 'poof! poof!', 'איזה כיף, בועות!'],                  // 10 קוקו — בועות
  10: ['בואו ננגן!', 'דו, רה, מי!', 'איזה צליל יפה!'],                         // 11 טוטו — נגינה
  11: ['אני אוהבת לסדר הכל לפי צבע!', 'בואו נמיין יחד! כל צבע במקום שלו!', 'אני הכי שְׂמֵחָה כשהכל מסודר!'],   // 12 לילי — מיון (שמחה = תואר, לא השם שִׂמְחָה)
  12: ['יש לי זיכרון ענק! בואו נשחק זיכרון!', 'אני זוכר איפה כל חבר מתחבא!', 'גלו אותי, ותזכרו איפה אני!'], // 13 מומו — זיכרון
  13: ['אני אוהב תבניות! מה בא עכשיו?', 'אדום, כחול, אדום, כחול, ועכשיו?', 'בואו נמשיך את הסדרה יחד!'],     // 14 ריקי — תבניות
  14: ['אני אוהבת חיות מחמד!', 'בואו נְשַׂחֵק עם החבר שלי!', 'כל אחד צריך קצת אהבה!'],                        // 15 שושו — חיית מחמד (בת)
  15: ['בואו נגלגל את הקובייה! איזה מִּסְפָּר יצא?', 'אני אוהב הפתעות של מזל!', 'גלגלו, ונספור כמה יצא!'],   // 16 גילי — קובייה
  16: ['אני הכי מהירה! נַסּוּ לתפוס אותי!', 'בואו נרוץ ונתפוס חברים!', 'אני זריזה כמו ברק!'],                 // 17 רוני — תופסים
  17: ['אני אוהב לזרוק לסל! קליעה!', 'בואו נשחק כדורסל יחד!', 'עוד סל ועוד סל! אני אלוף!'],                // 18 יויו — כדורסל
  18: ['אני אוהבת את השפה העברית!', 'בואו נמצא את האות הנכונה!', 'אָלֶף, בֵּית, גִּימֶל! אני יודעת הכל!'], // 19 סופי — עברית (אָלֶף בניקוד)
  19: ['אני אוהבת לצבוע לפי מִּסְפָּרִים!', 'כל מִּסְפָּר והצבע שלו! בואו נִצְבַּע!', 'נִצְבַּע יחד תמונה צבעונית!'], // 20 קיקי — "נִצְבַּע" בניקוד
}

// Per-friend number facts SPOKEN by the ✨ fact button, one per difficulty level
// (0 קל · 1 בינוני · 2 קשה · 3 אלוף), recorded in the friend's voice. The visual
// fact (big digits) still shows alongside. Filled in per friend.
// NOTE: "מספר" must be NIQQUD ('מִּסְפָּר' / 'הַמִּסְפָּר') or the voices read it as
// "מסַפֵּר" (storyteller). Same rule as HAMISPAR in the intros.
const FACTS = {
  0: [ // 1 לולו
    'אני הראשונה! אני הַמִּסְפָּר אחת.',
    'אחריי בא הַמִּסְפָּר שתיים.',
    'אני הכי קטנה — כל מִּסְפָּר גדול ממני.',
    'כל מִּסְפָּר שתכפיל בי יישאר אותו דבר!',
  ],
  1: [ // 2 טוקי
    'אני הַמִּסְפָּר שתיים. אני בא אחרי אחת.',
    'שתיים זה זוג — שתי ידיים, שתי רגליים!',
    'אחת ועוד אחת — זה אני, שתיים.',
    'אני הַמִּסְפָּר הזוגי הראשון.',
  ],
  2: [ // 3 בובי
    'אני הַמִּסְפָּר שלוש.',
    'שלוש זה אחת, ועוד אחת, ועוד אחת.',
    'יש לי שלוש פינות, כמו משולש.',
    'שלוש זה מִּסְפָּר אי-זוגי.',
  ],
  3: [ // 4 גוגו
    'אני הַמִּסְפָּר ארבע.',
    'ארבע זה שתיים ועוד שתיים.',
    'יש לי ארבע פינות, כמו ריבוע.',
    'ארבע זה מִּסְפָּר זוגי.',
  ],
  4: [ // 5 דובי
    'אני הַמִּסְפָּר חמש.',
    'חמש זה ארבע ועוד אחת.',
    'יש לי חמש אצבעות, כמו ביד.',
    'חמש זה מִּסְפָּר אי-זוגי.',
  ],
  5: [ // 6 נוני
    'אני הַמִּסְפָּר שש.',
    'שש זה שלוש ועוד שלוש.',
    'לַחֲרָקִים יש שש רגליים.',
    'שש זה מִּסְפָּר זוגי.',
  ],
  6: [ // 7 פיקו
    'אני הַמִּסְפָּר שבע.',
    'שבע זה שש ועוד אחת.',
    'יש שִׁבְעָה ימים בשבוע.',
    'שבע זה מִּסְפָּר אי-זוגי.',
  ],
  7: [ // 8 דודי
    'אני הַמִּסְפָּר שמונה.',
    'שמונה זה ארבע ועוד ארבע.',
    'לְתַמְנוּן יש שמונה זרועות!',
    'שמונה זה מִּסְפָּר זוגי.',
  ],
  8: [ // 9 זוזו
    'אני הַמִּסְפָּר תשע.',
    'תשע זה שמונה ועוד אחת.',
    'שלוש פעמים שלוש זה תשע.',
    'תשע זה מִּסְפָּר אי-זוגי.',
  ],
  9: [ // 10 קוקו
    'אני הַמִּסְפָּר עשר.',
    'עשר זה חמש ועוד חמש.',
    'יש לי עשר אצבעות בידיים!',
    'עשר זה מִּסְפָּר זוגי.',
  ],
  10: [ // 11 טוטו
    'אני הַמִּסְפָּר אחת עשרה.',
    'אחת עשרה זה עשר ועוד אחת.',
    'אחת עשרה נכתבת אחד-אחד!',
    'אחת עשרה זה מִּסְפָּר אי-זוגי.',
  ],
  11: [ // 12 לילי
    'אני הַמִּסְפָּר שתים עשרה!',
    'שתים עשרה זה עשר ועוד שתיים.',
    'אני מִּסְפָּר זוגי. שש ועוד שש זה שתים עשרה.',
    'שלוש כפול ארבע זה שתים עשרה. בשעון יש שתים עשרה שעות!',
  ],
  12: [ // 13 מומו
    'אני הַמִּסְפָּר שלוש עשרה!',
    'שלוש עשרה זה עשר ועוד שלוש.',
    'אני מִּסְפָּר אי-זוגי. אחריי בא ארבע עשרה.',
    'שלוש עשרה זה מִּסְפָּר ראשוני. מתחלק רק בעצמו ובאחד.',
  ],
  13: [ // 14 ריקי
    'אני הַמִּסְפָּר ארבע עשרה!',
    'ארבע עשרה זה עשר ועוד ארבע.',
    'אני מִּסְפָּר זוגי. שבע ועוד שבע זה ארבע עשרה.',
    'שתיים כפול שבע זה ארבע עשרה.',
  ],
  14: [ // 15 שושו
    'אני הַמִּסְפָּר חמש עשרה!',
    'חמש עשרה זה עשר ועוד חמש.',
    'אני מִּסְפָּר אי-זוגי. שלוש כפול חמש זה חמש עשרה.',
    'שלוש שורות של חמש זה חמש עשרה.',
  ],
  15: [ // 16 גילי
    'אני הַמִּסְפָּר שש עשרה!',
    'שש עשרה זה עשר ועוד שש.',
    'אני מִּסְפָּר זוגי. שמונה ועוד שמונה זה שש עשרה.',
    'ארבע כפול ארבע זה שש עשרה. אני מִּסְפָּר ריבוע!',
  ],
  16: [ // 17 רוני (בת) — ניסוח בלי המילה "מספר" שלא נשמעה טוב
    'אני הַמִּסְפָּר שבע עשרה!',
    'שבע עשרה זה עשר ועוד שבע.',
    'אני אִי-זוּגִית! אחריי בא שמונה עשרה.',
    'שְׁבַע עֶשְׂרֵה מתחלקת רק בעצמה ובאחד.',
  ],
  17: [ // 18 יויו
    'אני הַמִּסְפָּר שמונה עשרה!',
    'שמונה עשרה זה עשר ועוד שמונה.',
    'אני מִּסְפָּר זוגי. תשע ועוד תשע זה שמונה עשרה.',
    'שתיים כפול תשע זה שמונה עשרה. גם שלוש כפול שש!',
  ],
  18: [ // 19 סופי
    'אני הַמִּסְפָּר תשע עשרה!',
    'תשע עשרה זה עשר ועוד תשע.',
    'אני מִּסְפָּר אי-זוגי. אחריי בא עשרים.',
    'תשע עשרה זה מִּסְפָּר ראשוני. מתחלק רק בעצמו ובאחד.',
  ],
  19: [ // 20 קיקי — "עֶשֶׂר" בניקוד (נאמר לא טוב)
    'אני הַמִּסְפָּר עשרים!',
    'עשרים זה שתי קבוצות של עֶשֶׂר.',
    'אני מִּסְפָּר זוגי. עֶשֶׂר ועוד עֶשֶׂר זה עשרים.',
    'ארבע כפול חמש זה עשרים. גם שתיים כפול עֶשֶׂר!',
  ],
}

// Knock-knock jokes for the laugh game (Assaf loves them). Bobby (3) tells them,
// so they're recorded in his voice. Niqqud where a word could be misread.
// Per-LINE so the game can space them out (the friend doesn't rush). "knock
// knock" is English (the Hebrew "טוק טוק" was mispronounced); the rest is niqqud.
const JOKES = [
  ['knock knock!', 'מי שָׁם?', 'כֶּלֶב!', 'כֶּלֶב מי?', 'הַב הַב הַב!'],
  ['knock knock!', 'מי שָׁם?', 'פָּרָה!', 'פָּרָה מי?', 'מוּוּוּ!'],
  ['knock knock!', 'מי שָׁם?', 'בָּנָנָה!', 'בָּנָנָה מי?', 'knock knock!', 'מי שָׁם?', 'תַּפּוּז!', 'תַּפּוּז מי?', 'אֲנִי כָּל כָּךְ שָׂמֵחַ שֶׁלֹּא אָמַרְתִּי שׁוּב בָּנָנָה!'],
]

// Rhyme Machine (English↔Hebrew) — each word gets a clip that names it in BOTH
// languages, in one of our friend voices, a DIFFERENT voice per family. Each entry
// is [WORD, transliteration (so the Hebrew voice says the English word), Hebrew].
// MUST stay in sync with FAMILIES in src/games/RhymeMachine.tsx.
const RHYME_FAMILIES = [
  { voice: 'Erez',   words: [['CAT', 'קאט', 'חתול'], ['HAT', 'האט', 'כובע'], ['BAT', 'בּאט', 'עטלף'], ['RAT', 'ראט', 'עכברוש']] },
  { voice: 'Ayelet', words: [['DOG', 'דּוֹג', 'כלב'], ['LOG', 'לוֹג', 'בול עץ'], ['FOG', 'פוֹג', 'ערפל'], ['HOG', 'הוֹג', 'חזיר בר']] },
  { voice: 'Doron',  words: [['SUN', 'סאן', 'שמש'], ['BUN', 'בּאן', 'לחמנייה'], ['RUN', 'ראן', 'לרוץ']] },
  { voice: 'Tamar',  words: [['HEN', 'הֶן', 'תרנגולת'], ['PEN', 'פֶּן', 'עט'], ['TEN', 'טֶן', 'עשר']] },
  { voice: 'Nurit',  words: [['CAP', 'קאפּ', 'כובע'], ['MAP', 'מאפּ', 'מַפָּה'], ['NAP', 'נאפּ', 'תנומה']] },
  { voice: 'Erez',   words: [['MAN', 'מאן', 'איש'], ['FAN', 'פאן', 'מְאַוְרֵר'], ['PAN', 'פּאן', 'מחבת'], ['VAN', 'וואן', 'ואן']] },
  { voice: 'Ayelet', words: [['BUG', 'בּאג', 'חרק'], ['MUG', 'מאג', 'ספל'], ['HUG', 'האג', 'חיבוק']] },
  { voice: 'Doron',  words: [['RICE', 'רייס', 'אורז'], ['DICE', 'דייס', 'קובייה'], ['MICE', 'מייס', 'עַכְבָּר']] },
  { voice: 'Tamar',  words: [['RING', 'רינג', 'טבעת'], ['KING', 'קינג', 'מלך'], ['WING', 'ווינג', 'כנף']] },
  { voice: 'Nurit',  words: [['BOAT', 'בּוֹאט', 'סִירָה'], ['COAT', 'קוֹאט', 'מעיל'], ['GOAT', 'גוֹאט', 'עֵז']] },
  { voice: 'Erez',   words: [['FOX', 'פוֹקס', 'שועל'], ['BOX', 'בּוֹקס', 'קופסה']] },
  { voice: 'Tamar',  words: [['CAR', 'קאר', 'מכונית'], ['JAR', "ג'אר", 'צִנְצֶנֶת']] }, // AR moved Ayelet→Tamar (צנצנת)
  { voice: 'Doron',  words: [['CAKE', 'קייק', 'עוגה'], ['LAKE', 'לייק', 'אגם']] },
  { voice: 'Tamar',  words: [['COW', 'קאו', 'פרה'], ['BOW', 'בּוֹ', 'פפיון']] },
  { voice: 'Nurit',  words: [['BALL', 'בּוֹל', 'כדור'], ['WALL', 'ווֹל', 'קיר']] },
]

// Friend gender (index → 'f'/'m') for verb agreement in the intros. Filled in as
// each batch is QA'd; anything unset defaults to male. Kept in sync with friends.ts.
// girls (1-based number in comment): 1 לולו, 4 גוגו, 6 נוני, 9 זוזו, 10 קוקו,
// 12 לילי, 17 רוני, 19 סופי, 20 קיקי. Boys (13 מומו, 14 ריקי, 15 שושו, 16 גילי,
// 18 יויו) default to male.
const GENDER = { 0: 'f', 3: 'f', 5: 'f', 8: 'f', 9: 'f', 11: 'f', 14: 'f', 16: 'f', 18: 'f', 19: 'f' }
const genderOf = (i) => GENDER[i] || 'm'
const vg = (g, m, f) => (g === 'f' ? f : m) // pick the gendered word form

// Narakeet Hebrew voices, by gender — boys speak in a male voice, girls female,
// and we move across several so not every boy (or girl) sounds the same. Picked
// deterministically by friend index, so regenerating a clip keeps its voice.
const FEMALE_VOICES = ['Ayelet', 'Tamar', 'Nurit'] // the voices she chose
const MALE_VOICES = ['Erez', 'Doron']
// EXPLICIT voice per friend (index → voice), PINNED so a later gender change (e.g.
// Shusho 15 → girl) doesn't ripple voice assignments across other friends. These
// match what's already recorded for 0–20 (so existing clips stay valid); only
// Shusho (14) moved Erez → Tamar. Unset indices fall back to the rank rule below.
// MUST mirror VOICE in src/friends.ts.
const VOICE = {
  0: 'Ayelet', 1: 'Erez', 2: 'Doron', 3: 'Tamar', 4: 'Erez', 5: 'Nurit', 6: 'Doron',
  7: 'Erez', 8: 'Ayelet', 9: 'Tamar', 10: 'Doron', 11: 'Nurit', 12: 'Erez', 13: 'Doron',
  14: 'Tamar', 15: 'Doron', 16: 'Ayelet', 17: 'Erez', 18: 'Tamar', 19: 'Nurit',
}
// pick a voice by the friend's RANK within its gender, so successive girls (and
// boys) cycle through the pool instead of all landing on the same voice.
const voiceFor = (i) => {
  if (VOICE[i]) return VOICE[i]
  const g = genderOf(i)
  const pool = g === 'f' ? FEMALE_VOICES : MALE_VOICES
  let rank = 0
  for (let j = 0; j < i; j++) if (genderOf(j) === g) rank++
  return pool[rank % pool.length]
}

// Several intro shapes so not every friend says the same sentence (short +
// exclamatory for energy). Each is gender-aware (אוהב/אוהבת, נהנה/נהנית).
const TEMPLATES = [
  (name, num, like, g) => `שלום!! אני ${name}, ${HAMISPAR} ${num}! אני ממש ${vg(g, 'אוהב', 'אוהבת')} ${like}! בואו לשחק יחד!`,
  (name, num, like) => `היי! קוראים לי ${name}, ואני ${HAMISPAR} ${num}! בואו ${like} אִתִּי!`,
  (name, num, like, g) => `wow! מצאתם אותי! אני ${name}, ${HAMISPAR} ${num}! אני ${vg(g, 'נהנה', 'נהנית')} ${like} כל היום!`,
  (name, num, like, g, invite) => `שלום שלום! ${name} כאן, ${HAMISPAR} ${num}! אני ${vg(g, 'אוהב', 'אוהבת')} ${like}, ${invite}!`,
  (name, num, like, g, invite) => `הנה אני, ${name}! ${HAMISPAR} ${num}! יותר מכל אני ${vg(g, 'אוהב', 'אוהבת')} ${like}! ${invite}?`,
]

const ONES = ['', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע']
// teens with niqqud so the voices say them cleanly (e.g. 12 "שְׁתֵּים", 16 "שֵׁשׁ")
const TEENS = ['עֶשֶׂר', 'אַחַת עֶשְׂרֵה', 'שְׁתֵּים עֶשְׂרֵה', 'שְׁלוֹשׁ עֶשְׂרֵה', 'אַרְבַּע עֶשְׂרֵה', 'חֲמֵשׁ עֶשְׂרֵה', 'שֵׁשׁ עֶשְׂרֵה', 'שְׁבַע עֶשְׂרֵה', 'שְׁמוֹנֶה עֶשְׂרֵה', 'תְּשַׁע עֶשְׂרֵה']
const TENS = { 20: 'עשרים', 30: 'שלושים', 40: 'ארבעים', 50: 'חמישים', 60: 'שישים', 70: 'שבעים', 80: 'שמונים', 90: 'תשעים', 100: 'מאה' }
function numWord(n) {
  if (n <= 9) return ONES[n]
  if (n <= 19) return TEENS[n - 10]
  const t = n - (n % 10)
  const u = n % 10
  if (TENS[t]) return u === 0 ? TENS[t] : `${TENS[t]} ו${ONES[u]}`
  return String(n)
}

const COUNT = 100 // friends / numbers covered
const lines = []
for (let k = 1; k <= COUNT; k++) lines.push({ id: `num-${k}`, text: numWord(k), voice: voiceFor(k - 1) })
// Most friends' intro "I love X / let's X" follows their position; override when
// a friend's special activity differs (e.g. Gugu → drawing instead of hugging).
const INTRO_LIKE = {
  3: 8, 5: 6, 6: 12, 8: 13, 10: 14,
  // batch 2 (friends 12–20 → new LIKES indices 15–23)
  11: 15, 12: 16, 13: 17, 14: 18, 15: 19, 16: 20, 17: 21, 18: 22, 19: 23,
}
// Per-friend intro override — when the templated "I enjoy X all day" doesn't fit
// the activity, write a custom intro here (keeps name + number + an invite).
const INTRO_TEXT = {
  // 13 מומו — "I have a really good memory" (no "wow" — that read badly for him)
  12: `מצאתם אותי! אני ${nameToken(12)}, ${HAMISPAR} ${numWord(13)}! יש לי זכרון ממש טוב!`,
  // 14 ריקי — likes things tidy in a pattern (was a repetitive "play with patterns")
  13: `שלום! אני ${nameToken(13)}, ${HAMISPAR} ${numWord(14)}! אני אוהב שהכל מסודר בתבנית!`,
}
for (let i = 0; i < COUNT; i++) {
  const li = INTRO_LIKE[i] ?? i
  const intro = INTRO_TEXT[i] ?? TEMPLATES[i % TEMPLATES.length](nameToken(i), numWord(i + 1), LIKES[li % LIKES.length], genderOf(i), INVITE[li % INVITE.length])
  lines.push({ id: `intro-${i}`, text: intro, voice: voiceFor(i) })
}
// per-friend "special" button lines, in the friend's own voice
for (const [i, phrases] of Object.entries(SPECIAL)) {
  phrases.forEach((text, n) => lines.push({ id: `special-${i}-${n}`, text, voice: voiceFor(Number(i)) }))
}
// per-friend spoken facts, one per difficulty level, in the friend's own voice
for (const [i, byLevel] of Object.entries(FACTS)) {
  byLevel.forEach((text, lvl) => lines.push({ id: `fact-${i}-${lvl}`, text, voice: voiceFor(Number(i)) }))
}
// counting numbers in the friend's OWN voice, so e.g. טוקי counts "1,2" all in
// Erez (not mixed with לולו's Ayelet). num-<k>-<Voice>, for completed friends.
const cnumSeen = new Set()
for (const i of Object.keys(FACTS).map(Number)) {
  const v = voiceFor(i)
  for (let k = 1; k <= i + 1; k++) {
    const id = `num-${k}-${v}`
    if (!cnumSeen.has(id)) {
      cnumSeen.add(id)
      lines.push({ id, text: numWord(k), voice: v })
    }
  }
}
// knock-knock jokes for the laugh game (one clip per line so the game can pace
// them), in Bobby's voice (friend 3)
JOKES.forEach((arr, j) => arr.forEach((text, n) => lines.push({ id: `joke-${j}-${n}`, text, voice: voiceFor(2) })))
// Rhyme Machine — name each word in both languages, in this family's voice. The
// English word is written in ENGLISH (Latin) so the voice pronounces it properly
// (the Hebrew transliteration read wrong, e.g. "bat"); the translation in Hebrew.
// A few short words read better via the Hebrew transliteration than as Latin.
const RHYME_USE_TRANSLIT = new Set(['LOG', 'MAP'])
for (const fam of RHYME_FAMILIES) for (const [word, translit, hebrew] of fam.words) {
  const eng = RHYME_USE_TRANSLIT.has(word) ? translit : word.toLowerCase()
  lines.push({ id: `rhyme-${word}`, text: `${eng}, באנגלית. ${hebrew}, בעברית.`, voice: fam.voice })
}
// shared buttons recorded in every chosen voice → fx-five-Ayelet, fx-hug-Erez, …
const ALL_VOICES = [...FEMALE_VOICES, ...MALE_VOICES]
for (const v of ALL_VOICES) for (const b of SHARED) lines.push({ id: `${b.id}-${v}`, text: b.text, voice: v })
// legacy single-voice fallbacks (used until the app picks the per-voice variant)
for (let i = 0; i < LIKE_FX.length; i++) lines.push({ id: `like-${i}`, text: LIKE_FX[i] })
for (const b of SHARED) lines.push({ id: b.id, text: b.text })

// selection -----------------------------------------------------------------
// friend number for friend-indexed ids (num/intro/special); null = an "extra".
const friendOf = (id) => {
  let m = id.match(/^(num|intro)-(\d+)$/)
  if (m) return m[1] === 'num' ? Number(m[2]) : Number(m[2]) + 1
  m = id.match(/^(special|fact)-(\d+)-\d+$/)
  if (m) return Number(m[2]) + 1
  return null
}
// clip kind, for KINDS filtering
const kindOf = (id) =>
  /^num-\d+-/.test(id) ? 'cnum' // num-<k>-<Voice> (counting in a friend's voice)
    : /^num-/.test(id) ? 'num'
    : /^intro-/.test(id) ? 'intro'
      : /^special-/.test(id) ? 'special'
        : /^joke-/.test(id) ? 'joke'
        : /^rhyme-/.test(id) ? 'rhyme'
        : /^laugh-/.test(id) ? 'laugh'
        : /^fact-/.test(id) ? 'fact'
          : /^fx-\w+-/.test(id) ? 'shared'
          : /^fx-/.test(id) ? 'fx'
            : /^like-/.test(id) ? 'like'
              : 'other'
const KINDS = (process.env.KINDS || '').split(',').map((s) => s.trim()).filter(Boolean) // empty = all
const extrasOn = TO >= COUNT || process.env.EXTRAS === '1'
// ONLY=intro-0,fx-five → regenerate just those exact ids (cheapest QA re-run).
const ONLY = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean)
// SAMPLE=1 → one demo clip per Hebrew voice (sample-<voice>.mp3) to audition them.
const SAMPLE_VOICES = [...FEMALE_VOICES, ...MALE_VOICES]
const selected = process.env.SAMPLE
  ? SAMPLE_VOICES.map((v) => ({ id: `sample-${v}`, text: `שלום! אני ${HAMISPAR} חמש! בואו לשחק יחד!`, voice: v }))
  : lines.filter((l) => {
      // ONLY_VOICE=Ayelet → regenerate every clip in that voice (e.g. after a
      // per-voice speed change), regardless of friend/kind.
      if (process.env.ONLY_VOICE) return l.voice === process.env.ONLY_VOICE
      if (KINDS.length && !KINDS.includes(kindOf(l.id))) return false
      if (ONLY.length) return ONLY.includes(l.id)
      const f = friendOf(l.id)
      if (f === null) return KINDS.length ? true : extrasOn // non-friend kinds: include when their kind is requested
      return f >= FROM && f <= TO
    })

// DRY_RUN=1 prints every line's text (to eyeball pronunciation) and exits — no API calls.
if (process.env.DRY_RUN) {
  for (const l of selected) console.log(`${l.id}\t${l.text}`)
  process.exit(0)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const OUT = `public/voice/${LANG}`
mkdirSync(OUT, { recursive: true })

// MANIFEST=1 → write id→{text,voice} for ALL clips (no API calls) so the QA page
// (public/voicetest.html) always shows the real recorded text. Then exit.
if (process.env.MANIFEST) {
  const man = lines.map((l) => ({ id: l.id, text: l.text, voice: l.voice || '' }))
  writeFileSync(`${OUT}/manifest.json`, JSON.stringify(man))
  console.log(`manifest: ${man.length} clips → ${OUT}/manifest.json`)
  process.exit(0)
}

let synth
if (PROVIDER === 'edge') {
  // Microsoft Edge neural voices — natural, free, no key.
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts')
  const VOICE = process.env.EDGE_VOICE || (LANG === 'he' ? 'he-IL-HilaNeural' : 'en-US-AvaNeural')
  // A touch higher + a touch faster = lively/energetic, not robotic (for a kid).
  const PROSODY = { pitch: process.env.EDGE_PITCH || '+12%', rate: process.env.EDGE_RATE || '+6%' }
  console.log(`ספק: Edge Neural (חינם, בלי מפתח) · קול ${VOICE} · pitch ${PROSODY.pitch} rate ${PROSODY.rate} · שפה ${LANG} · ${selected.length} קליפים`)
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
        tts = await connect() // reconnect and retry once
      }
    }
    throw lastErr
  }
} else if (PROVIDER === 'narakeet') {
  // Narakeet — native Israeli-accent Hebrew voices, paid (cheap, one-time).
  // Pick the voice she liked: Ayelet / Tamar / Nurit / Hadas / Yael (female),
  // Lior / Erez / Doron / Oren (male). Speed + (optional) niqqud stripping.
  const KEY = process.env.NARAKEET_API_KEY
  if (!KEY) throw new Error('צריך NARAKEET_API_KEY (מההגדרות של חשבון Narakeet)')
  const VOICE = process.env.NARAKEET_VOICE || (LANG === 'he' ? 'Ayelet' : 'Brian') // default / fallback
  const NSPEED = process.env.VOICE_SPEED || '1.0' // natural pace — livelier than a slow read
  // per-voice speed tweaks — Ayelet read a bit slowly, so nudge her faster
  const SPEED_BY_VOICE = { Ayelet: '1.12' }
  // Niqqud helps these voices say מִימִי / נִשְׂחַק / הַמִּסְפָּר correctly, so KEEP it
  // by default; strip only if a future test shows a voice prefers plain text.
  const stripNiq = (s) => s.replace(/[֑-ׇ]/g, '')
  const dropNiq = process.env.STRIP_NIQQUD === '1'
  console.log(`ספק: Narakeet · קולות לפי מגדר (ברירת מחדל ${VOICE}) · speed ${NSPEED} · ניקוד ${dropNiq ? 'מוסר' : 'נשמר'} · שפה ${LANG} · ${selected.length} קליפים`)
  synth = async (text, voiceName) => {
    const body = dropNiq ? stripNiq(text) : text
    const spd = SPEED_BY_VOICE[voiceName || VOICE] || NSPEED
    const url = `https://api.narakeet.com/text-to-speech/mp3?voice=${encodeURIComponent(voiceName || VOICE)}&voice-speed=${spd}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'content-type': 'text/plain', accept: 'application/octet-stream' },
      body: Buffer.from(body, 'utf-8'),
    })
    if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => '')}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 800) throw new Error('empty')
    return buf
  }
} else if (PROVIDER === 'gtx') {
  console.log(`ספק: Google Translate (חינם, בלי מפתח) · ${selected.length} קליפים`)
  synth = async (text) => {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=he&client=tw-ob&total=1&idx=0&textlen=${text.length}`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) throw new Error(`${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 800) throw new Error('clip too small')
    return buf
  }
} else if (PROVIDER === 'azure') {
  // Microsoft Azure Neural TTS — natural Hebrew (Hila/Avri) + English. Free tier
  // 500K chars/month. Needs an Azure Speech resource: key + region.
  //   $env:VOICE_PROVIDER="azure"; $env:AZURE_TTS_KEY="KEY"; $env:AZURE_TTS_REGION="westeurope"; node scripts/gen-voice.mjs
  const KEY = process.env.AZURE_TTS_KEY
  const REGION = process.env.AZURE_TTS_REGION
  if (!KEY || !REGION) throw new Error('חסר AZURE_TTS_KEY / AZURE_TTS_REGION')
  const VOICE = process.env.AZURE_TTS_VOICE || (LANG === 'he' ? 'he-IL-HilaNeural' : 'en-US-JennyNeural')
  const XML_LANG = LANG === 'he' ? 'he-IL' : 'en-US'
  const rate = `${Math.round((SPEED - 1) * 100)}%`
  console.log(`ספק: Azure Neural · קול ${VOICE} · שפה ${LANG}`)
  synth = async (text) => {
    const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const ssml = `<speak version='1.0' xml:lang='${XML_LANG}'><voice name='${VOICE}'><prosody rate='${rate}'>${esc}</prosody></voice></speak>`
    const res = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      },
      body: ssml,
    })
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
    return Buffer.from(await res.arrayBuffer())
  }
} else if (PROVIDER === 'google') {
  const KEY = process.env.GOOGLE_TTS_KEY
  const VOICE = process.env.GOOGLE_TTS_VOICE || 'he-IL-Wavenet-C'
  if (!KEY) throw new Error('חסר GOOGLE_TTS_KEY')
  console.log(`ספק: Google Cloud TTS · קול ${VOICE}`)
  synth = async (text) => {
    const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { text }, voice: { languageCode: 'he-IL', name: VOICE }, audioConfig: { audioEncoding: 'MP3', speakingRate: SPEED } }),
    })
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
    return Buffer.from((await res.json()).audioContent, 'base64')
  }
} else {
  throw new Error(`ספק לא מוכר: ${PROVIDER}`)
}

let ok = 0
for (const l of selected) {
  let done = false
  for (let attempt = 0; attempt < 4 && !done; attempt++) {
    try {
      writeFileSync(`${OUT}/${l.id}.mp3`, await synth(l.text, l.voice))
      ok++
      done = true
      if (ok % 10 === 0 || ok === selected.length) console.log(`  …${ok}/${selected.length}`)
    } catch (e) {
      const code = String(e.message)
      if ((code.includes('429') || code.includes('too small')) && attempt < 3) {
        await sleep(4000 * (attempt + 1))
      } else {
        console.error(`❌ ${l.id}: ${e.message}`)
        done = true
      }
    }
  }
  await sleep(DELAY)
}
console.log(`\nנוצרו ${ok}/${selected.length} קליפים ב-public/voice/`)
