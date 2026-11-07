import { useEffect, useId, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { ProjectionYear } from '../lib/financialMath'
import './SimulatorChart.css'

function shortMoney(value: number) {
  const absolute = Math.abs(value)
  if (absolute >= 1e16) return `${value.toExponential(1)}원`
  const unit = absolute >= 1e12 ? 1e12 : absolute >= 1e8 ? 1e8 : absolute >= 1e4 ? 1e4 : 1
  const suffix = unit === 1e12 ? '조' : unit === 1e8 ? '억' : unit === 1e4 ? '만' : ''
  return `${(value / unit).toLocaleString('ko-KR', { maximumFractionDigits: absolute < 1 ? 2 : unit === 1 ? 0 : 1 })}${suffix}원`
}
const money = (value: number) => Math.round(value).toLocaleString('ko-KR')

export default function SimulatorChart({ data, retireAge }: { data: ProjectionYear[]; retireAge: number }) {
  const frame = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(620)
  const [selectedAge, setSelectedAge] = useState<number | null>(null)
  const id = useId().replace(/:/g, '')
  useEffect(() => {
    const element = frame.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => {
      const next = Math.round(entries[0].contentRect.width)
      if (next > 0) setWidth(Math.max(260, next))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const first = data[0], last = data[data.length - 1]
  const selected = data.find(row => row.age === selectedAge) ?? last
  const left = width < 480 ? 58 : 76, right = 16, top = 28, bottom = 32, height = 296
  const plotWidth = width - left - right, plotHeight = height - top - bottom
  const low = Math.min(0, ...data.map(row => row.asset))
  const high = Math.max(0, ...data.map(row => row.asset))
  const padding = (high - low || 1) * .08
  const minimum = low === 0 ? 0 : low - padding, maximum = high === 0 ? (low === 0 ? 1 : 0) : high + padding
  const x = (age: number) => first.age === last.age ? left + plotWidth / 2 : left + (age - first.age) / (last.age - first.age) * plotWidth
  const y = (value: number) => top + (maximum - value) / (maximum - minimum) * plotHeight
  const zero = y(0)
  const points = data.map(row => `${x(row.age)},${y(row.asset)}`).join(' ')
  const area = `${x(first.age)},${zero} ${points} ${x(last.age)},${zero}`
  const tickCount = width < 480 ? 3 : 5
  const ages = [...new Set(Array.from({ length: tickCount }, (_, index) => data[Math.round(index * (data.length - 1) / (tickCount - 1))].age))]
  const showRetirement = retireAge >= first.age && retireAge <= last.age
  function selectPoint(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const position = (event.clientX - bounds.left) * width / bounds.width
    const index = Math.max(0, Math.min(data.length - 1, Math.round((position - left) / plotWidth * (data.length - 1))))
    setSelectedAge(data[index].age)
  }
  return <div className="simulator-chart">
    <div className="sim-chart-readout">
      <div aria-live="polite" aria-atomic="true">
        <p className="sim-chart-age">{selected.age}세 · 연초 순자산</p>
        <p className={`sim-chart-value${selected.asset < 0 ? ' tool-negative' : ''}`}>{money(selected.asset)}<span>원</span></p>
      </div>
      <span className="sim-chart-assumption">입력한 가정 기준</span>
    </div>
    <dl className="sim-chart-breakdown" aria-label="선택 나이 자산 구성">
      <div><dt>총자산</dt><dd>{money(selected.grossAssets)}원</dd></div>
      <div><dt>대출 잔액</dt><dd>{money(selected.debt)}원</dd></div>
      <div><dt>부족자금</dt><dd>{money(selected.fundingGap)}원</dd></div>
    </dl>
    <div ref={frame} className="sim-chart-canvas">
      <svg viewBox={`0 0 ${width} ${height}`} className="sim-chart" role="img" aria-labelledby={`${id}-title ${id}-description`}
        onPointerMove={selectPoint} onPointerDown={selectPoint}>
        <title id={`${id}-title`}>입력한 가정에 따른 100세까지의 연초 순자산 추이</title>
        <desc id={`${id}-description`}>{first.age}세 {money(first.asset)}원에서 100세 {money(last.asset)}원. 아래 나이 선택으로 각 연도의 금액을 확인할 수 있습니다.</desc>
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--ui-selected)" stopOpacity=".2" /><stop offset="100%" stopColor="var(--ui-selected)" stopOpacity=".02" /></linearGradient>
          <clipPath id={`${id}-positive`}><rect x={left} y={top} width={plotWidth} height={zero - top} /></clipPath>
          <clipPath id={`${id}-negative`}><rect x={left} y={zero} width={plotWidth} height={top + plotHeight - zero} /></clipPath>
        </defs>
        {Array.from({ length: 5 }, (_, index) => minimum + (maximum - minimum) * index / 4).map((value, index) => <g key={index}>
          <line className="sim-gridline" x1={left} x2={width - right} y1={y(value)} y2={y(value)} />
          <text x={left - 10} y={y(value) + 4} textAnchor="end">{shortMoney(value)}</text>
        </g>)}
        <line className="sim-zero-line" x1={left} x2={width - right} y1={zero} y2={zero} />
        <polygon points={area} fill={`url(#${id}-fill)`} clipPath={`url(#${id}-positive)`} />
        <polygon points={area} className="sim-negative-area" clipPath={`url(#${id}-negative)`} />
        {showRetirement && <g className="sim-retirement-marker">
          <line x1={x(retireAge)} x2={x(retireAge)} y1={top} y2={height - bottom} />
          <text x={x(retireAge)} y={14} textAnchor={retireAge === first.age ? 'start' : retireAge === last.age ? 'end' : 'middle'}>은퇴 {retireAge}세</text>
        </g>}
        <polyline className="sim-trend" points={points} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <line className="sim-crosshair" x1={x(selected.age)} x2={x(selected.age)} y1={top} y2={height - bottom} />
        <circle className="sim-active-dot" cx={x(selected.age)} cy={y(selected.asset)} r="5" />
        {ages.map(age => <text key={age} x={x(age)} y={height - 8} textAnchor={age === first.age && ages.length > 1 ? 'start' : age === last.age && ages.length > 1 ? 'end' : 'middle'}>{age}세</text>)}
      </svg>
    </div>
    <div className="sim-chart-legend" aria-label="차트 범례"><span><i />순자산</span>{showRetirement && <span><i className="is-dashed" />은퇴 시점</span>}<span>가로축 나이 · 세로축 원</span></div>
    <label className="sim-chart-selector"><span>나이 선택 <strong>{selected.age}세</strong></span>
      <input type="range" min={first.age} max={last.age} step={1} value={selected.age} disabled={first.age === last.age}
        aria-label="차트에서 확인할 나이" aria-valuetext={`${selected.age}세 연초 순자산 ${money(selected.asset)}원`}
        onChange={event => setSelectedAge(Number(event.target.value))} />
    </label>
    <p className="tool-meta sim-chart-help">차트를 짚거나 나이를 선택해 금액을 확인하세요. 키보드는 방향키로 이동합니다. 음수 영역은 순자산이 0원 미만인 구간입니다.</p>
  </div>
}
