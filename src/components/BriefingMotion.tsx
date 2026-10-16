import type { ReactNode } from 'react'
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react'
import './BriefingMotion.css'

export function BriefingDisclosure({ open, id, className, children }: { open: boolean; id?: string; className: string; children: ReactNode }) {
  const reduced = useReducedMotion()
  return <div id={id} className={className} aria-hidden={!open} inert={!open}>
    <AnimatePresence initial={false}>
      {open && <motion.div key="content" className="briefing-disclosure-motion" initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
        transition={{ duration: reduced ? 0 : 0.18, ease: 'easeOut' }}>
        <div className="briefing-disclosure-inner">{children}</div>
      </motion.div>}
    </AnimatePresence>
  </div>
}

function FadingContent({ children }: { children: ReactNode }) {
  const present = useIsPresent()
  const reduced = useReducedMotion()
  return <motion.div aria-hidden={!present} inert={!present} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: reduced ? 0 : 0.09 }}>{children}</motion.div>
}

export function BriefingTransition({ section, children }: { section: string | undefined; children: ReactNode }) {
  return <AnimatePresence initial={false} mode="wait"><FadingContent key={section}>{children}</FadingContent></AnimatePresence>
}
