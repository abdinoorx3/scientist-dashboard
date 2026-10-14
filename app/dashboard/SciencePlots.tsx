'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import s from './plots.module.css'

type Transcript = { outcomes: string[]; probability0: string; probability1: string }
type SweepPoint = { label: string; x: number; value: number | null; exact: string | null; status: string }
type Rational = { numerator: bigint; denominator: bigint }

function numeric(value: string | number): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const [numerator, denominator = '1'] = value.split('/')
  const n = Number(numerator), d = Number(denominator)
  if (Number.isFinite(n) && Number.isFinite(d)) return d !== 0 && Number.isFinite(n / d) ? n / d : null
  const part = (input: string) => {
    const digits = input.trim().replace(/^[+-]/, '').replace(/^0+/, '') || '0'
    if (!/^\d+$/.test(digits)) return null
    return { leading: Number(digits.slice(0, 15)), exponent: Math.max(0, digits.length - 15), sign: input.trim().startsWith('-') ? -1 : 1 }
  }
  const a = part(numerator), b = part(denominator)
  if (!a || !b || b.leading === 0) return null
  const number = a.sign * b.sign * a.leading / b.leading * 10 ** (a.exponent - b.exponent)
  return Number.isFinite(number) ? number : null
}

function concise(value: number) {
  if (value === 0) return '0'
  if (Math.abs(value) >= 1000000 || Math.abs(value) < 0.001) return value.toExponential(2)
  return new Intl.NumberFormat('en-US', { maximumSignificantDigits: 5 }).format(value)
}

function percentage(value: string) {
  const number = numeric(value)
  if (number === null) return 'Not available'
  if (number === 0 && !/^[+-]?0+(?:\/[+-]?\d+)?$/.test(value.trim())) return '≈ 0%'
  return `${concise(number * 100)}%`
}

function rational(value: string | number): Rational | null {
  const text = String(value).trim()
  if (text.length > 10000 || !/^[+-]?\d+(?:\/[+-]?\d+)?$/.test(text)) return null
  const [a, b = '1'] = text.split('/')
  const numerator = BigInt(a), denominator = BigInt(b)
  return denominator === BigInt(0) ? null : { numerator, denominator }
}

function exactSum(values: (string | number)[]) {
  let total: Rational = { numerator: BigInt(0), denominator: BigInt(1) }
  for (const value of values) {
    const part = rational(value)
    if (!part) return null
    let numerator = total.numerator * part.denominator + part.numerator * total.denominator
    let denominator = total.denominator * part.denominator
    let a = numerator < BigInt(0) ? -numerator : numerator
    let b = denominator < BigInt(0) ? -denominator : denominator
    while (b) { const remainder = a % b; a = b; b = remainder }
    if (a) { numerator /= a; denominator /= a }
    if (denominator < BigInt(0)) { numerator = -numerator; denominator = -denominator }
    total = { numerator, denominator }
  }
  return total.denominator === BigInt(1) ? String(total.numerator) : `${total.numerator}/${total.denominator}`
}

function pointKeys(event: KeyboardEvent<HTMLElement | SVGElement>, index: number, count: number, select: (index: number) => void) {
  const next = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? Math.min(count - 1, index + 1)
    : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? Math.max(0, index - 1)
      : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : null
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(index); return }
  if (next === null) return
  event.preventDefault(); select(next)
  const container = event.currentTarget.closest('[data-plot-navigation]')
  const target = container?.querySelector<HTMLElement | SVGElement>(`[data-point-index="${next}"]`)
  if (target) target.focus()
  else requestAnimationFrame(() => container?.querySelector<HTMLElement | SVGElement>(`[data-point-index="${next}"]`)?.focus())
}

