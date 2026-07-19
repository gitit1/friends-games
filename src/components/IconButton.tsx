import type { ReactNode } from 'react'

// A round, icon-only button shared across games (undo/redo, clear, dice, …).
// Keep all icon controls going through here so they look and behave the same.
type Props = {
  /** The glyph/emoji to show. */
  icon: ReactNode
  /** Accessible label (also the spoken/hover name). */
  label: string
  onClick: () => void
  disabled?: boolean
  /** Highlight the button as the currently-active tool/mode. */
  active?: boolean
}

export default function IconButton({ icon, label, onClick, disabled = false, active = false }: Props) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? 'is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  )
}
