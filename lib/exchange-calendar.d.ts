export interface ExchangeSession { date: string; open: string; close: string; earlyClose: boolean }
export interface ExchangeInfo { calendar: string; timezone: string; from: string; to: string; reviewedAt: string; generatedAt: string; packageVersion: string; url: string }
export type ExchangeDay = ({ state: 'session' } & ExchangeSession) | { date: string; state: 'holiday' | 'weekend' | 'unavailable' }
export interface ExchangeStatus { state: 'before-open' | 'open' | 'after-close' | 'holiday' | 'weekend' | 'unavailable'; session: ExchangeSession | null; nextSession: ExchangeSession | null }
export interface ExchangeEvent { id: string; date: string; category: 'Market'; title: string; startAt: string | null; allDay: boolean; session: null; major: boolean; estimated: boolean; source: string; sourceUrl: string; description: string }
export interface ExchangeCalendar { info: ExchangeInfo | null; day(date: string): ExchangeDay; status(now?: number): ExchangeStatus; datesThrough(date: string, lookbackDays?: number): string[]; events(from: string, to: string): ExchangeEvent[] | null }
export function validateExchangeCalendar(value: unknown, expected?: unknown): boolean
export function createExchangeCalendar(value: unknown, expected?: unknown): ExchangeCalendar
export const exchangeCalendar: ExchangeCalendar
