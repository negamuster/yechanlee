// Adapted from shadcn/ui (MIT), revision 96da9cc7f1aa10580a3741664e2a77c721206c00.
import type { ComponentProps } from 'react'
import './primitives.css'

export function Skeleton({ className = '', ...props }: ComponentProps<'div'>) {
  return <div data-slot="skeleton" className={`ui-skeleton ${className}`} {...props} />
}
