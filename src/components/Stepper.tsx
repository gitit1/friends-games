import type { ReactNode } from 'react'
import { useT } from '../i18n'

// A shared "◀ label ▶" stepper for browsing between things (e.g. friends).
// The row forces direction:ltr so the arrows always sit on the correct side
// and point the right way, even inside the RTL (Hebrew) layout — the label
// itself stays RTL.
type Props = {
  label: ReactNode
  onPrev: () => void
  onNext: () => void
  prevLabel?: string
  nextLabel?: string
}

export default function Stepper({ label, onPrev, onNext, prevLabel, nextLabel }: Props) {
  const { t } = useT()
  return (
    <div className="stepper">
      <button type="button" className="stepper-arrow" onClick={onPrev} aria-label={prevLabel ?? t('nav.prev')}>
        ◀
      </button>
      <span className="stepper-label">{label}</span>
      <button type="button" className="stepper-arrow" onClick={onNext} aria-label={nextLabel ?? t('nav.next')}>
        ▶
      </button>
    </div>
  )
}
