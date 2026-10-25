import { createContext, useContext } from 'react'
import type { EvidenceSource, EvidenceRole } from '../lib/evidence'
import type { saveThesis } from '../lib/thesis'
import type { SavedItems, SavedStock, SavedArticle } from '../lib/savedItems'
interface SavedContext { connectEvidence: (input: { ticker: string; name: string; source: EvidenceSource; role: EvidenceRole; reason: string }) => string; setEvidenceArchived: (ticker: string, id: string, archived: boolean) => void; saveNote: (input: Parameters<typeof saveThesis>[1]) => string; removeSelected: (kind: 'stocks' | 'articles', ids: string[]) => boolean; mergeBackup: (imported: SavedItems) => void; items: SavedItems; toggleStock: (stock: SavedStock) => void; toggleArticle: (article: SavedArticle) => boolean }
export const SavedItemsContext = createContext<SavedContext | null>(null)
export function useSavedItems() { const value = useContext(SavedItemsContext); if (!value) throw new Error('SavedItemsProvider missing'); return value }
