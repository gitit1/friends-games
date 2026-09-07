// Shared colour palettes for the creative games (colour-a-friend, free draw).
export type Swatch = { color: string; name: string }

// the "more colours" pop-up — 10 hue families × 3 shades + neutrals
export const MORE_COLORS: Swatch[] = [
  { color: '#7f1d1d', name: 'בורדו' }, { color: '#ef4444', name: 'אדום' }, { color: '#fca5a5', name: 'אדום בהיר' },
  { color: '#9a3412', name: 'חום-כתום' }, { color: '#f97316', name: 'כתום' }, { color: '#fdba74', name: 'כתום בהיר' },
  { color: '#854d0e', name: 'חרדל' }, { color: '#facc15', name: 'צהוב' }, { color: '#fef08a', name: 'צהוב בהיר' },
  { color: '#3f6212', name: 'ירוק כהה' }, { color: '#22c55e', name: 'ירוק' }, { color: '#86efac', name: 'ירוק בהיר' },
  { color: '#0f766e', name: 'טורקיז כהה' }, { color: '#14b8a6', name: 'טורקיז' }, { color: '#5eead4', name: 'טורקיז בהיר' },
  { color: '#0c4a6e', name: 'כחול כהה' }, { color: '#3b82f6', name: 'כחול' }, { color: '#93c5fd', name: 'כחול בהיר' },
  { color: '#4c1d95', name: 'סגול כהה' }, { color: '#8b5cf6', name: 'סגול' }, { color: '#c4b5fd', name: 'סגול בהיר' },
  { color: '#9d174d', name: 'ורוד כהה' }, { color: '#ec4899', name: 'ורוד' }, { color: '#f9a8d4', name: 'ורוד בהיר' },
  { color: '#451a03', name: 'חום כהה' }, { color: '#a16207', name: 'חום' }, { color: '#d6a77a', name: 'חום בהיר' },
  { color: '#000000', name: 'שחור' }, { color: '#6b7280', name: 'אפור' }, { color: '#f8fafc', name: 'לבן' },
]
