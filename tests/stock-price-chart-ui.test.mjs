import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { JSDOM } from 'jsdom'
import './helpers/register-tsx.mjs'

// Reproduce an imperative chart emitting transient range changes during setData.
// Native rendering/gestures remain covered by stock-chart-controls browser tests.
const chartSource = "export const LineSeries='line', CandlestickSeries='candles', HistogramSeries='volume'\nexport const ColorType={Solid:0}, CrosshairMode={Normal:0}, TrackingModeExitMode={OnTouchEnd:0}\nexport const created=[]\nexport function createChart() {\n  let listener\n  const chart={range:{from:0,to:31},series:[],removed:false}\n  const scale={\n    subscribeVisibleLogicalRangeChange(fn){listener=fn},\n    setVisibleLogicalRange(value){chart.range={...value};listener?.(value)},\n  }\n  chart.timeScale=()=>scale\n  chart.addSeries=(type,options)=>{const series={type,options:{...options},data:[],applyOptions(value){Object.assign(series.options,value)},setData(data){\n    const previous=series.data.length;series.data=data\n    if(previous && previous!==data.length) listener?.({from:chart.range.from+1,to:chart.range.to+1})\n  }};chart.series.push(series);return series}\n  chart.removeSeries=()=>{}\n  chart.panes=()=>[{}, {setHeight(){}}]\n  chart.priceScale=()=>({applyOptions(){}})\n  chart.setCrosshairPosition=(value,t)=>{chart.crosshair={value,t}}\n  chart.clearCrosshairPosition=()=>{chart.crosshair=null}\n  chart.subscribeCrosshairMove=fn=>{chart.emitCrosshair=fn}\n  chart.remove=()=>{chart.removed=true}\n  created.push(chart);return chart\n}\n"
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


test('moving averages and normalized comparison keep the price grid and manual viewport, then restore price formatting', async () => {
  const root = createRoot(container)
  const button = name => [...container.querySelectorAll('button')].find(el => el.textContent === name)
  const benchmark = { symbol: 'VOO', period: '1M', currency: 'USD', interval: '1d', points: bars.map((p, i) => ({ t: p.t, c: 200 + i })), fetchedAt: 1, stale: false }
  try {
    await act(async () => root.render(h(StockPriceChart, defaults)))
    await act(async () => container.querySelector('[aria-label="차트 확대"]').click())
    const before = { ...created.at(-1).range }
    await act(async () => button('20봉 SMA').click())
    const average = created.at(-1).series.find(s => s.options.title === '20봉 SMA')
    assert.ok(average.data.slice(0, 19).every(p => !('value' in p)))
    assert.equal(average.data.at(-1).value, 121.5)
    assert.deepEqual(created.at(-1).range, before)
    await act(async () => root.render(h(StockPriceChart, { ...defaults, comparison: { enabled: true, benchmark, onToggle() {} } })))
    const current = created.at(-1)
    assert.equal(current.series[0].data.length, bars.length)
    assert.equal(current.series[0].data[0].value, 0)
    assert.ok(Math.abs(current.series[0].data.at(-1).value - 31) < 1e-10)
    assert.equal(current.series[0].options.priceFormat.formatter(1), '+1.00%')
    assert.equal(average.options.visible, false)
    assert.deepEqual(current.range, before)
    assert.match(container.querySelector('.stock-chart-analysis-basis').textContent, /공통 관측치/)
    await act(async () => root.render(h(StockPriceChart, defaults)))
    assert.equal(current.series[0].options.priceFormat.formatter(1), '$1.00')
    assert.equal(average.options.visible, true)
    assert.deepEqual(current.range, before)
  } finally { await act(async () => root.unmount()) }
})


test('keyboard selection of an unmatched comparison time clears the prior crosshair and leaves derived values missing', async () => {
  const root = createRoot(container)
  const benchmark = { symbol: 'VOO', period: '1M', currency: 'USD', interval: '1d', points: bars.filter((_, i) => i % 2 === 0), fetchedAt: 1, stale: false }
  try {
    await act(async () => root.render(h(StockPriceChart, { ...defaults, comparison: { enabled: true, benchmark, onToggle() {} } })))
    const frame = container.querySelector('[aria-label="시점별 주가 차트"]')
    await act(async () => frame.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Home', bubbles: true })))
    assert.equal(created.at(-1).crosshair.value, 0)
    await act(async () => created.at(-1).emitCrosshair({ time: bars[1].t / 1000 }))
    assert.equal(container.querySelector('.stock-chart-readout strong').textContent, '0.00%')
    await act(async () => frame.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    assert.equal(created.at(-1).crosshair, null)
    assert.equal(container.querySelector('.stock-chart-readout strong').textContent, '—')
    assert.match(container.querySelector('.stock-chart-comparison-readout').textContent, /미제공/)
    assert.equal(container.querySelector('.stock-chart-readout time').dateTime, new Date(bars[1].t).toISOString())
    assert.equal('value' in created.at(-1).series[0].data[1], false)
    await act(async () => frame.dispatchEvent(new dom.window.Event('pointermove', { bubbles: true })))
    await act(async () => created.at(-1).emitCrosshair({ time: bars[2].t / 1000 }))
    assert.equal(container.querySelector('.stock-chart-readout time').dateTime, new Date(bars[2].t).toISOString())
  } finally { await act(async () => root.unmount()) }
})
