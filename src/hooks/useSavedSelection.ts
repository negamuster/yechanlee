import { useState } from 'react'
import { useSavedItems } from '../components/SavedItemsProvider'
export function useSavedSelection(kind: 'stocks' | 'articles', ids: string[]) {
  const { removeSelected } = useSavedItems()
  const [picked, setPicked] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState('')
  const selected = picked.filter(id => ids.includes(id))
  function toggle(id: string) { setConfirming(false); setNotice(''); setPicked(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]) }
  function selectVisible(visible: string[]) { setConfirming(false); setNotice(''); setPicked(current => [...new Set([...current, ...visible])]) }
  function clear() { setPicked([]); setConfirming(false); setNotice('') }
  function remove() { if (removeSelected(kind, selected)) { setNotice(`${selected.length}개 항목을 삭제했습니다.`); setPicked([]); setConfirming(false) } }
  return { selected, confirming, notice, toggle, selectVisible, clear, remove, confirm: () => setConfirming(true), cancel: () => setConfirming(false) }
}
