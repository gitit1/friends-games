// The order of the day, shown as pictures. Teaches sequence ("what comes next").
// Parents can reorder / edit this list later; the game adapts to its length.

export type RoutineStep = {
  emoji: string
  label: string
  say: string // spoken sentence
}

export const ROUTINE: RoutineStep[] = [
  { emoji: '☀️', label: 'בוקר טוב', say: 'בוקר טוב! קמים מהמיטה' },
  { emoji: '🚽', label: 'שירותים', say: 'הולכים לשירותים' },
  { emoji: '🪥', label: 'מצחצחים שיניים', say: 'מצחצחים שיניים' },
  { emoji: '🥣', label: 'ארוחת בוקר', say: 'אוכלים ארוחת בוקר' },
  { emoji: '👕', label: 'מתלבשים', say: 'מתלבשים' },
  { emoji: '🎒', label: 'הולכים לגן', say: 'הולכים לגן' },
  { emoji: '🧩', label: 'משחקים בגן', say: 'משחקים ולומדים בגן' },
  { emoji: '🍽️', label: 'ארוחת צהריים', say: 'אוכלים ארוחת צהריים' },
  { emoji: '🏠', label: 'חוזרים הביתה', say: 'חוזרים הביתה' },
  { emoji: '🧸', label: 'משחק ומנוחה', say: 'משחקים ונחים' },
  { emoji: '🛁', label: 'אמבטיה', say: 'מתקלחים באמבטיה' },
  { emoji: '📖', label: 'סיפור', say: 'קוראים סיפור' },
  { emoji: '🌙', label: 'לילה טוב', say: 'הולכים לישון. לילה טוב!' },
]
