// Bilingual speech for the reaction engine. Kept SEPARATE from the rule logic.
// The engine returns a logical `speechKey`; the UI calls pickMessage(key, lang)
// to get a short, natural, child-friendly line (he RTL / en LTR). Several
// variants per key so the pet doesn't repeat itself.
type Lang = 'he' | 'en'
type MsgSet = { he: string[]; en: string[] }

export const MESSAGES: Record<string, MsgSet> = {
  // ── FEED ──
  'feed.strong': {
    he: ['וואו, הייתי ממש רעב!', 'יאמי! זה בדיוק מה שהייתי צריך.', 'סוף סוף אוכל!', 'הבטן שלי כל כך שמחה עכשיו.'],
    en: ['Wow, I was really hungry!', 'Yum! That was exactly what I needed.', 'Finally, food!', 'My tummy feels so happy now.'],
  },
  'feed.normal': {
    he: ['יאמי! תודה.', 'מ-מ-מ, טעים!', 'תודה! היה לי טעים.', 'אוכל זה כיף.'],
    en: ['Yum! Thank you.', 'Mmm, tasty!', 'Thank you! That was delicious.', 'Eating is the best.'],
  },
  'feed.full': {
    he: ['אני כבר שבע, אולי נשחק?', 'תודה, אבל הבטן מלאה.', 'אני לא רעב עכשיו.'],
    en: ["I'm already full. Maybe we can play?", "Thanks, but I'm stuffed.", "I'm not hungry right now."],
  },
  'feed.lowmood': {
    he: ['תודה… זה עזר קצת.', 'אכלתי, אבל אני עדיין קצת עצוב.'],
    en: ['Thank you… that helped a little.', "I ate, but I'm still a bit sad."],
  },
  'feed.repeat': {
    he: ['עוד פעם? אפשר משהו אחר?', 'אכלתי כבר הרבה… נסה משהו אחר?'],
    en: ['Again? Can we try something different?', "I've eaten a lot… something else?"],
  },

  // ── DRINK ──
  'drink.strong': { he: ['הייתי ממש צמא!', 'אוף, איזה צמא הייתי!'], en: ['I really needed water!', 'I was so thirsty!'] },
  'drink.normal': { he: ['תודה! זה היה מרענן.', 'אהה, מים זה טוב.'], en: ['Thank you! That was refreshing.', 'Ahh, water is good.'] },
  'drink.full': { he: ['אני לא צמא עכשיו.', 'שתיתי מספיק, תודה.'], en: ["I'm not thirsty right now.", "I've had enough, thanks."] },
  'drink.afterplay': { he: ['מים אחרי משחק זה הכי כיף!', 'בדיוק מה שהייתי צריך אחרי המשחק.'], en: ['Water after playing feels great!', 'Just what I needed after playing.'] },

  // ── PLAY ──
  'play.bored': { he: ['יש! חיכיתי לשחק!', 'סוף סוף! בוא נשחק!', 'כל כך השתעממתי, יאללה!'], en: ['Yes! I was waiting to play!', 'Finally, let’s play!', 'I was so bored, yay!'] },
  'play.normal': { he: ['זה היה כיף!', 'אני אוהב לשחק איתך.', 'עוד! עוד!'], en: ['That was fun!', 'I love playing with you.', 'Again! Again!'] },
  'play.tired': { he: ['אני רוצה לשחק, אבל ממש עייף.', 'קצת עייף… אולי לישון רגע?'], en: ["I want to play, but I'm really sleepy.", "I'm tired… maybe a little nap?"] },
  'play.lowmood': { he: ['זה היה נחמד… אני מרגיש קצת יותר טוב.', 'תודה, זה עזר קצת.'], en: ['That was nice… I feel a little better.', 'Thanks, that helped a bit.'] },
  'play.repeat': { he: ['עוד פעם! עוד פעם!', 'שוב? כיף!'], en: ['Again! Again!', 'Again? Yay!'] },

  // ── CLEAN / BATH ──
  'clean.strong': { he: ['אהה, הרבה יותר טוב!', 'איזה כיף, עכשיו אני נקי!', 'בועות! בועות!'], en: ['Ahh, much better!', "Yay, I'm clean now!", 'Bubbles! Bubbles!'] },
  'clean.normal': { he: ['עכשיו אני נקי!', 'הרבה יותר טוב.'], en: ["I'm clean now!", 'Much better.'] },
  'clean.full': { he: ['אבל אני כבר נקי!', 'לא צריך, אני נקי לגמרי.'], en: ["But I'm already clean!", "No need, I'm spotless."] },

  // ── SLEEP / REST ──
  'sleep.tired': { he: ['לילה טוב… תישאר קרוב.', 'אני ממש עייף… נחמד לנוח.'], en: ['Good night… stay close.', "I'm so sleepy… time to rest."] },
  'sleep.medium': { he: ['קצת מנוחה זה נעים.', 'אשכב רגע לנמנם.'], en: ['A little rest sounds nice.', "I'll nap for a bit."] },
  'sleep.energetic': { he: ['אני עוד לא עייף!', 'בא לי לשחק, לא לישון.'], en: ["I'm not sleepy yet.", 'I want to play, not sleep.'] },
  'sleep.lonely': { he: ['אפשר להישאר עד שאירדם?', 'אל תלך… תישאר איתי.'], en: ['Can you stay until I fall asleep?', "Don't go… stay with me."] },
  'sleep.wake': { he: ['בוקר טוב! אני מרגיש הרבה יותר טוב.', 'ישנתי נהדר! יש לי כוח עכשיו!'], en: ['Good morning! I feel much better.', 'That was a great nap! I have energy now!'] },

  // ── WALK ──
  'walk.go': { he: ['איזה כיף בחוץ!', 'בוא נצא להרפתקה קטנה!', 'אני אוהב לטייל איתך.'], en: ['It’s so nice outside!', 'Let’s go on a tiny adventure!', 'I love walking with you.'] },
  'walk.tired': { he: ['אולי אחרי מנוחה?', 'אני עייף… אולי נשב רגע.'], en: ['Maybe after a nap?', "I'm tired… let's rest first."] },
  'walk.after': { he: ['היה כיף! חזרתי קצת מלוכלך.', 'איזה טיול! אני צריך מקלחת קטנה.'], en: ['That was fun! I got a little messy.', 'What a walk! I need a little bath.'] },

  // ── POTTY ──
  'potty.go': { he: ['אוף, הרבה יותר טוב.', 'הצלחתי!'], en: ['Much better.', 'I did it!'] },
  'potty.no': { he: ['אני לא צריך עכשיו.', 'לא צריך, תודה.'], en: ["I don't need to go right now.", "I'm fine, thanks."] },

  // ── DRESS UP ──
  'dress.shy': { he: ['אני נראה בסדר?', 'זה… נחמד עליי?'], en: ['Do I look okay?', 'Is this… nice on me?'] },
  'dress.dramatic': { he: ['וואו, אני נראה מדהים!', 'אני הכי יפה בעולם!'], en: ['Wow, I look amazing!', "I'm the prettiest in the world!"] },
  'dress.playful': { he: ['אפשר משהו מצחיק?', 'נשים משהו מצחיק!'], en: ['Can I wear something funny?', "Let's pick something silly!"] },
  'dress.calm': { he: ['זה נעים לי.', 'נוח ונחמד.'], en: ['This feels cozy.', 'Comfy and nice.'] },
  'dress.normal': { he: ['איך אני נראה?', 'זה ממש חמוד עליי.'], en: ['How do I look?', 'This looks so cute on me.'] },

  // ── HUG / ATTENTION ──
  'hug.lonely': { he: ['היה לי צורך בזה.', 'התגעגעתי אליך!'], en: ['I needed that.', 'I missed you!'] },
  'hug.happy': { he: ['זה נעים!', 'אני אוהב חיבוקים.'], en: ['That feels nice!', 'I love hugs.'] },
  'hug.shy': { he: ['זה היה מתוק…', 'אווו… תודה.'], en: ['That was sweet…', 'Aww… thank you.'] },
  'hug.repeat': { he: ['יש לך את החיבוקים הכי טובים.', 'עוד חיבוק? כן!'], en: ['You give the best hugs.', 'Another hug? Yes!'] },

  // ── cross-cutting ──
  'generic.missed': { he: ['התגעגעתי אליך!', 'חזרת! כל כך שמחתי.'], en: ['I missed you!', "You're back! I'm so happy."] },
  'generic.remembers': { he: ['אתה תמיד זוכר אותי.', 'אתה מטפל בי הכי טוב.'], en: ['You always remember me.', 'You take the best care of me.'] },

  // ── IDLE ──
  'idle.bored': { he: ['קצת משעמם לי.', 'אני מתגעגע לשחק.'], en: ["I'm a little bored.", 'I miss playing.'] },
  'idle.lonely': { he: ['היי… אתה עדיין כאן?', 'אני צריך חיבוק קטן.'], en: ['Hey… are you still here?', 'I need a tiny hug.'] },
  'idle.hungry': { he: ['אני קצת רעב…', 'אפשר משהו לאכול?'], en: ["I'm a little hungry…", 'Can I have a snack?'] },
  'idle.thirsty': { he: ['אפשר מים?', 'קצת צמא לי.'], en: ['Can I have some water?', "I'm a bit thirsty."] },
  'idle.sleepy': { he: ['קצת עייף לי…', 'אאוו… בא לי לנמנם.'], en: ['I’m a little sleepy…', 'Yawn… I could nap.'] },
  'idle.happy': { he: ['איזה כיף לי איתך!', 'אני שמח!'], en: ['I’m having fun with you!', 'I feel happy!'] },
}

let rng = Math.random
export function pickMessage(key: string, lang: Lang): string {
  const set = MESSAGES[key]
  if (!set) return ''
  const arr = set[lang]?.length ? set[lang] : set.he
  return arr[Math.floor(rng() * arr.length)]
}
