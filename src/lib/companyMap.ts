export const mapSectors = [['technology','기술'],['communication','커뮤니케이션'],['consumer','경기소비재'],['financial','금융'],['healthcare','헬스케어'],['energy','에너지'],['defensive','필수소비재'],['industrial','산업재'],['materials','소재'],['realestate','부동산'],['utilities','유틸리티'],['unknown','미분류']] as const
export type MapCompany = { symbol: string; name: string; sector: string; marketCap: number; changePercent: number | null; quoteAt: string }
export type CompanyMapData = { version: number; companies: MapCompany[]; fetchedAt: string; stale: boolean; sourceError?: boolean; sourceCount: number; excluded: number; classificationAt: string }
export function validCompanyMap(value: unknown): value is CompanyMapData {
  const d = value as CompanyMapData | null
  return !!d && d.version === 1 && Array.isArray(d.companies) && d.companies.length > 0 && d.companies.length <= 100 && Number.isFinite(Date.parse(d.fetchedAt))
    && typeof d.stale === 'boolean' && Number.isInteger(d.sourceCount) && d.sourceCount >= d.companies.length && d.sourceCount <= 100
    && new Set(d.companies.map(c=>c.symbol)).size === d.companies.length
    && d.companies.every(c=> /^[A-Z][A-Z0-9]{0,5}(?:-[AB])?$/.test(c.symbol) && typeof c.name === 'string' && c.name.length > 0 && c.name.length <= 200 && mapSectors.some(([id])=>id===c.sector)
      && Number.isFinite(c.marketCap) && c.marketCap > 0 && (c.changePercent === null || Number.isFinite(c.changePercent)) && Number.isFinite(Date.parse(c.quoteAt)))
}
export const mapChange = (v: number | null) => v === null ? '등락률 미제공' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`
export const mapCap = (v: number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(v)
export const mapTime = (v: string) => new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(v))+' KST'
export type MapRect = { company: MapCompany; x: number; y: number; width: number; height: number }
// Balanced binary treemap: each rectangle's area is exactly proportional to its cap.
export function marketMapLayout(companies: MapCompany[], width: number, height: number): MapRect[] {
  if (!companies.length || width <= 0 || height <= 0) return []
  const rows = [...companies].sort((a,b)=>b.marketCap-a.marketCap || a.symbol.localeCompare(b.symbol))
  const output: MapRect[] = []
  function split(items: MapCompany[], x: number,y: number,w: number,h: number) {
    if (items.length===1) { output.push({company:items[0],x,y,width:w,height:h}); return }
    const sum=items.reduce((n,c)=>n+c.marketCap,0)
    let best=1, partial=items[0].marketCap
    for (let i=1, running=partial;i<items.length-1;i++) { running+=items[i].marketCap; if (Math.abs(running-sum/2)<Math.abs(partial-sum/2)) { best=i+1; partial=running } }
    const ratio=partial/sum
    if (w>=h) { split(items.slice(0,best),x,y,w*ratio,h); split(items.slice(best),x+w*ratio,y,w*(1-ratio),h) }
    else { split(items.slice(0,best),x,y,w,h*ratio); split(items.slice(best),x,y+h*ratio,w,h*(1-ratio)) }
  }
  split(rows,0,0,width,height); return output
}
