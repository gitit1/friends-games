// The set of languages the app supports. Add one here + a dictionary + clips.
export type Lang = 'he' | 'en'
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'he', label: 'עברית' },
  { id: 'en', label: 'English' },
]

// One string. `say` (optional) is what's READ ALOUD — for Hebrew it carries
// niqqud so TTS pronounces it right; if absent we read `text`.
export type Entry = { text: string; say?: string }
export type Dict = Record<string, Entry>
