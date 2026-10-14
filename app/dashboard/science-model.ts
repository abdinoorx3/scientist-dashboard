export const workspaceVersion = '1.1.0'
export type Scalar = string | number
export type Instrument = { name: string; initial: Scalar[]; actions: Record<string, Record<string, Scalar[][]>>; [key: string]: unknown }
export type AccessContract = { name: string; question: string; models: Instrument[]; design: { target_average_error: Scalar; [key: string]: unknown }; resources: { unit: string; action_costs: Record<string, Scalar>; per_record_overhead: Scalar; [key: string]: unknown }; calibration?: { record_tv_radii: Scalar[]; joint_failure_probability: Scalar; [key: string]: unknown }; [key: string]: unknown }
export type Experiment = { status: string; transcripts?: { outcomes: string[]; probability0: string; probability1: string }[]; total_variation?: string; sufficient_records?: number | null; per_record_declared_charge?: string; nominal_batch_declared_charge?: string | null; target_error?: string; assumptions?: string[] }
export type Report = { status: string; conclusion: string; contract_name: string; contract_sha256: string; question: string; model_names: string[]; witness?: { actions: string[]; minimum_action_charge: string }; experiment?: Experiment; robust_experiment?: { status: string; records?: number | null; robust_gap_lower?: string; batch_declared_charge?: string | null; assumptions?: string[] }; scope: string[]; resources: { unit: string; calibration: string; included: string[]; excluded: string[] }; preparation: { description: string; iid_records: boolean } }
export type Verification = { verified: boolean; synthesis_repeated?: boolean; scope?: string }
export type Calibration = { status: string; description: string; recorded_results_match_exactly: boolean; data_origin: string; case: string; science_records: number; science_readouts: number; reference_readouts: number; confidence_event_count: number; design: { h: string; alpha_target: string; alpha_calibration: string; [key: string]: unknown }; calibration: { gain: string[]; width: string[]; status: string }; geometry: { entropy_lower: string; alpha: string; order_selected: number; order_results?: { order: number; entropy_lower: string; penalty_upper?: string }[] }; endpoint_baseline: { entropy_lower: string }; combined: { entropy_lower: string; selected_component: string; failure_probability_upper: string; joint_model_scope: string; scope_note: string }; scope: Record<string, string> }
export type InverseInput = { responses: string[][]; target: string[]; errors: string[]; observations: string[] }
export type InverseResult = InverseInput & { schema: string; identification: Record<string, unknown>; certificate: Record<string, unknown>; verification: Record<string, unknown> | null; estimate?: string; interval?: [string, string]; scope: string[] }
export type SweepResult = { kind: 'target_error' | 'calibration_radius'; points: { value: string; report: Report; verification: Verification }[]; all_verified: boolean }
export type Result = { report?: Report; verification?: Verification; calibration?: Calibration; inverse?: InverseResult; sweep?: SweepResult }
export type Mode = 'access' | 'inverse' | 'calibration' | 'notebook'
export type NotebookRun = { schema: '2dlabs-science-session-v2'; id: string; date: string; title: string; mode: Exclude<Mode, 'notebook'>; contract: string; inverse: InverseInput; result: Result; workspace_version: string; toolkit_version: string }
export const initialInverse: InverseInput = { responses: [['1', '1'], ['1/2', '1']], target: ['1', '0'], errors: ['1/100', '1/100'], observations: ['4', '5/2'] }
export const examples = [
  { id: 'active', label: 'Intervene', description: 'Find the control that reveals a hidden distinction.' },
  { id: 'passive', label: 'Observe', description: 'Test the limits of passive readout.' },
  { id: 'calibrated', label: 'Calibrate', description: 'Account for uncertainty in the complete record.' },
  { id: 'calibration_gap_closed', label: 'Find the limit', description: 'See when a robust certificate becomes inconclusive.' },
]
export function numeric(value: Scalar | null | undefined): number {
  if (value === null || value === undefined || value === '') return NaN
  if (typeof value === 'number') return value
  const [a, b = '1'] = value.split('/')
  const x = Number(a), y = Number(b)
  if (Number.isFinite(x) && Number.isFinite(y)) return x / y
  const leading = (v: string) => { const p = v.replace(/^[+-]/, '').replace(/^0+/, '') || '0'; return { m: Number(p.slice(0, 15)) / 10 ** (Math.min(15, p.length) - 1), e: p.length - 1, sign: v.startsWith('-') ? -1 : 1 } }
  const n = leading(a), d = leading(b)
  return n.sign * d.sign * n.m / d.m * 10 ** (n.e - d.e)
}
export function display(value: Scalar | null | undefined, digits = 5): string {
  if (value === null || value === undefined) return '—'
  if (String(value).length <= 18) return String(value)
  const n = numeric(value)
  return Number.isFinite(n) ? `≈ ${n.toPrecision(digits)}` : 'Outside display range'
}
export function decimal(value: Scalar | null | undefined): string {
  const n = numeric(value)
  if (!Number.isFinite(n)) return '—'
  return Math.abs(n) > 0 && (Math.abs(n) < .001 || Math.abs(n) >= 1000000) ? n.toExponential(3) : new Intl.NumberFormat('en', { maximumFractionDigits: 5 }).format(n)
}
// These guards protect the visual workspace; the released worker remains the
// authority on rational arithmetic, probability laws and scientific validity.
type JsonRecord = Record<string, unknown>
const record = (value: unknown): value is JsonRecord => !!value && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
const text = (value: unknown, maximum = 16384): value is string => typeof value === 'string' && value.length <= maximum
const scalar = (value: unknown): value is Scalar => text(value, 8192) || typeof value === 'number' && Number.isFinite(value)
const integer = (value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum
const list = (value: unknown, check: (item: unknown) => boolean, maximum: number, minimum = 0): value is unknown[] => Array.isArray(value) && value.length >= minimum && value.length <= maximum && value.every(check)
const strings = (value: unknown, maximum = 128, minimum = 0): value is string[] => list(value, item => text(item), maximum, minimum)
const optional = (value: unknown, check: (item: unknown) => boolean) => value === undefined || value === null || check(value)
const safeKey = (key: string) => key.length <= 256 && !['__proto__', 'prototype', 'constructor'].includes(key)
function safeTree(value: unknown, characterLimit = 2000000) {
  let nodes = 0, characters = 0
  const seen = new WeakSet<object>()
  function visit(item: unknown, depth: number): boolean {
    if (++nodes > 250000 || depth > 48) return false
    if (typeof item === 'string') { characters += item.length; return characters <= characterLimit }
    if (item === null || typeof item === 'boolean') return true
    if (typeof item === 'number') return Number.isFinite(item)
    if (typeof item !== 'object' || seen.has(item)) return false
    seen.add(item)
    if (Array.isArray(item)) return item.length <= 100000 && item.every(child => visit(child, depth + 1))
    if (!record(item)) return false
    const entries = Object.entries(item)
    if (entries.length > 512) return false
    return entries.every(([key, child]) => { characters += key.length; return safeKey(key) && characters <= characterLimit && visit(child, depth + 1) })
  }
  return visit(value, 0)
}
function contractShape(c: unknown): c is AccessContract {
  if (!record(c) || !text(c.name, 2000) || !text(c.question, 12000) || !Array.isArray(c.models) || c.models.length !== 2) return false
  if (!c.models.every(model => {
    if (!record(model) || !text(model.name, 2000) || !list(model.initial, scalar, 8, 1) || !record(model.actions)) return false
    const size = model.initial.length
    const actions = Object.entries(model.actions)
    return actions.length > 0 && actions.length <= 6 && actions.every(([name, outcomes]) => {
      if (!safeKey(name) || !record(outcomes)) return false
      const matrices = Object.entries(outcomes)
      return matrices.length > 0 && matrices.length <= 6 && matrices.every(([outcome, matrix]) => safeKey(outcome) && list(matrix, row => list(row, scalar, size, size), size, size))
    })
  })) return false
  if (!record(c.design) || !scalar(c.design.target_average_error) || !record(c.resources) || !text(c.resources.unit, 256) || !scalar(c.resources.per_record_overhead) || !record(c.resources.action_costs)) return false
  const costs = Object.entries(c.resources.action_costs)
  if (costs.length > 6 || !costs.every(([name, value]) => safeKey(name) && scalar(value))) return false
  return c.calibration === undefined || record(c.calibration) && list(c.calibration.record_tv_radii, scalar, 2, 2) && scalar(c.calibration.joint_failure_probability)
}
export function parseContract(source: string): AccessContract | null {
  try {
    if (typeof source !== 'string' || source.length > 200000 || new TextEncoder().encode(source).length > 200000) return null
    const value: unknown = JSON.parse(source)
    return safeTree(value, 200000) && contractShape(value) ? value : null
  } catch { return null }
}
export function isInverseInput(value: unknown): value is InverseInput {
  if (!record(value) || !strings(value.target, 3, 1) || !Array.isArray(value.responses) || value.responses.length < 1 || value.responses.length > 4) return false
  const width = value.target.length, rows = value.responses.length
  return value.target.every(item => text(item, 128)) && value.responses.every(row => strings(row, width, width) && row.every(item => text(item, 128))) && strings(value.errors, rows, rows) && value.errors.every(item => text(item, 128)) && strings(value.observations, rows, rows) && value.observations.every(item => text(item, 128))
}
function verificationShape(value: unknown): value is Verification {
  return record(value) && typeof value.verified === 'boolean' && optional(value.synthesis_repeated, item => typeof item === 'boolean') && optional(value.scope, item => text(item))
}
function experimentShape(value: unknown) {
  return record(value) && text(value.status, 256) && optional(value.transcripts, rows => list(rows, row => record(row) && strings(row.outcomes, 1024) && text(row.probability0) && text(row.probability1), 100000)) && optional(value.total_variation, item => text(item)) && optional(value.sufficient_records, integer) && optional(value.per_record_declared_charge, item => text(item)) && optional(value.nominal_batch_declared_charge, item => text(item)) && optional(value.target_error, item => text(item)) && optional(value.assumptions, strings)
}
function reportShape(value: unknown): value is Report {
  if (!record(value) || !text(value.status, 256) || !text(value.conclusion) || !text(value.contract_name, 2000) || !text(value.contract_sha256, 256) || !text(value.question) || !strings(value.model_names, 2, 2) || !strings(value.scope)) return false
  if (!record(value.resources) || !text(value.resources.unit, 256) || !text(value.resources.calibration) || !strings(value.resources.included) || !strings(value.resources.excluded) || !record(value.preparation) || !text(value.preparation.description) || typeof value.preparation.iid_records !== 'boolean') return false
  return optional(value.witness, item => record(item) && strings(item.actions, 1024) && text(item.minimum_action_charge)) && optional(value.experiment, experimentShape) && optional(value.robust_experiment, item => record(item) && text(item.status, 256) && optional(item.records, integer) && optional(item.robust_gap_lower, part => text(part)) && optional(item.batch_declared_charge, part => text(part)) && optional(item.assumptions, strings))
}
function calibrationShape(value: unknown): value is Calibration {
  if (!record(value) || !text(value.status, 256) || !text(value.description) || typeof value.recorded_results_match_exactly !== 'boolean' || !text(value.data_origin, 256) || !text(value.case, 256) || !integer(value.science_records) || !integer(value.science_readouts) || !integer(value.reference_readouts)) return false
  if (!optional(value.confidence_event_count, integer) || !optional(value.design, item => record(item) && text(item.h) && text(item.alpha_target) && text(item.alpha_calibration))) return false
  if (!optional(value.calibration, item => record(item) && strings(item.gain, 2, 2) && strings(item.width, 2, 2) && text(item.status, 256))) return false
  if (!record(value.geometry) || !text(value.geometry.entropy_lower) || !text(value.geometry.alpha) || !integer(value.geometry.order_selected, 128) || !optional(value.geometry.order_results, rows => list(rows, row => record(row) && integer(row.order, 128) && text(row.entropy_lower) && optional(row.penalty_upper, item => text(item)), 128))) return false
  if (!record(value.endpoint_baseline) || !text(value.endpoint_baseline.entropy_lower) || !record(value.combined) || !['entropy_lower', 'selected_component', 'failure_probability_upper', 'joint_model_scope', 'scope_note'].every(key => text((value.combined as JsonRecord)[key]))) return false
  return record(value.scope) && Object.keys(value.scope).length <= 128 && Object.values(value.scope).every(item => text(item))
}
function identificationShape(value: unknown, input: InverseInput) {
  return record(value) && integer(value.rank, Math.min(input.responses.length, input.target.length)) && integer(value.parameter_dimension, 3) && value.parameter_dimension === input.target.length && typeof value.identifiable === 'boolean' && optional(value.reconstruction_weights, item => strings(item, input.responses.length, input.responses.length)) && optional(value.weights, item => strings(item, input.responses.length, input.responses.length)) && optional(value.kernel_direction, item => strings(item, input.target.length, input.target.length)) && optional(value.target_difference, item => text(item)) && optional(value.indistinguishable_positive_parameters, item => list(item, row => strings(row, input.target.length, input.target.length), 2, 2))
}
function inverseShape(value: unknown): value is InverseResult {
  if (!record(value) || !isInverseInput(value)) return false
  const v = value as InverseInput & JsonRecord
  if (v.schema !== 'constructive-access-browser-inverse-v1' || !identificationShape(v.identification, v) || !record(v.certificate) || typeof v.certificate.finite !== 'boolean' || !strings(v.scope)) return false
  if (v.certificate.finite) return strings(v.certificate.weights, v.responses.length, v.responses.length) && strings(v.certificate.dual_direction, v.target.length, v.target.length) && text(v.certificate.absolute_error) && record(v.verification) && typeof v.verification.verified === 'boolean' && text(v.estimate) && strings(v.interval, 2, 2)
  return text(v.certificate.reason) && identificationShape(v.certificate.identification, v) && v.verification === null && v.estimate === undefined && v.interval === undefined
}
function sweepShape(value: unknown): value is SweepResult {
  return record(value) && ['target_error', 'calibration_radius'].includes(String(value.kind)) && typeof value.all_verified === 'boolean' && list(value.points, point => record(point) && text(point.value, 128) && reportShape(point.report) && verificationShape(point.verification), 9, 1)
}
export function isResult(value: unknown): value is Result {
  if (!record(value)) return false
  const alternatives = ['report', 'calibration', 'inverse', 'sweep'].filter(key => value[key] !== undefined)
  if (alternatives.length !== 1 || !optional(value.verification, verificationShape)) return false
  return value.report !== undefined ? reportShape(value.report) : value.calibration !== undefined ? calibrationShape(value.calibration) : value.inverse !== undefined ? inverseShape(value.inverse) : sweepShape(value.sweep)
}
export function download(value: unknown, name: string, mime = 'application/json') {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  const href = URL.createObjectURL(new Blob([text], { type: mime }))
  const link = document.createElement('a'); link.href = href; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}
export function isSession(value: unknown): value is NotebookRun {
  try {
    if (!safeTree(value) || !record(value)) return false
    const valid = value.schema === '2dlabs-science-session-v2' && text(value.id, 256) && value.id.length > 0 && text(value.title, 2000) && text(value.date, 80) && Number.isFinite(Date.parse(value.date)) && ['access', 'inverse', 'calibration'].includes(String(value.mode)) && text(value.contract, 200000) && new TextEncoder().encode(value.contract).length <= 200000 && isInverseInput(value.inverse) && isResult(value.result) && text(value.workspace_version, 64) && text(value.toolkit_version, 64)
    if (!valid || !record(value.result)) return false
    if (value.mode === 'inverse') return !!value.result.inverse
    if (value.mode === 'calibration') return !!value.result.calibration
    return parseContract(value.contract as string) !== null && !!(value.result.report || value.result.sweep)
  } catch { return false }
}
export function sessionTitle(result: Result): string { return result.report?.contract_name || (result.sweep ? `${result.sweep.kind === 'target_error' ? 'Target error' : 'Calibration'} sensitivity` : result.inverse ? 'Linear reconstruction' : 'Detector calibration / retained driven record') }
export function resultStatus(result: Result): string {
  if (result.report) return result.report.status === 'equivalent_under_declared_access' ? 'Access obstruction' : result.report.robust_experiment?.status === 'calibration_gap_not_certified' ? 'Robust gap closed' : 'Distinguishing witness'
  if (result.sweep) return `${result.sweep.points.length} checked designs`
  if (result.inverse) return result.inverse.interval ? 'Finite uncertainty bound' : 'Unidentifiable target'
  return 'Simulated record replay'
}
