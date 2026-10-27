import { columnVisibilityFeature, createPaginatedRowModel, createSortedRowModel, rowPaginationFeature, rowSortingFeature, tableFeatures } from '@tanstack/react-table'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { compareHoldingRows } from './form13fPresentation'
import type { HoldingRow, HoldingSortKey } from './form13fPresentation'

export const HOLDING_COLUMNS: { key: HoldingSortKey; label: string }[] = [
  { key: 'name', label: '종목' }, { key: 'pct', label: '비중' }, { key: 'shares', label: '보유 수량' },
  { key: 'value', label: '평가액' }, { key: 'change', label: '수량 변화' },
]
export const DEFAULT_HOLDINGS_SORTING: SortingState = [{ id: 'value', desc: true }]
export const holdingTableFeatures = tableFeatures({
  columnVisibilityFeature, rowSortingFeature, sortedRowModel: createSortedRowModel(),
  rowPaginationFeature, paginatedRowModel: createPaginatedRowModel(),
})

export function holdingTableColumns(sorting: SortingState): ColumnDef<typeof holdingTableFeatures, HoldingRow>[] {
  return HOLDING_COLUMNS.map(({ key, label }) => {
    const desc = sorting.find(sort => sort.id === key)?.desc ?? key !== 'name'
    return {
      id: key, header: label, enableHiding: key !== 'name', sortDescFirst: key !== 'name', sortUndefined: false,
      accessorFn: row => key === 'change' ? row.change.percent : row[key],
      // TanStack reverses descending results. Undo that once for the domain
      // comparator, which keeps new/unknown changes after numbers in either direction.
      sortFn: (a, b) => compareHoldingRows(a.original, b.original, { key, direction: desc ? 'desc' : 'asc' }) * (desc ? -1 : 1),
    }
  })
}
