import type { useSavedSelection } from '../hooks/useSavedSelection'
export function SelectionTools({ selection, visible }: { selection: ReturnType<typeof useSavedSelection>; visible: string[] }) {
  return <div className="saved-selection-tools">
    <button type="button" disabled={!visible.length} onClick={() => selection.selectVisible(visible)}>검색 결과 전체 선택</button>
    {!!selection.selected.length && <><span>{selection.selected.length}개 선택 · 숨겨진 항목 포함</span><button type="button" onClick={selection.clear}>선택 해제</button>{!selection.confirming && <button type="button" onClick={selection.confirm}>선택 삭제</button>}</>}
    {selection.confirming && !!selection.selected.length && <div className="saved-delete-confirm" role="group" aria-label="선택 항목 삭제 확인"><span>선택한 {selection.selected.length}개를 삭제할까요?</span><button type="button" onClick={selection.remove}>삭제 확인</button><button type="button" onClick={selection.cancel}>취소</button></div>}
    {selection.notice && <span role="status">{selection.notice}</span>}
  </div>
}
