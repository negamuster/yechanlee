import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { JSDOM } from 'jsdom'
import './helpers/register-tsx.mjs'

// Reproduce an imperative chart emitting transient range changes during setData.
// Native rendering/gestures remain covered by stock-chart-controls browser tests.
const chartSource = "export const LineSeries='line', CandlestickSeries='candles', HistogramSeries='volume'\nexport const ColorType={Solid:0}, CrosshairMode={Normal:0}, TrackingModeExitMode={OnTouchEnd:0}\nexport const created=[]\nexport function createChart() {\n  let listener\n  const chart={range:{from:0,to:31},series:[],removed:false}\n  const scale={\n    subscribeVisibleLogicalRangeChange(fn){listener=fn},\n    setVisibleLogicalRange(value){chart.range={...value};listener?.(value)},\n  }\n  chart.timeScale=()=>scale\n  chart.addSeries=()=>{const series={data:[],applyOptions(){},setData(data){\n    const previous=series.data.length;series.data=data\n    if(previous && previous!==data.length) listener?.({from:chart.range.from+1,to:chart.range.to+1})\n  }};chart.series.push(series);return series}\n  chart.removeSeries=()=>{}\n  chart.panes=()=>[{}, {setHeight(){}}]\n  chart.priceScale=()=>({applyOptions(){}})\n  chart.setCrosshairPosition=()=>{}\n  chart.subscribeCrosshairMove=()=>{}\n  chart.remove=()=>{chart.removed=true}\n  created.push(chart);return chart\n}\n"
registerHooks({
  resolve(specifier, context, next) { return specifier === 'lightweight-charts' ? { url: 'mock:stock-price-chart', shortCircuit: true } : next(specifier, context) },
  load(url, context, next) { return url === 'mock:stock-price-chart' ? { format: 'module', source: chartSource, shortCircuit: true } : next(url, context) },
})
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://anthracite.test/', pretendToBeVisual: true })
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event']) globalThis[key] = dom.window[key]
globalThis.IS_REACT_ACT_ENVIRONMENT = true
window.CanvasRenderingContext2D = function () {}
const { createElement: h, act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { default: StockPriceChart } = await import('../src/components/StockPriceChart.tsx')
const { created } = await import('lightweight-charts')
const container = document.getElementById('root')
after(() => dom.window.close())
const bars = Array.from({ length: 32 }, (_, i) => ({ t: Date.UTC(2026, 8, i + 1), c: 100 + i, o: 100 + i, h: 102 + i, l: 99 + i, v: i }))
const defaults = { bars, currency: 'USD', changePercent: 1, period: '1M', interval: '1d', mode: 'line', onModeChange() {}, volume: false, onVolumeChange() {} }

test('data replacement ignores intermediate chart ranges and keeps the selected timestamps', async () => {
  const root = createRoot(container)
  try {
    await act(async () => root.render(h(StockPriceChart, defaults)))
    for (const label of ['차트 확대', '과거로 이동']) await act(async () => container.querySelector(`[aria-label="${label}"]`).click())
    const before = container.querySelector('.stock-chart-x-labels').textContent
    const range = { ...created.at(-1).range }
    const appended = [...bars, { ...bars.at(-1), t: bars.at(-1).t + 86400000 }]
    await act(async () => root.render(h(StockPriceChart, { ...defaults, bars: appended })))
    assert.equal(container.querySelector('.stock-chart-x-labels').textContent, before)
    assert.deepEqual(created.at(-1).range, range)
    assert.equal(created.at(-1).series[0].data.length, 33)
    const prepended = [...Array.from({ length: 3 }, (_, i) => ({ ...bars[0], t: bars[0].t - (3 - i) * 86400000 })), ...appended]
    await act(async () => root.render(h(StockPriceChart, { ...defaults, bars: prepended })))
    assert.equal(container.querySelector('.stock-chart-x-labels').textContent, before)
    assert.deepEqual(created.at(-1).range, { from: range.from + 3, to: range.to + 3 })
    await act(async () => root.render(h(StockPriceChart, { ...defaults, bars: prepended, currency: 'EUR' })))
    assert.equal(created.at(-2).removed, true)
    assert.equal(created.at(-1).series[0].data.length, 36)
    assert.equal(container.querySelector('.stock-chart-x-labels').textContent, before)
  } finally { await act(async () => root.unmount()) }
})
