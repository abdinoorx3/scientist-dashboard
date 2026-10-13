'use client'

import { useEffect, useRef, useState } from 'react'
import { dashboardProject as site } from '../dashboard-project'
import s from './dashboard.module.css'
import { assetPath } from '../asset-path'

type Experiment = { status: string; transcripts?: { outcomes: string[]; probability0: string; probability1: string }[]; total_variation?: string; sufficient_records?: number | null; per_record_declared_charge?: string; nominal_batch_declared_charge?: string | null; target_error?: string; assumptions?: string[] }
type Report = { status: string; conclusion: string; contract_name: string; contract_sha256: string; question: string; model_names: string[]; witness?: { actions: string[]; minimum_action_charge: string }; experiment?: Experiment; robust_experiment?: { status: string; records?: number; robust_gap_lower?: string; batch_declared_charge?: string; assumptions?: string[] }; scope: string[]; resources: { unit: string; calibration: string; included: string[]; excluded: string[] }; preparation: { description: string; iid_records: boolean } }
type Calibration = { status: string; description: string; recorded_results_match_exactly: boolean; data_origin: string; case: string; science_records: number; science_readouts: number; reference_readouts: number; geometry: { entropy_lower: string; alpha: string; order_selected: number }; endpoint_baseline: { entropy_lower: string }; combined: { entropy_lower: string; selected_component: string; failure_probability_upper: string; joint_model_scope: string; scope_note: string }; scope: Record<string, string> }
type Result = { report?: Report; verification?: { verified: boolean; synthesis_repeated: boolean; scope: string }; calibration?: Calibration }
type SavedRun = { id: string; date: string; title: string; contract: string; result: Result }
const examples = [['active', 'Active intervention'], ['passive', 'Passive observation'], ['calibrated', 'Calibrated intervention'], ['calibration_gap_closed', 'Calibration gap closed']] as const

function numeric(value: string) {
  const [a, b = '1'] = value.split('/')
  const x = Number(a), y = Number(b)
  if (Number.isFinite(x) && Number.isFinite(y)) return x / y
  const leading = (v: string) => { const positive = v.replace(/^[+-]/, '').replace(/^0+/, '') || '0'; return { mantissa: Number(positive.slice(0, 15)) / 10 ** (Math.min(15, positive.length) - 1), exponent: positive.length - 1, sign: v.startsWith('-') ? -1 : 1 } }
  const n = leading(a), d = leading(b)
  return n.sign * d.sign * n.mantissa / d.mantissa * 10 ** (n.exponent - d.exponent)
}
function shortValue(value: string) { return value.length > 18 ? `≈ ${numeric(value).toPrecision(6)}` : value }
function download(value: unknown, name: string) {
  const href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = href; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}

