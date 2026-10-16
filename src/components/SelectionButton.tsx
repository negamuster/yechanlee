import type { ButtonHTMLAttributes } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import './SelectionButton.css'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean; selectionId: string }

export default function SelectionButton({ selected, selectionId, children, className = '', ...props }: Props) {
  const reduced = useReducedMotion()
  return <button {...props} type="button" className={`ui-selection-button ${className}`}
    aria-pressed={props['aria-expanded'] === undefined ? selected : undefined}>
    {selected && <motion.span className="ui-selection-highlight" aria-hidden="true" layoutId={selectionId}
      initial={false} transition={{ duration: reduced ? 0 : 0.18, ease: 'easeOut' }} />}
    <span className="ui-selection-label">{children}</span>
  </button>
}
