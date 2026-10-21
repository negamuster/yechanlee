export type Quote = { symbol: string; label: string; price: number | null; changePercent: number | null; asOf: string | null; unit: string; status: string }
export type MarketData = { quotes: Quote[]; fetchedAt: number }
export function validMarketData(value: unknown): value is MarketData {
  const data = value as MarketData | null
  return !!data && Number.isFinite(data.fetchedAt) && Array.isArray(data.quotes) && data.quotes.length > 0
    && data.quotes.every(quote => quote && typeof quote.symbol === 'string' && typeof quote.label === 'string' && typeof quote.unit === 'string'
      && (quote.price === null || Number.isFinite(quote.price)) && (quote.changePercent === null || Number.isFinite(quote.changePercent))
      && (quote.asOf === null || typeof quote.asOf === 'string' && Number.isFinite(Date.parse(quote.asOf))))
    && data.quotes.some(quote => quote.price !== null)
}
