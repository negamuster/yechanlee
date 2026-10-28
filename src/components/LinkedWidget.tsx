import type { ComponentPropsWithoutRef, MouseEvent } from 'react'
import { widgetActivation, widgetControls } from '../lib/widgetNavigation'
import { Card } from './ui/Card'
import './LinkedWidget.css'

export default function LinkedWidget({ className = '', children, ...props }: ComponentPropsWithoutRef<'div'>) {
  function activate(event: MouseEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target : null
    const control = target?.closest(widgetControls)
    const action = widgetActivation(event, Boolean(control && control !== event.currentTarget), window.getSelection()?.toString() || '')
    const link = event.currentTarget.querySelector<HTMLAnchorElement>('a[data-widget-link]')
    if (!action || !link) return
    event.preventDefault()
    if (action === 'new-tab') window.open(link.href, '_blank', 'noopener,noreferrer')
    else link.click()
  }
  return <Card {...props} className={`${className} linked-widget`} onClick={activate} onAuxClick={activate}>{children}</Card>
}
