import type { StatsPoint } from '@/api/client'
import { fmtDateTime, fmtTime } from './format'

export function readVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function axisBase() {
  return {
    axisLine: { lineStyle: { color: readVar('--stroke-strong') } },
    axisLabel: { color: readVar('--text-3'), fontSize: 11 },
    splitLine: { lineStyle: { color: readVar('--stroke') } },
    axisTick: { show: false },
  }
}

export interface LineConfig {
  points: StatsPoint[]
  name: string
  unit?: string
  color?: string
  area?: boolean
  smooth?: boolean
}

export function trendLineOption(cfg: LineConfig) {
  const color = cfg.color || readVar('--fluent-primary')
  const points = cfg.points || []
  const x = points.map((p) => fmtDateTime(p.t))
  const y = points.map((p) => (p.avg == null ? null : Number(p.avg)))

  return {
    grid: { left: 52, right: 24, top: 24, bottom: 56 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: readVar('--bg-card'),
      borderColor: readVar('--stroke-strong'),
      borderWidth: 1,
      textStyle: { color: readVar('--text-1'), fontSize: 12 },
      valueFormatter: (v: any) =>
        v == null ? '—' : `${Number(v).toFixed(1)}${cfg.unit ? ' ' + cfg.unit : ''}`,
    },
    xAxis: { type: 'category', data: x, boundaryGap: false, ...axisBase() },
    yAxis: { type: 'value', ...axisBase() },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      {
        type: 'slider',
        height: 18,
        bottom: 12,
        borderColor: 'transparent',
        backgroundColor: readVar('--bg-hover'),
        fillerColor: 'color-mix(in srgb, ' + color + ' 18%, transparent)',
        handleStyle: { color },
        textStyle: { color: readVar('--text-3') },
      },
    ],
    series: [
      {
        name: cfg.name,
        type: 'line',
        data: y,
        smooth: cfg.smooth ?? true,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: false,
        lineStyle: { width: 2.5, color },
        itemStyle: { color },
        areaStyle: cfg.area
          ? {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: `color-mix(in srgb, ${color} 28%, transparent)` },
                  { offset: 1, color: `color-mix(in srgb, ${color} 2%, transparent)` },
                ],
              },
            }
          : undefined,
      },
    ],
  }
}

export interface MultiLineConfig {
  points: StatsPoint[]
  series: { name: string; color: string; metric: string }[]
  unit?: string
}

/** 多指标对比：传入多组 points（同时间轴需对齐，这里以第一组为 x） */
export function multiLineOption(cfg: MultiLineConfig, allPoints: { metric: string; points: StatsPoint[] }[]) {
  const first = allPoints[0]?.points || []
  const x = first.map((p) => fmtTime(p.t))
  const series = cfg.series.map((s) => {
    const pts = allPoints.find((a) => a.metric === s.metric)?.points || []
    const y = first.map((fp) => {
      const m = pts.find((p) => fmtTime(p.t) === fmtTime(fp.t))
      return m && m.avg != null ? Number(m.avg) : null
    })
    return {
      name: s.name,
      type: 'line',
      data: y,
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 2.5, color: s.color },
      itemStyle: { color: s.color },
    }
  })
  return {
    grid: { left: 52, right: 24, top: 40, bottom: 48 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: readVar('--bg-card'),
      borderColor: readVar('--stroke-strong'),
      textStyle: { color: readVar('--text-1'), fontSize: 12 },
    },
    legend: {
      top: 4,
      textStyle: { color: readVar('--text-2'), fontSize: 12 },
      icon: 'roundRect',
    },
    xAxis: { type: 'category', data: x, boundaryGap: false, ...axisBase() },
    yAxis: { type: 'value', ...axisBase() },
    series,
  }
}

/** 占位状态：根据 metric 名返回中文标题 */
export const METRIC_META: Record<string, { label: string; unit: string; color: string }> = {
  light1: { label: '光敏 1', unit: 'ADC', color: '#F7630C' },
  light2: { label: '光敏 2', unit: 'ADC', color: '#CA5010' },
  aqi: { label: '空气质量指数', unit: 'AQI', color: '#0078D4' },
  temperature: { label: '温度', unit: '°C', color: '#D13438' },
  speed: { label: '风速', unit: 'm/s', color: '#107C10' },
}
