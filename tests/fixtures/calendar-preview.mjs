export const now = Date.parse('2026-10-15T11:31:00Z')
export const event = (id, extra = {}) => ({ id, title: 'Consumer Price Index', category: 'Economic', date: '2026-10-15', startAt: '2026-10-15T12:30:00Z', session: null, major: true, source: 'BLS', sourceUrl: 'https://www.bls.gov/schedule/', estimated: false, ...extra })
export const source = (extra = {}) => ({ name: 'BLS', date: null, state: 'ok', updatedAt: '2026-10-15T10:00:00Z', url: 'https://www.bls.gov/schedule/', ...extra })
export const data = (events = [], sources = [source()]) => ({ events, sources, fetchedAt: '2026-10-15T11:00:00Z' })
