// Shared English word bank for the English-category games (Spell the Word, First
// Letter, …). One list so the games grow together. Each word has a clear, kid-
// recognisable emoji. Grouped by length into the four difficulty levels.
//
// LEVELS ARE CUMULATIVE (see docs/GAME-RULES.md): a level serves its own words
// AND every easier level below it, so אלוף can draw any word in the game.
export type Word = { word: string; emoji: string }

export const LEVELS: Word[][] = [
  [ // קל — 3 letters
    { word: 'CAT', emoji: '🐱' }, { word: 'DOG', emoji: '🐶' }, { word: 'SUN', emoji: '☀️' },
    { word: 'BUS', emoji: '🚌' }, { word: 'PIG', emoji: '🐷' }, { word: 'COW', emoji: '🐄' },
    { word: 'HAT', emoji: '🎩' }, { word: 'CAR', emoji: '🚗' }, { word: 'BEE', emoji: '🐝' },
    { word: 'FOX', emoji: '🦊' }, { word: 'EGG', emoji: '🥚' }, { word: 'BED', emoji: '🛏️' },
    { word: 'CUP', emoji: '🥤' }, { word: 'HEN', emoji: '🐔' }, { word: 'OWL', emoji: '🦉' },
    { word: 'ANT', emoji: '🐜' }, { word: 'BAT', emoji: '🦇' }, { word: 'BOX', emoji: '📦' },
    { word: 'KEY', emoji: '🔑' }, { word: 'BAG', emoji: '🎒' }, { word: 'MAP', emoji: '🗺️' },
    { word: 'PEN', emoji: '🖊️' }, { word: 'NUT', emoji: '🥜' }, { word: 'BOW', emoji: '🎀' },
    { word: 'JAR', emoji: '🫙' },
  ],
  [ // בינוני — 4 letters
    { word: 'FISH', emoji: '🐟' }, { word: 'FROG', emoji: '🐸' }, { word: 'STAR', emoji: '⭐' },
    { word: 'BEAR', emoji: '🐻' }, { word: 'DUCK', emoji: '🦆' }, { word: 'CAKE', emoji: '🍰' },
    { word: 'MOON', emoji: '🌙' }, { word: 'TREE', emoji: '🌳' }, { word: 'BOAT', emoji: '⛵' },
    { word: 'LION', emoji: '🦁' }, { word: 'MILK', emoji: '🥛' }, { word: 'BIRD', emoji: '🐦' },
    { word: 'SHOE', emoji: '👟' }, { word: 'DOOR', emoji: '🚪' }, { word: 'BALL', emoji: '🏀' },
    { word: 'BOOK', emoji: '📚' }, { word: 'BELL', emoji: '🔔' }, { word: 'KITE', emoji: '🪁' },
    { word: 'DRUM', emoji: '🥁' }, { word: 'RING', emoji: '💍' }, { word: 'LEAF', emoji: '🍃' },
    { word: 'GIFT', emoji: '🎁' }, { word: 'CORN', emoji: '🌽' },
  ],
  [ // קשה — 5 letters
    { word: 'APPLE', emoji: '🍎' }, { word: 'HOUSE', emoji: '🏠' }, { word: 'TIGER', emoji: '🐯' },
    { word: 'TRAIN', emoji: '🚂' }, { word: 'HORSE', emoji: '🐴' }, { word: 'SNAKE', emoji: '🐍' },
    { word: 'MOUSE', emoji: '🐭' }, { word: 'SHEEP', emoji: '🐑' }, { word: 'ZEBRA', emoji: '🦓' },
    { word: 'BREAD', emoji: '🍞' }, { word: 'PIZZA', emoji: '🍕' }, { word: 'PLANE', emoji: '✈️' },
    { word: 'TRUCK', emoji: '🚚' }, { word: 'CLOCK', emoji: '🕐' }, { word: 'CLOUD', emoji: '☁️' },
    { word: 'HEART', emoji: '❤️' }, { word: 'ROBOT', emoji: '🤖' }, { word: 'CANDY', emoji: '🍬' },
    { word: 'LEMON', emoji: '🍋' }, { word: 'WHALE', emoji: '🐳' }, { word: 'PANDA', emoji: '🐼' },
    { word: 'GRAPE', emoji: '🍇' },
  ],
  [ // אלוף — 6–7 letters
    { word: 'BANANA', emoji: '🍌' }, { word: 'FLOWER', emoji: '🌸' }, { word: 'ORANGE', emoji: '🍊' },
    { word: 'ROCKET', emoji: '🚀' }, { word: 'MONKEY', emoji: '🐵' }, { word: 'GUITAR', emoji: '🎸' },
    { word: 'RABBIT', emoji: '🐰' }, { word: 'PARROT', emoji: '🦜' }, { word: 'TURTLE', emoji: '🐢' },
    { word: 'CARROT', emoji: '🥕' }, { word: 'PENCIL', emoji: '✏️' }, { word: 'PENGUIN', emoji: '🐧' },
    { word: 'DRAGON', emoji: '🐉' }, { word: 'CASTLE', emoji: '🏰' }, { word: 'PUMPKIN', emoji: '🎃' },
    { word: 'CAMERA', emoji: '📷' }, { word: 'BALLOON', emoji: '🎈' }, { word: 'DOLPHIN', emoji: '🐬' },
    { word: 'OCTOPUS', emoji: '🐙' }, { word: 'COOKIE', emoji: '🍪' }, { word: 'CACTUS', emoji: '🌵' },
    { word: 'CHEESE', emoji: '🧀' },
  ],
]

export const LEVEL_TIERS = [0, 1, 2, 3] // קל / בינוני / קשה / אלוף on the canonical scale

// CUMULATIVE pools: level i serves its own words + every easier level below it.
// POOLS[0]=קל · POOLS[1]=קל+בינוני · POOLS[2]=...+קשה · POOLS[3]=הכול (אלוף).
export const POOLS: Word[][] = LEVELS.map((_, i) => LEVELS.slice(0, i + 1).flat())

export const pickWord = (lvl: number) => Math.floor(Math.random() * POOLS[lvl].length)
