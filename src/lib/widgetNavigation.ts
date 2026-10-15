export interface WidgetClick {
  button: number; defaultPrevented: boolean
  altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean
}
// Let nested controls, scrollable panels and selected text keep their own behavior.
export const widgetControls = 'a, button, input, select, textarea, label, summary, details, iframe, [contenteditable], [role="button"], [role="link"], [tabindex], [data-widget-interactive]'
export function widgetActivation(event: WidgetClick, control: boolean, selectedText: string) {
  if (event.defaultPrevented || control || selectedText.trim() || event.altKey || ![0, 1].includes(event.button)) return null
  return event.button === 1 || event.ctrlKey || event.metaKey || event.shiftKey ? 'new-tab' : 'same-tab'
}
