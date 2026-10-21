// TradingView Lightweight Charts™
// Copyright (с) 2025 TradingView, Inc. https://www.tradingview.com/
import { useEffect, useId, useRef, useState } from 'react'
import { createChart, LineSeries, CandlestickSeries, HistogramSeries, ColorType, CrosshairMode, TrackingModeExitMode } from 'lightweight-charts'
import type { IChartApi, ISeriesApi, UTCTimestamp, Time } from 'lightweight-charts'
import type { PricePoint, StockChartPeriod } from '../lib/stockChart'
import { chartIntervalLabel, chartPointTime } from '../lib/stockChart'
import { stockMoney } from '../lib/stockPresentation'
import { chartFullRange, clampChartRange, zoomChartRange, moveChartRange, latestChartRange, nearestChartIndex, preserveChartRange, visibleChartPoints } from '../lib/chartViewport'
import type { ChartRange } from '../lib/chartViewport'
import './StockPriceChart.css'
export type StockChartMode = 'line' | 'candles'
const hasCandle = (p: PricePoint) => p.o != null && p.h != null && p.l != null
const time = (p: PricePoint) => p.t / 1000 as UTCTimestamp
const formatVolume = (v: number | undefined) => v == null ? '미제공' : v.toLocaleString('en-US')
const toMilliseconds = (t: Time) => typeof t === 'number' ? t * 1000 : typeof t === 'string' ? Date.parse(t) : Date.UTC(t.year, t.month - 1, t.day)
interface Engine { chart: IChartApi; line: ISeriesApi<'Line'>; candles: ISeriesApi<'Candlestick'>; volume?: ISeriesApi<'Histogram'> }
export default function StockPriceChart({ bars, currency, changePercent, period, interval, mode, onModeChange, volume, onVolumeChange }: {
  bars: PricePoint[]; currency: string; changePercent: number | null; period: StockChartPeriod; interval: string;
  mode: StockChartMode; onModeChange: (mode: StockChartMode) => void; volume: boolean; onVolumeChange: (value: boolean) => void
}) {
  const id = useId(), container = useRef<HTMLDivElement>(null), engine = useRef<Engine | null>(null)
  const previous = useRef(bars), latestBars = useRef(bars), manual = useRef(false)
  latestBars.current = bars
  const [activeTime, setActiveTime] = useState<number | null>(null), [range, setRange] = useState(() => chartFullRange(bars.length)), [available, setAvailable] = useState(true), [tablePage, setTablePage] = useState(0)
  const rangeRef = useRef(range)
  const candlesAvailable = bars.some(hasCandle), volumeAvailable = bars.some(p => p.v != null)
  const effectiveMode = candlesAvailable ? mode : 'line', showVolume = volume && volumeAvailable
  const activeIndex = activeTime == null ? bars.length - 1 : nearestChartIndex(bars, activeTime), selected = bars[activeIndex]
  const visible = visibleChartPoints(bars, clampChartRange(range, bars.length)), first = visible[0], last = visible.at(-1)
  const setView = (value: ChartRange) => { const next = clampChartRange(value, bars.length); rangeRef.current = next; setRange(next); engine.current?.chart.timeScale().setVisibleLogicalRange(next) }
  const navigate = (next: ChartRange) => { manual.current = true; setView(next) }
  const fit = () => { manual.current = false; engine.current?.chart.priceScale('right').applyOptions({ autoScale: true }); setView(chartFullRange(bars.length)) }
  useEffect(() => {
    // Canvas may be unavailable in assistive/static renderers. Native controls,
    // the readout and table remain usable instead of crashing the detail page.
    if (!container.current || typeof window.CanvasRenderingContext2D === 'undefined') { setAvailable(false); return }
    let chart: IChartApi | undefined
    try {
      chart = createChart(container.current, {
        autoSize: true, layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#777777', fontFamily: 'Arial, sans-serif', fontSize: 11, attributionLogo: true, panes: { enableResize: false } },
        grid: { vertLines: { visible: false }, horzLines: { color: '#eeeeee' } },
        rightPriceScale: { borderColor: '#e5e5e5', autoScale: true, minimumWidth: 64 },
        timeScale: { borderColor: '#e5e5e5', timeVisible: period === '1D' || period === '5D', secondsVisible: false, minBarSpacing: .01, fixLeftEdge: true, fixRightEdge: true, rightOffset: 0, shiftVisibleRangeOnNewBar: false, allowShiftVisibleRangeOnWhitespaceReplacement: false, lockVisibleTimeRangeOnResize: true, tickMarkMaxCharacterLength: 20, tickMarkFormatter: (t: Time) => chartPointTime(toMilliseconds(t), period, true) },
        localization: { locale: 'en-US', timeFormatter: (t: Time) => `${chartPointTime(toMilliseconds(t), period)} ET` },
        crosshair: { mode: CrosshairMode.Normal },
        trackingMode: { exitMode: TrackingModeExitMode.OnTouchEnd },
        handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
        handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: false }, axisDoubleClickReset: { time: true, price: true } },
        kineticScroll: { mouse: false, touch: true },
      })
      const priceFormat = { type: 'custom' as const, minMove: .01, formatter: (p: number) => stockMoney(p, currency) }
      const line = chart.addSeries(LineSeries, { color: '#334c59', lineWidth: 2, priceFormat, priceLineVisible: false, lastValueVisible: false })
      const candles = chart.addSeries(CandlestickSeries, { upColor: '#16845b', downColor: '#c34b45', wickUpColor: '#16845b', wickDownColor: '#c34b45', borderVisible: false, visible: false, priceFormat, priceLineVisible: false, lastValueVisible: false })
      engine.current = { chart, line, candles }
      chart.timeScale().subscribeVisibleLogicalRangeChange(value => {
        if (!value) return
        const next = clampChartRange(value, latestBars.current.length)
        rangeRef.current = next; setRange(next); setTablePage(0)
        if (value.to - value.from < Math.min(7, latestBars.current.length - 1) - .01) chart?.timeScale().setVisibleLogicalRange(next)
      })
      chart.subscribeCrosshairMove(event => { if (typeof event.time === 'number') setActiveTime(event.time * 1000) })
      setAvailable(true)
    } catch { chart?.remove(); chart = undefined; engine.current = null; setAvailable(false) }
    return () => { engine.current = null; chart?.remove() }
  }, [currency, period])
  useEffect(() => {
    const next = manual.current ? preserveChartRange(previous.current, bars, rangeRef.current) : chartFullRange(bars.length)
    const instance = engine.current
    if (instance) {
      instance.line.setData(bars.map(p => ({ time: time(p), value: p.c })))
      instance.line.applyOptions({ visible: effectiveMode === 'line', color: changePercent == null || changePercent === 0 ? '#334c59' : changePercent > 0 ? '#16845b' : '#c34b45' })
      instance.candles.setData(bars.map(p => hasCandle(p) ? { time: time(p), open: p.o!, high: p.h!, low: p.l!, close: p.c } : { time: time(p) }))
      instance.candles.applyOptions({ visible: effectiveMode === 'candles' })
      if (showVolume && !instance.volume) {
        instance.volume = instance.chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false, title: '거래량' }, 1)
        instance.chart.panes()[1]?.setHeight(82)
      }
      if (instance.volume && !showVolume) { instance.chart.removeSeries(instance.volume); instance.volume = undefined }
      instance.volume?.setData(bars.map(p => ({ time: time(p), ...(p.v == null ? {} : { value: p.v, color: p.o != null ? p.c >= p.o ? '#7ab49d' : '#d49a96' : '#a9afb2' }) })))
      container.current?.querySelectorAll('canvas').forEach(canvas => canvas.setAttribute('aria-hidden', 'true'))
      instance.chart.timeScale().setVisibleLogicalRange(next)
    }
    rangeRef.current = next; setRange(next); previous.current = bars
  }, [bars, effectiveMode, showVolume, changePercent])
  function select(index: number) {
    const i = Math.max(0, Math.min(bars.length - 1, index)); setActiveTime(bars[i].t)
    const instance = engine.current
    instance?.chart.setCrosshairPosition(bars[i].c, time(bars[i]), effectiveMode === 'candles' ? instance.candles : instance.line)
    if (i < range.from || i > range.to) navigate(clampChartRange({ from: i - (range.to - range.from) / 2, to: i + (range.to - range.from) / 2 }, bars.length))
  }
  if (!selected) return null
  const rows = [...visible].reverse(), pages = Math.max(1, Math.ceil(rows.length / 12)), page = Math.min(tablePage, pages - 1)
  return <div className="stock-price-chart">
    <div className="stock-chart-tools"><div role="group" aria-label="차트 표시 방식"><button type="button" aria-pressed={effectiveMode === 'line'} onClick={() => onModeChange('line')}>선형</button><button type="button" disabled={!candlesAvailable} aria-pressed={effectiveMode === 'candles'} onClick={() => onModeChange('candles')}>캔들</button><button type="button" disabled={!volumeAvailable} aria-pressed={showVolume} onClick={() => onVolumeChange(!volume)}>거래량</button></div><div role="group" aria-label="차트 구간 조작">
      <button type="button" aria-label="과거로 이동" disabled={range.from <= 0} onClick={() => navigate(moveChartRange(range, bars.length, -1))}>←</button><button type="button" aria-label="최근으로 이동" disabled={range.to >= bars.length - 1} onClick={() => navigate(moveChartRange(range, bars.length, 1))}>→</button>
      <button type="button" aria-label="차트 확대" disabled={range.to - range.from <= Math.min(7, bars.length - 1) + .01} onClick={() => navigate(zoomChartRange(range, bars.length, .65))}>＋</button><button type="button" aria-label="차트 축소" disabled={range.to - range.from >= bars.length - 1 - .01} onClick={() => navigate(zoomChartRange(range, bars.length, 1 / .65))}>−</button>
      <button type="button" onClick={() => navigate(latestChartRange(range, bars.length))}>최근 구간</button><button type="button" onClick={fit}>전체 구간</button>
    </div></div>
    {(!candlesAvailable || !volumeAvailable) && <p className="stock-note">{!candlesAvailable && '시가·고가·저가 미제공 · 선형 차트 표시. '}{!volumeAvailable && '거래량 미제공.'}</p>}
    <div className="stock-chart-readout" role="status" aria-live="polite"><time dateTime={new Date(selected.t).toISOString()}>{chartPointTime(selected.t, period)} ET</time><strong>{stockMoney(selected.c, currency)}</strong><span>{chartIntervalLabel(interval)} 종가</span></div>
    <dl className="stock-chart-ohlcv">{[['시가', selected.o], ['고가', selected.h], ['저가', selected.l], ['종가', selected.c]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value == null ? '미제공' : stockMoney(value, currency)}</dd></div>)}<div><dt>거래량 (주)</dt><dd>{formatVolume(selected.v)}</dd></div></dl>
    <div className="stock-chart-frame" tabIndex={0} role="group" aria-label="시점별 주가 차트" aria-describedby={`${id}-help`} onPointerDownCapture={() => { manual.current = true }} onWheelCapture={() => { manual.current = true }} onTouchStartCapture={() => { manual.current = true }} onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); select(activeIndex + (event.key === 'ArrowLeft' ? -1 : 1)) }
      else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); select(event.key === 'Home' ? 0 : bars.length - 1) }
      else if (['+', '=', '-', '0', 'PageUp', 'PageDown'].includes(event.key)) { event.preventDefault(); if (event.key === '0') fit(); else if (event.key.startsWith('Page')) navigate(moveChartRange(range, bars.length, event.key === 'PageUp' ? -1 : 1)); else navigate(zoomChartRange(range, bars.length, event.key === '-' ? 1 / .65 : .65)) }
    }}>
      <div className={`stock-chart-canvas${showVolume ? ' with-volume' : ''}`} ref={container} />
      {!available && <p className="stock-chart-fallback">이 환경에서는 차트를 표시할 수 없습니다. 아래 조회 표에서 값을 확인하세요.</p>}
    </div>
    <div className="stock-chart-x-labels"><span>{first && chartPointTime(first.t, period)} ET</span><span>{last && chartPointTime(last.t, period)} ET</span></div>
    <p className="stock-chart-window" role="status">표시 구간 {visible.length.toLocaleString('en-US')}개 봉 · {effectiveMode === 'candles' ? '상승 캔들 초록 · 하락 캔들 빨강' : '선형은 종가 기준'}{showVolume && ' · 하단 거래량 (주)'}</p>
    {effectiveMode === 'candles' && bars.some(p => !hasCandle(p)) && <p className="stock-note">OHLC 미제공 구간은 캔들을 그리지 않습니다. 종가는 선형 차트와 조회 표에서 확인할 수 있습니다.</p>}
    <p id={`${id}-help`} className="stock-note">휠·두 손가락으로 확대·축소하고, 좌우로 끌어 이동하세요. 모바일 세로 스크롤은 유지됩니다. 키보드: ← → 시점 선택 · Home/End 처음·마지막 · +/− 확대·축소 · PageUp/Down 구간 이동 · 0 전체 구간. 시각은 미국 동부시간(ET) 기준입니다.</p>
    <details className="stock-chart-table"><summary>표시 구간 조회 표 · {visible.length}개 봉</summary><div tabIndex={0} role="region" aria-label="주가 관측치 표 스크롤"><table><caption>표시 구간의 최신순 관측치 · 가격 {currency} · 거래량 주</caption><thead><tr>{['관측 시점 (ET)', '시가', '고가', '저가', '종가', '거래량 (주)'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.slice(page * 12, (page + 1) * 12).map(p => <tr key={p.t}><th scope="row">{chartPointTime(p.t, period)}</th>{[p.o, p.h, p.l, p.c].map((v, i) => <td key={i}>{v == null ? '미제공' : stockMoney(v, currency)}</td>)}<td>{formatVolume(p.v)}</td></tr>)}</tbody></table></div>{pages > 1 && <nav aria-label="주가 조회 표 페이지"><button type="button" disabled={!page} onClick={() => setTablePage(page - 1)}>이전</button><span>{page + 1} / {pages}</span><button type="button" disabled={page === pages - 1} onClick={() => setTablePage(page + 1)}>다음</button></nav>}</details>
    <p className="stock-chart-attribution">차트 <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">TradingView Lightweight Charts™</a> · © 2025 TradingView, Inc. · 시세 Yahoo Finance · <a href="/licenses/lightweight-charts-NOTICE.txt" target="_blank" rel="noopener noreferrer">오픈소스 고지</a> · <a href="/licenses/lightweight-charts-LICENSE.txt" target="_blank" rel="noopener noreferrer">Apache 2.0</a></p>
  </div>
}