export function ProbabilityPlot({ transcripts, modelNames }: { transcripts: Transcript[]; modelNames: string[] }) {
  const [page, setPage] = useState(0)
  const [selection, setSelection] = useState(0)
  const titleId = useId()
  const pageSize = 24
  const pageCount = Math.max(1, Math.ceil(transcripts.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const first = currentPage * pageSize
  const visible = transcripts.slice(first, first + pageSize)
  const selectedIndex = Math.min(selection, Math.max(0, transcripts.length - 1))
  const selected = transcripts[selectedIndex]
  const names = [modelNames[0] || 'Model A', modelNames[1] || 'Model B']
  const select = (index: number) => { setSelection(index); setPage(Math.floor(index / pageSize)) }
  const changePage = (next: number) => { setPage(next); setSelection(next * pageSize) }
  if (!transcripts.length) return <div className={s.empty}>No transcript probabilities were issued for this calculation.</div>
  return <section className={s.plot} aria-labelledby={titleId}>
    <div className={s.plotHeader}><div><p className={s.eyebrow}>EXPERIMENT LAW</p><h3 id={titleId}>Where the models disagree</h3></div><span className={s.count}>{transcripts.length.toLocaleString()} transcripts</span></div>
    <p className={s.help}>Each pair uses the same 0–100% scale. Select a transcript to inspect its exact rational probabilities.</p>
    <div className={s.legend}><span><i />{names[0]}</span><span><i className={s.coral} />{names[1]}</span></div>
    <div className={s.probabilityAxis} aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></div>
    <div className={s.probabilityRows} data-plot-navigation>
      {visible.map((row, offset) => {
        const index = first + offset
        const values = [row.probability0, row.probability1]
        return <button type="button" className={`${s.probabilityRow} ${selectedIndex === index ? s.selectedRow : ''}`} key={index} data-point-index={index} aria-pressed={selectedIndex === index} aria-label={`Transcript ${index + 1}: ${row.outcomes.join(', ') || 'empty record'}. ${names[0]}: ${row.probability0}; ${names[1]}: ${row.probability1}`} onClick={() => select(index)} onMouseEnter={() => setSelection(index)} onFocus={() => setSelection(index)} onKeyDown={event => pointKeys(event, index, transcripts.length, select)}>
          <span className={s.transcriptLabel}><small>{String(index + 1).padStart(2, '0')}</small><strong>{row.outcomes.join(' → ') || 'Empty record'}</strong></span>
          <span className={s.pairedBars}>{values.map((value, model) => {
            const number = numeric(value)
            return <span className={s.barLine} key={model}><span className={s.barRail}><span className={model ? s.barCoral : s.barLime} style={{ width: `${Math.max(0, Math.min(100, (number ?? 0) * 100))}%` }} />{number === 0 && <span className={s.zeroTick} />}</span><span className={s.barValue}>{percentage(value)}</span></span>
          })}</span>
        </button>
      })}
    </div>
    {pageCount > 1 && <div className={s.pagination}><button type="button" disabled={currentPage === 0} onClick={() => changePage(currentPage - 1)}>← Previous</button><span>{first + 1}–{Math.min(first + pageSize, transcripts.length)} of {transcripts.length.toLocaleString()}</span><button type="button" disabled={currentPage === pageCount - 1} onClick={() => changePage(currentPage + 1)}>Next →</button></div>}
    {selected && <div className={s.inspector} aria-live="polite"><p className={s.eyebrow}>SELECTED TRANSCRIPT / {selectedIndex + 1}</p><strong>{selected.outcomes.join(' → ') || 'Empty record'}</strong><dl><div><dt>{names[0]} / exact probability</dt><dd>{selected.probability0}</dd></div><div><dt>{names[1]} / exact probability</dt><dd>{selected.probability1}</dd></div></dl></div>}
    <details className={s.tableDetails}><summary>View exact probability table{pageCount > 1 ? ' for this page' : ''}</summary><div className={s.tableScroll}><table><caption>Transcript probabilities. Decimal chart labels are approximations; table values are exact.</caption><thead><tr><th scope="col">Transcript</th><th scope="col">{names[0]}</th><th scope="col">{names[1]}</th></tr></thead><tbody>{visible.map((row, index) => <tr key={first + index}><th scope="row">{row.outcomes.join(' → ') || 'Empty record'}</th><td>{row.probability0}</td><td>{row.probability1}</td></tr>)}</tbody></table></div></details>
  </section>
}

export function ProtocolTimeline({ actions, actionCosts, overhead, unit }: { actions: string[]; actionCosts: Record<string, string | number>; overhead: string | number; unit: string }) {
  const [selection, setSelection] = useState(0)
  const titleId = useId()
  if (!actions.length) return <section className={s.plot}><div className={s.plotHeader}><div><p className={s.eyebrow}>PROTOCOL</p><h3>No distinguishing sequence issued</h3></div></div><p className={s.help}>The result does not provide an action sequence under the declared access.</p></section>
  const steps = [{ action: 'Preparation', cost: overhead, preparation: true }, ...actions.map(action => ({ action, cost: actionCosts[action], preparation: false }))]
  const selectedIndex = Math.min(selection, steps.length - 1)
  const selected = steps[selectedIndex]
  const costs = steps.map(step => step.cost)
  const total = costs.every(cost => cost !== undefined) ? exactSum(costs) : null
  const cumulativeCosts = steps.slice(0, selectedIndex + 1).map(step => step.cost)
  const cumulative = cumulativeCosts.every(cost => cost !== undefined) ? exactSum(cumulativeCosts) : null
  return <section className={s.plot} aria-labelledby={titleId}>
    <div className={s.plotHeader}><div><p className={s.eyebrow}>CONSTRUCTED PROTOCOL</p><h3 id={titleId}>The sequence that reveals a distinction</h3></div>{total !== null && <span className={s.totalCost}><strong>{total}</strong> {unit} / complete record</span>}</div>
    <p className={s.help}>Follow the witness in order, beginning with fresh preparation. Charges use the supplied resource ledger.</p>
    <ol className={s.timeline} data-plot-navigation>{steps.map((step, index) => <li key={index}><button type="button" className={selectedIndex === index ? s.selectedStep : ''} data-point-index={index} aria-pressed={selectedIndex === index} onClick={() => setSelection(index)} onMouseEnter={() => setSelection(index)} onFocus={() => setSelection(index)} onKeyDown={event => pointKeys(event, index, steps.length, setSelection)}><span className={s.stepNumber}>{String(index).padStart(2, '0')}</span><span className={s.stepAction}>{step.action}</span><span className={s.stepCost}>{step.cost ?? 'Undeclared'}{step.cost !== undefined ? ` ${unit}` : ''}</span><small>{step.preparation ? 'Per-record overhead' : 'Declared action charge'}</small></button>{index < steps.length - 1 && <span className={s.stepArrow} aria-hidden="true">→</span>}</li>)}</ol>
    <div className={s.protocolInspector} aria-live="polite"><span><strong>{selected.action}</strong><small>{selected.preparation ? 'Preparation / overhead' : `Action ${selectedIndex} of ${actions.length}`}</small></span><span><small>Charge at this step</small><strong>{selected.cost ?? 'Undeclared'} {selected.cost !== undefined ? unit : ''}</strong></span><span><small>Cumulative declared charge</small><strong>{cumulative ?? 'Unavailable'} {cumulative !== null ? unit : ''}</strong></span></div>
    <details className={s.tableDetails}><summary>View exact protocol ledger</summary><div className={s.tableScroll}><table><caption>One complete record. These declared charges are not measurements of energy unless the contract states that calibration.</caption><thead><tr><th scope="col">Step</th><th scope="col">Action</th><th scope="col">Declared charge ({unit})</th></tr></thead><tbody>{steps.map((step, index) => <tr key={index}><td>{index}</td><th scope="row">{step.action}</th><td>{step.cost ?? 'Undeclared'}</td></tr>)}</tbody></table></div></details>
  </section>
}

export function SweepPlot({ points, xLabel, yLabel, unit }: { points: SweepPoint[]; xLabel: string; yLabel: string; unit?: string }) {
  const [selection, setSelection] = useState(0)
  const [scale, setScale] = useState<'linear' | 'log'>('linear')
  const [chartWidth, setChartWidth] = useState(800)
  const chartRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const available = points.filter(point => Number.isFinite(point.x) && point.value !== null && Number.isFinite(point.value))
  const hasValues = available.length > 0
  useEffect(() => {
    const element = chartRef.current
    if (!element) return
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width
      if (width && width > 0) setChartWidth(Math.max(260, Math.round(width)))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasValues])
  if (!points.length) return <div className={s.empty}>Run a parameter sweep to compare exact calculations.</div>
  const selectedIndex = Math.min(selection, points.length - 1)
  const selected = points[selectedIndex]
  const xValues = points.map(point => point.x).filter(Number.isFinite)
  const yValues = available.map(point => point.value as number)
  const xMin = xValues.length ? Math.min(...xValues) : 0
  const xMax = xValues.length ? Math.max(...xValues) : 1
  const positiveMin = yValues.length ? Math.min(...yValues) : 0
  const largest = yValues.length ? Math.max(...yValues) : 0
  const canLog = yValues.length > 1 && positiveMin > 0 && largest / positiveMin >= 100
  const logarithmic = canLog && scale === 'log'
  const transform = (number: number) => logarithmic ? Math.log10(number) : number
  const bottom = logarithmic ? transform(positiveMin) : Math.min(0, ...yValues)
  const top = logarithmic ? transform(largest) : Math.max(0, ...yValues)
  const yMin = bottom === top ? bottom - (bottom < 0 ? Math.abs(bottom) * .1 || 1 : 0) : bottom
  const yMax = bottom === top ? top + (Math.abs(top) * .1 || 1) : top
  const chart = { left: 76, right: chartWidth - 22, top: 24, bottom: 226, width: chartWidth, height: 284 }
  const px = (x: number) => xMax === xMin ? (chart.left + chart.right) / 2 : chart.left + (x - xMin) / (xMax - xMin) * (chart.right - chart.left)
  const py = (value: number) => chart.bottom - (transform(value) - yMin) / (yMax - yMin) * (chart.bottom - chart.top)
  const tickValue = (fraction: number) => { const value = yMin + fraction * (yMax - yMin); return logarithmic ? 10 ** value : value }
  const segments: string[] = []
  let segment = ''
  for (const point of points) {
    const valid = Number.isFinite(point.x) && point.value !== null && Number.isFinite(point.value)
    if (!valid) { if (segment) segments.push(segment); segment = ''; continue }
    segment += `${segment ? ' L' : 'M'}${px(point.x)},${py(point.value as number)}`
  }
  if (segment) segments.push(segment)
  return <section className={s.plot} aria-labelledby={titleId}>
    <div className={s.plotHeader}><div><p className={s.eyebrow}>PARAMETER STUDY</p><h3 id={titleId}>{yLabel}</h3></div>{canLog && <div className={s.scaleSwitch} aria-label="Vertical axis scale"><button type="button" aria-pressed={!logarithmic} onClick={() => setScale('linear')}>Linear</button><button type="button" aria-pressed={logarithmic} onClick={() => setScale('log')}>Log</button></div>}</div>
    <p className={s.help}>Select a point to inspect the calculation. Gaps represent unavailable results; connecting lines are visual guides between calculated points.</p>
    {available.length ? <div className={s.chartFrame} ref={chartRef}><svg viewBox={`0 0 ${chart.width} ${chart.height}`} className={s.sweepSvg} role="group" aria-label={`${yLabel} versus ${xLabel}. ${available.length} calculated points. ${logarithmic ? 'Logarithmic' : 'Linear'} vertical scale.`} data-plot-navigation>
      {[0, .25, .5, .75, 1].map(fraction => <g key={fraction} aria-hidden="true"><line x1={chart.left} x2={chart.right} y1={chart.bottom - fraction * (chart.bottom - chart.top)} y2={chart.bottom - fraction * (chart.bottom - chart.top)} className={s.gridLine} /><text x={chart.left - 12} y={chart.bottom - fraction * (chart.bottom - chart.top) + 4} textAnchor="end" className={s.axisText}>{concise(tickValue(fraction))}</text></g>)}
      <g aria-hidden="true"><line x1={chart.left} x2={chart.right} y1={chart.bottom} y2={chart.bottom} className={s.axisLine} /><text x={chart.left} y={chart.bottom + 23} textAnchor="start" className={s.axisText}>{concise(xMin)}</text>{xMax !== xMin && <text x={chart.right} y={chart.bottom + 23} textAnchor="end" className={s.axisText}>{concise(xMax)}</text>}<text x={(chart.left + chart.right) / 2} y={chart.height - 8} textAnchor="middle" className={s.axisLabel}>{xLabel}</text>{segments.map((path, index) => <path d={path} key={index} className={s.sweepLine} />)}</g>
      {points.map((point, index) => point.value !== null && Number.isFinite(point.x) && Number.isFinite(point.value) ? <g key={index} role="button" tabIndex={0} data-point-index={index} aria-pressed={selectedIndex === index} aria-label={`${point.label}: ${yLabel} ${point.exact ?? concise(point.value)} ${unit || ''}. ${point.status}`} className={s.plotPoint} onClick={() => setSelection(index)} onMouseEnter={() => setSelection(index)} onFocus={() => setSelection(index)} onKeyDown={event => pointKeys(event, index, points.length, setSelection)}><circle cx={px(point.x)} cy={py(point.value)} r={18} className={s.pointTarget} /><circle cx={px(point.x)} cy={py(point.value)} r={selectedIndex === index ? 7 : 4.5} className={selectedIndex === index ? s.pointSelected : s.pointDot} /></g> : null)}
    </svg></div> : <div className={s.empty}>No numeric result was issued at these settings. Inspect the recorded statuses below.</div>}
    <div className={s.sweepInspector} aria-live="polite"><div><p className={s.eyebrow}>{xLabel}</p><strong>{selected.label}</strong><small>{selected.status.replaceAll('_', ' ')}</small></div><div><p className={s.eyebrow}>{yLabel}{unit ? ` / ${unit}` : ''}</p><strong>{selected.value !== null && Number.isFinite(selected.value) ? `≈ ${concise(selected.value)}` : 'No numeric result'}</strong>{selected.exact !== null && <code className={s.exactValue}>{selected.exact}</code>}</div><div className={s.pointNavigation}><button type="button" disabled={selectedIndex === 0} aria-label="Inspect previous sweep point" onClick={() => setSelection(selectedIndex - 1)}>←</button><span>{selectedIndex + 1} / {points.length}</span><button type="button" disabled={selectedIndex === points.length - 1} aria-label="Inspect next sweep point" onClick={() => setSelection(selectedIndex + 1)}>→</button></div></div>
    <details className={s.tableDetails}><summary>View all sweep values and statuses</summary><div className={s.tableScroll}><table><caption>Calculated points only. Exact values are retained where supplied; no value is substituted for missing results.</caption><thead><tr><th scope="col">{xLabel}</th><th scope="col">{yLabel}{unit ? ` (${unit})` : ''}</th><th scope="col">Status</th></tr></thead><tbody>{points.map((point, index) => <tr key={index}><th scope="row"><button type="button" onClick={() => setSelection(index)} aria-pressed={selectedIndex === index}>{point.label}</button></th><td>{point.exact ?? (point.value !== null && Number.isFinite(point.value) ? `≈ ${concise(point.value)}` : 'Not issued')}</td><td>{point.status.replaceAll('_', ' ')}</td></tr>)}</tbody></table></div></details>
  </section>
}