export default function ScienceDashboard() {
  const [mode, setMode] = useState<'access' | 'calibration'>('access')
  const [example, setExample] = useState('active')
  const [contract, setContract] = useState('')
  const [reportInput, setReportInput] = useState('')
  const [operation, setOperation] = useState<'analyze' | 'verify'>('analyze')
  const [result, setResult] = useState<Result | null>(null)
  const [fresh, setFresh] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Ready to run a declared contract.')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<SavedRun[]>([])
  const worker = useRef<Worker | null>(null)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadId = useRef(0)
  useEffect(() => {
    let mounted = true
    const id = ++loadId.current
    fetch(assetPath('/research-assets/active.json')).then(response => { if (!response.ok) throw new Error('Example could not be loaded.'); return response.text() }).then(text => { if (mounted && id === loadId.current) setContract(text) }).catch(error => { if (mounted && id === loadId.current) setError(error.message) })
    try { const data = JSON.parse(localStorage.getItem('2dlabs-science-runs-v1') || '[]'); if (Array.isArray(data)) setSaved(data.slice(0, 6)) } catch {}
    return () => { mounted = false; worker.current?.terminate(); if (timeout.current) clearTimeout(timeout.current) }
  }, [])

  async function loadExample(name: string) {
    const id = ++loadId.current
    setExample(name); setResult(null); setError(''); setOperation('analyze'); setFresh(false)
    try { const response = await fetch(assetPath(`/research-assets/${name}.json`)); if (!response.ok) throw new Error('Example could not be loaded.'); const text = await response.text(); if (id === loadId.current) setContract(text) } catch (error) { setError(error instanceof Error ? error.message : 'Could not load this example.') }
  }
  function stop(message = 'Run cancelled. No result was issued.') {
    worker.current?.terminate(); worker.current = null; if (timeout.current) clearTimeout(timeout.current)
    setBusy(false); setStatus(message)
  }
  function run() {
    setError(''); setResult(null); setFresh(false)
    if (mode === 'access' && !contract.trim()) { setError('Load or enter an access contract first.'); return }
    if (new TextEncoder().encode(contract).length > 200000) { setError('The browser contract limit is 200 KB.'); return }
    if (mode === 'access' && operation === 'verify' && !reportInput.trim()) { setError('Paste a report to check against the contract.'); return }
    if (reportInput.length > 2000000) { setError('The browser report limit is 2 MB.'); return }
    setBusy(true); setStatus('Starting the research runtime…')
    const activeWorker = worker.current || new Worker(assetPath('/research-worker.js'), { type: 'module' })
    worker.current = activeWorker
    const armTimeout = (duration: number) => { if (timeout.current) clearTimeout(timeout.current); timeout.current = setTimeout(() => { stop('Browser time limit reached.'); setError('This run exceeded the browser limit. Download the toolkit for larger calculations.'); }, duration) }
    armTimeout(120000)
    activeWorker.onmessage = event => {
      const payload = event.data as { type: 'progress' | 'error' | 'result'; message?: string; result?: Result }
      if (payload.type === 'progress') { setStatus(payload.message || 'Calculating…'); if (payload.message?.startsWith('Synthesizing') || payload.message?.startsWith('Checking') || payload.message?.startsWith('Replaying')) armTimeout(45000); return }
      if (timeout.current) clearTimeout(timeout.current)
      setBusy(false)
      if (payload.type === 'error') { setError(payload.message || 'The calculation failed.'); setStatus('No verified result was issued.'); return }
      setResult(payload.result || null); setFresh(true); setStatus(payload.result?.calibration ? 'Retained simulated record replayed. Exact recorded results match.' : 'Report checked against the supplied contract.')
    }
    activeWorker.onerror = () => { stop('Runtime unavailable.'); setError('The browser runtime could not start. Reload and try again, or use the downloadable toolkit.') }
    activeWorker.postMessage({ operation: mode === 'calibration' ? 'calibration' : operation, contract, report: reportInput })
  }
  function saveRun() {
    if (!result) return
    const item = { id: crypto.randomUUID(), date: new Date().toISOString(), title: result.report?.contract_name || 'Detector calibration replay', contract, result }
    const runs = [item, ...saved].slice(0, 6)
    try { localStorage.setItem('2dlabs-science-runs-v1', JSON.stringify(runs)); setSaved(runs); setStatus('Run saved in this browser.') } catch { setError('Browser storage is full or unavailable. Export the report to keep this run.') }
  }
  async function importFile(file?: File) {
    if (!file) return
    if (file.size > 200000) { setError('The browser contract limit is 200 KB.'); return }
    ++loadId.current
    setContract(await file.text()); setExample('custom'); setResult(null); setFresh(false); setError('')
  }
  const report = result?.report
  const calibration = result?.calibration
  return <div className={s.dashboard}>
    <div className={s.heading}><div><p>2D LABS / RESEARCH WORKSPACE</p><h1>Scientist Dashboard<span>↗</span></h1></div><span className={s.version}>CONSTRUCTIVE ACCESS / TOOLKIT 0.10.0</span></div>
    <div className={s.workspace}><aside className={s.sidebar}><p>WORKFLOWS</p><button type="button" disabled={busy} className={mode === 'access' ? s.active : ''} onClick={() => { setMode('access'); setResult(null); setError('') }}>Access contracts<span>01</span></button><button type="button" disabled={busy} className={mode === 'calibration' ? s.active : ''} onClick={() => { setMode('calibration'); setResult(null); setError('') }}>Detector calibration<span>02</span></button><div className={s.saved}><p>SAVED IN THIS BROWSER</p>{saved.length ? saved.map(item => <button type="button" disabled={busy} key={item.id} onClick={() => { setContract(item.contract); setResult(item.result); setMode(item.result.calibration ? 'calibration' : 'access'); setFresh(false); setError(''); setStatus('Saved copy loaded. Run again to recheck it.'); setExample('custom') }}><strong>{item.title}</strong><small>{new Date(item.date).toLocaleDateString()}</small></button>) : <span>Your saved runs appear here.</span>}</div><div className={s.sidebarFoot}><span className={s.localDot} /> CALCULATIONS STAY LOCAL<a href={site.dashboardRepositoryUrl}>Scientist Dashboard source ↗</a><a href={assetPath('/research-assets/constructive-access-toolkit.zip')}>Download toolkit ↗</a><a href={assetPath('/research-assets/LICENSE.txt')}>Toolkit license & attribution ↗</a></div></aside>
    <div className={s.workArea}>
      {mode === 'access' ? <section className={s.inputs}><div className={s.panelHeading}><div><p>01 / DEFINE THE ACCESS</p><h2>Your contract. Your assumptions.</h2></div><select aria-label="Released example" disabled={busy} value={example} onChange={event => loadExample(event.target.value)}>{examples.map(([id, title]) => <option key={id} value={id}>{title}</option>)}<option value="custom" disabled>Custom contract</option></select></div><p className={s.explanation}>Compare exactly two finite classical instruments using rational coefficients. Define the physical access before making an inference. Release examples are illustrative models.</p><div className={s.modeSwitch}><button type="button" disabled={busy} aria-pressed={operation === 'analyze'} onClick={() => setOperation('analyze')}>Analyze contract</button><button type="button" disabled={busy} aria-pressed={operation === 'verify'} onClick={() => setOperation('verify')}>Check a report</button><label className={s.importLabel}>Import contract<input aria-label="Import contract JSON" type="file" accept=".json,application/json" disabled={busy} onChange={event => { importFile(event.target.files?.[0]); event.target.value = '' }} /></label></div><label className={s.editorLabel} htmlFor="contract-editor">ACCESS CONTRACT / JSON</label><textarea id="contract-editor" className={s.editor} spellCheck={false} disabled={busy} value={contract} onChange={event => { ++loadId.current; setContract(event.target.value); setExample('custom'); setResult(null); setFresh(false) }} aria-describedby="contract-help" /><p id="contract-help" className={s.inputHint}>Use integer coefficients or rational strings such as “1/3”. Floating-point model coefficients are rejected. Browser limit: 8 states per model; larger work can use the downloadable toolkit.</p>{operation === 'verify' && <><label className={s.editorLabel} htmlFor="report-editor">REPORT TO VERIFY / JSON</label><textarea id="report-editor" className={`${s.editor} ${s.reportEditor}`} spellCheck={false} disabled={busy} value={reportInput} onChange={event => setReportInput(event.target.value)} /></>}</section> : <section className={s.inputs}><div className={s.panelHeading}><div><p>02 / DETECTOR CALIBRATION</p><h2>Replay the retained record.</h2></div><span className={s.simulationTag}>SIMULATED DATA</span></div><p className={s.explanation}>Replay the first driven dataset from the frozen detector-calibration benchmark through the public exact-arithmetic API. This uses the released source and retained counts; no new records are generated.</p><div className={s.calibrationIntro}><strong>13,333,333<span>target trials</span></strong><strong>200,000<span>reference readings</span></strong><strong>80,199,998<span>total detector readings</span></strong></div><p className={s.inputHint}>The geometry, endpoint, and combined bounds use the declared confidence event and physical premises. The combined procedure inherits the stricter geometry assumptions. A zero lower bound is inconclusive.</p><a className={s.paperLink} href={assetPath('/research-assets/constructive-access-reference.pdf') + '#page=320'}>Read the reference implementation ↗</a></section>}
      <div className={s.runBar}><button type="button" className={s.runButton} disabled={busy || (mode === 'access' && !contract.trim())} onClick={run}>{busy ? 'Working…' : mode === 'calibration' ? 'Replay simulated dataset' : operation === 'verify' ? 'Verify report' : 'Run analysis'}<span aria-hidden="true">↗</span></button>{busy && <button type="button" className={s.cancelButton} onClick={() => stop()}>Cancel</button>}<p role="status" aria-live="polite">{status}</p></div>{error && <div className={s.error} role="alert"><strong>Run stopped</strong><pre>{error}</pre></div>}
      {result && <section className={s.results} aria-label="Calculation results"><div className={s.resultHeader}><h2>{calibration ? 'Calibration replay' : 'Access analysis'}</h2><span className={fresh ? s.verified : s.simulationTag}>{fresh ? calibration ? 'EXACT REPLAY MATCH' : result.verification?.verified ? 'REPORT VERIFIED' : 'CHECK COMPLETE' : 'SAVED COPY / RECHECK TO VERIFY'}</span></div>
      {report && <><div className={s.conclusion}><span>{report.status === 'equivalent_under_declared_access' ? 'OBSTRUCTION' : 'DISTINGUISHING WITNESS'}</span><h3>{report.status === 'equivalent_under_declared_access' ? 'The declared access cannot separate these models.' : 'A distinction exists under the declared access.'}</h3><p>{report.conclusion}</p></div><div className={s.metrics}><div><span>WITNESS PROTOCOL</span><strong>{report.witness?.actions.join(' → ') || 'No witness'}</strong></div><div><span>SUFFICIENT RECORDS / NOMINAL</span><strong>{report.experiment?.sufficient_records ?? '—'}</strong></div><div><span>NOMINAL BATCH CHARGE</span><strong>{report.experiment?.nominal_batch_declared_charge || '—'}<small>{report.resources.unit}</small></strong></div></div>{report.experiment?.transcripts && <><h3 className={s.sectionTitle}>Complete experiment laws</h3><div className={s.lawLegend}><span><i />{report.model_names[0]}</span><span><i />{report.model_names[1]}</span></div><div className={s.laws}>{report.experiment.transcripts.slice(0, 24).map((row, i) => <div key={i}><strong>{row.outcomes.join(' / ')}</strong><div><span><em style={{ width: `${Math.max(0, Math.min(100, numeric(row.probability0) * 100))}%` }} /><b>{shortValue(row.probability0)}</b></span><span><em style={{ width: `${Math.max(0, Math.min(100, numeric(row.probability1) * 100))}%` }} /><b>{shortValue(row.probability1)}</b></span></div></div>)}</div>{report.experiment.transcripts.length > 24 && <p className={s.inputHint}>Showing 24 transcripts. Export the report for the complete law.</p>}</>}{report.robust_experiment && report.robust_experiment.status !== 'not_supplied' && <div className={s.calibrationSummary}><h3>Calibration-aware result</h3><p>{report.robust_experiment.status.replaceAll('_', ' ')}</p><dl><div><dt>Robust gap</dt><dd>{report.robust_experiment.robust_gap_lower || '—'}</dd></div><div><dt>Covered record count</dt><dd>{report.robust_experiment.records ?? '—'}</dd></div><div><dt>Declared batch charge</dt><dd>{report.robust_experiment.batch_declared_charge || '—'} {report.resources.unit}</dd></div></dl></div>}<details className={s.assumptions}><summary>Scope, preparation & physical resource ledger</summary><p>{report.preparation.description}</p><p>{report.resources.calibration}</p><ul>{[...report.scope, ...(report.experiment?.assumptions || []), ...(report.robust_experiment?.assumptions || [])].map((text, i) => <li key={i}>{text}</li>)}</ul><p>Included: {report.resources.included.join('; ')}</p><p>Excluded: {report.resources.excluded.join('; ')}</p><p className={s.hash}>Contract SHA-256: {report.contract_sha256}</p></details></>}
      {calibration && <><div className={s.conclusion}><span>RETAINED SIMULATED DATA / {calibration.case}</span><h3>Exact recorded results match.</h3><p>{calibration.description}</p></div><div className={s.metrics}>{[['Geometry lower bound', calibration.geometry.entropy_lower], ['Endpoint lower bound', calibration.endpoint_baseline.entropy_lower], ['Combined lower bound', calibration.combined.entropy_lower]].map(([label, value]) => <div key={label}><span>{label.toUpperCase()}</span><strong>{shortValue(value)}</strong><small>Entropy rate / declared model units</small></div>)}</div><div className={s.calibrationSummary}><h3>One shared confidence event</h3><p>Selected component: {calibration.combined.selected_component}. Failure probability upper bound: {calibration.combined.failure_probability_upper}.</p><p>{calibration.combined.scope_note}</p></div><details className={s.assumptions}><summary>Physical premises & evidence scope</summary><p>{calibration.combined.joint_model_scope}</p><ul>{Object.entries(calibration.scope).map(([key, value]) => <li key={key}><strong>{key}:</strong> {value}</li>)}</ul><p>These are simulated detector records, not physical measurements. Decimal values displayed above are approximations; the exported report retains the exact rational values.</p></details></>}
      <div className={s.resultActions}><button type="button" onClick={() => download(report || calibration, calibration ? 'calibration-replay.json' : 'access-report.json')}>Export exact report ↗</button><button type="button" onClick={saveRun}>Save in this browser +</button>{report && <button type="button" onClick={() => { setReportInput(JSON.stringify(report, null, 2)); setOperation('verify'); setFresh(false); setStatus('Report loaded for verification. Click Verify report to recheck.'); }}>Check this report ↗</button>}</div><details className={s.rawReport}><summary>Inspect complete JSON output</summary><pre>{JSON.stringify(result, null, 2)}</pre></details></section>}
      <div className={s.workspaceNote}><strong>Research calculations, with their boundaries intact.</strong><p>Constructive Access — Abdinoor, 2D Labs. This interface runs the unmodified released toolkit in a browser worker. It checks a supplied calculation; physical calibration and model adequacy remain the scientist&apos;s responsibility. Exact model access, finite-error inference, and measured physical evidence are distinct.</p><a href={assetPath('/research-assets/constructive-access-reference.pdf')}>Reference</a><a href={site.dashboardRepositoryUrl}>Scientist Dashboard source</a><a href={site.dashboardLicenseUrl}>Dashboard license</a><a href={assetPath('/research-assets/LICENSE.txt')}>Toolkit license & attribution</a></div>
    </div></div>
  </div>
}
