import { useEffect, useRef } from 'react'
import { init, use as registerCharts } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, AriaComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import { economicDate } from '../lib/economicIndicators'
import type { EconomicPoint } from '../lib/economicIndicators'
registerCharts([LineChart, GridComponent, TooltipComponent, AriaComponent, SVGRenderer])
export default function EconomicChart({ points, label, daily }: { points: EconomicPoint[]; label: string; daily: boolean }) {
  const container = useRef<HTMLDivElement>(null)
  const first = points[0], last = points.at(-1)
  const description = `${label}, 단위 %. ${first && last ? `${economicDate(first.date, daily)}부터 ${economicDate(last.date, daily)}까지. ` : ''}정확한 값과 결측 사유는 아래 조회 표에서 확인할 수 있습니다.`
  useEffect(() => {
    if (!container.current) return
    const chart = init(container.current, undefined, { renderer: 'svg' })
    chart.setOption({
      animation: false, aria: { enabled: true, label: { description } },
      grid: { left: 52, right: 22, top: 20, bottom: 42 },
      tooltip: { trigger: 'axis', renderMode: 'richText', formatter: (params: unknown) => {
        const item = (Array.isArray(params) ? params[0] : params) as { value?: [string | number, number | null] }
        const value = item?.value
        if (!value) return ''
        const date = typeof value[0] === 'number' ? new Date(value[0]).toISOString().slice(0, 10) : value[0]
        return `${economicDate(date, daily)}\n${label}: ${typeof value[1] === 'number' && Number.isFinite(value[1]) ? value[1].toFixed(2) + '%' : '미제공'}`
      } },
      xAxis: { type: 'time', axisLine: { lineStyle: { color: '#ddd' } }, axisTick: { show: false }, axisLabel: { color: '#777', hideOverlap: true, formatter: (value: number) => new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(value) }, splitLine: { show: false } },
      yAxis: { type: 'value', scale: true, axisLabel: { color: '#777', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#eee' } } },
      series: [{ name: label, type: 'line', data: points.map(p => [p.date, p.value]), connectNulls: false, showSymbol: points.length < 20, symbolSize: 5, smooth: false, lineStyle: { width: 2, color: '#334c59' }, itemStyle: { color: '#334c59' }, emphasis: { disabled: true } }],
    })
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(container.current)
    return () => { observer.disconnect(); chart.dispose() }
  }, [points, label, description, daily])
  return <div className="economic-chart" role="img" aria-label={description}><div ref={container} aria-hidden="true" /></div>
}
