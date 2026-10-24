import { parseSaved } from './savedItems.ts'
import type { SavedItems } from './savedItems.ts'

export const BACKUP_STATUS_KEY = 'anthracite:backup-status:v1'
export type BackupRequest = { version: 1; requestedAt: string; digest: string | null }
export function readBackupRequest(storage: Pick<Storage, 'getItem'>): BackupRequest | null {
  const raw = storage.getItem(BACKUP_STATUS_KEY)
  if (raw === null) return null
  if (raw.length > 512) throw new Error('Invalid backup request status')
  const value = JSON.parse(raw)
  if (value?.version !== 1 || typeof value.requestedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.requestedAt) || !Number.isFinite(Date.parse(value.requestedAt)) || new Date(value.requestedAt).toISOString() !== value.requestedAt
    || value.digest !== null && (typeof value.digest !== 'string' || !/^[a-f0-9]{64}$/.test(value.digest))) throw new Error('Invalid backup request status')
  return { version: 1, requestedAt: value.requestedAt, digest: value.digest }
}
// Compare precisely the saved export payload, never session-only filters or drafts.
// The status key contains no second copy of personal records.
export async function savedDigest(items: SavedItems): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(parseSaved(JSON.stringify(items))))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')
}
export function backupComparison(request: BackupRequest | null, digest: string | null) {
  return !request ? 'none' : !request.digest || !digest ? 'unknown' : request.digest === digest ? 'same' : 'changed'
}
