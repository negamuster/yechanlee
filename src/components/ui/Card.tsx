// Adapted from shadcn/ui (MIT), revision 96da9cc7f1aa10580a3741664e2a77c721206c00.
// Uses Anthracite CSS tokens; see public/licenses/shadcn-ui-LICENSE.txt.
import type { ComponentProps } from 'react'
import './primitives.css'

export function Card({ className = '', ...props }: ComponentProps<'div'>) {
  return <div data-slot="card" className={`ui-card ${className}`} {...props} />
}
