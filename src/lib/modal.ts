// Native modal dialogs provide top-layer rendering and make the rest of the page inert.
// Keep scroll locking and restoration paired, including on route changes and unmount.
export function presentModal(dialog: HTMLDialogElement) {
  const page = dialog.ownerDocument
  const previousFocus = page.activeElement as HTMLElement | null
  const elements = [page.documentElement, page.body]
  const properties = ['overflow-x', 'overflow-y']
  const previousStyles = elements.map(element => properties.map(property => ({
    property, value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property),
  })))
  dialog.showModal()
  elements.forEach(element => properties.forEach(property => element.style.setProperty(property, 'hidden')))
  let released = false
  return () => {
    if (released) return
    released = true
    if (dialog.open) dialog.close()
    elements.forEach((element, index) => {
      previousStyles[index].forEach(style => {
        if (style.value) element.style.setProperty(style.property, style.value, style.priority)
        else element.style.removeProperty(style.property)
      })
    })
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
  }
}

export function outsideDialog(point: { clientX: number; clientY: number }, rect: { left: number; right: number; top: number; bottom: number }) {
  return point.clientX < rect.left || point.clientX > rect.right || point.clientY < rect.top || point.clientY > rect.bottom
}
