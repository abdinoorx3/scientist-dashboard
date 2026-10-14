// Exercise the shipped worker adapter with its real local Pyodide runtime and release wheel.
// Only asset transport is adapted from browser URLs to local files; no scientific code is mocked.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import vm from 'node:vm'
import { loadPyodide } from '../public/runtime/pyodide/pyodide.mjs'

const publicRoot = path.resolve(fileURLToPath(new URL('../public/', import.meta.url)))
const source = await readFile(path.join(publicRoot, 'research-worker.js'), 'utf8')
const messages = []
let initializeAttempts = 0
const worker = { postMessage: message => messages.push(message) }
const context = vm.createContext({
  self: worker, TextEncoder, URL, console,
  loadPyodide: async () => {
    initializeAttempts++
    if (initializeAttempts === 1) throw new Error('Expected initialization failure for retry test.')
    return loadPyodide({ indexURL: path.join(publicRoot, 'runtime/pyodide/') })
  },
  fetch: async url => {
    assert.equal(typeof url, 'string')
    const asset = new URL(url)
    assert.equal(asset.origin, 'https://dashboard.test')
    assert.ok(asset.pathname.startsWith('/scientist-dashboard/'))
    const filename = path.resolve(publicRoot, `.${asset.pathname.slice('/scientist-dashboard'.length)}`)
    assert.ok(filename.startsWith(publicRoot + path.sep), 'Only public local assets may be read.')
    const data = await readFile(filename)
    return { ok: true, text: async () => data.toString('utf8'), arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) }
  },
})
vm.runInContext(source.replace(/^import \{ loadPyodide \} from '[^']+'\n/m, '').replaceAll('import.meta.url', JSON.stringify('https://dashboard.test/scientist-dashboard/research-worker.js')), context, { filename: 'research-worker.js' })

async function request(data) {
  messages.length = 0
  await worker.onmessage({ data })
  const final = messages.filter(message => message.type !== 'progress')
  assert.equal(final.length, 1, 'A request must produce exactly one result or error.')
  return final[0]
}
async function result(data) {
  const message = await request(data)
  assert.equal(message.type, 'result', message.message)
  return message.result
}
async function rejects(data, expected) {
  const message = await request(data)
  assert.equal(message.type, 'error')
  assert.match(message.message, expected)
}
const fixture = async name => readFile(path.join(publicRoot, 'research-assets', name), 'utf8')
const active = await fixture('active.json')
const passive = await fixture('passive.json')

await rejects({ operation: 'analyze', contract: active }, /Expected initialization failure/)
const analyzed = await result({ operation: 'analyze', contract: active })
assert.equal(initializeAttempts, 2, 'Rejected runtime initialization must be retryable.')
assert.equal(analyzed.verification.verified, true)
assert.equal(analyzed.report.experiment.sufficient_records, 12)
assert.deepEqual(Array.from(analyzed.report.witness.actions), ['drive', 'read'])
console.log('PASS: real-runtime initialization retry and exact active analysis')

const obstructed = await result({ operation: 'analyze', contract: passive })
assert.equal(obstructed.report.status, 'equivalent_under_declared_access')
assert.equal(obstructed.verification.verified, true)
const verified = await result({ operation: 'verify', contract: active, report: JSON.stringify(analyzed.report) })
assert.equal(verified.verification.verified, true)
const tampered = structuredClone(analyzed.report)
tampered.experiment.sufficient_records++
await rejects({ operation: 'verify', contract: active, report: JSON.stringify(tampered) }, /differ from independently recomputed/)
await rejects({ operation: 'verify', contract: passive, report: JSON.stringify(analyzed.report) }, /different supplied contract/)
await rejects({ operation: 'verify', contract: active, report: '{"schema":"a","schema":"b"}' }, /Duplicate report JSON key/)
console.log('PASS: exact obstruction, report replay, tampering and contract substitution rejection')

const errorSweep = await result({ operation: 'sweep', contract: active, sweep: { kind: 'target_error', values: ['1/4', '1/10', '1/100', '1/1000'] } })
assert.equal(errorSweep.sweep.all_verified, true)
assert.deepEqual(Array.from(errorSweep.sweep.points, point => point.report.experiment.sufficient_records), [1, 12, 28, 44])
assert.equal(new Set(errorSweep.sweep.points.map(point => point.report.contract_sha256)).size, 4)
const radiusSweep = await result({ operation: 'sweep', contract: active, sweep: { kind: 'calibration_radius', values: ['0', '1/100', '1/10', '1/4'] } })
assert.equal(radiusSweep.sweep.all_verified, true)
assert.deepEqual(Array.from(radiusSweep.sweep.points.slice(0, 3), point => point.report.robust_experiment.records), [20, 21, 54])
assert.equal(radiusSweep.sweep.points[3].report.robust_experiment.status, 'calibration_gap_not_certified')
assert.equal(radiusSweep.sweep.points[1].report.robust_experiment.joint_calibration_failure_probability, '1/100')
const calibrated = JSON.parse(await fixture('calibrated.json'))
calibrated.calibration.joint_failure_probability = '1/50'
const retainedFailure = await result({ operation: 'sweep', contract: JSON.stringify(calibrated), sweep: { kind: 'calibration_radius', values: ['1/100'] } })
assert.equal(retainedFailure.sweep.points[0].report.robust_experiment.joint_calibration_failure_probability, '1/50')
console.log('PASS: verified target-error and calibration-radius sweeps, gap closure and preserved calibration confidence')

const inverseInput = { responses: [['1', '1'], ['1/2', '1']], target: ['1', '0'], errors: ['1/100', '1/100'], observations: ['4', '5/2'] }
const inverse = (await result({ operation: 'inverse', inverse: inverseInput })).inverse
assert.equal(inverse.schema, 'constructive-access-browser-inverse-v1')
assert.equal(inverse.identification.identifiable, true)
assert.equal(inverse.certificate.absolute_error, '1/25')
assert.equal(inverse.verification.verified, true)
assert.equal(inverse.estimate, '3')
assert.deepEqual(Array.from(inverse.interval), ['74/25', '76/25'])
const singular = (await result({ operation: 'inverse', inverse: { ...inverseInput, responses: [['1', '1'], ['1', '1']] } })).inverse
assert.equal(singular.identification.identifiable, false)
assert.equal(singular.certificate.finite, false)
assert.equal(singular.verification, null)
assert.equal('estimate' in singular, false)
assert.ok(singular.identification.indistinguishable_positive_parameters.length === 2)
const illConditioned = (await result({ operation: 'inverse', inverse: { ...inverseInput, responses: [['1', '1'], ['1000001/1000000', '1']] } })).inverse
assert.equal(illConditioned.certificate.absolute_error, '20000')
console.log('PASS: independently verified reconstruction, positive-parameter obstruction and ill-conditioned exact example')

const calibration = (await result({ operation: 'calibration' })).calibration
assert.equal(calibration.recorded_results_match_exactly, true)
assert.equal(calibration.combination_branch_checks.status, 'passed')
assert.equal(calibration.geometry.order_selected, 0)
assert.ok(calibration.geometry.order_results.length === 2)
console.log('PASS: unchanged frozen detector replay and rich calibration outputs')

await rejects({ operation: 'other' }, /Unsupported request/)
await rejects({ operation: 'sweep', contract: active, sweep: { kind: 'target_error', values: Array(10).fill('1/10') } }, /1 to 9/)
await rejects({ operation: 'sweep', contract: active, sweep: { kind: 'target_error', values: ['1/2'] } }, /strictly between zero and one half/)
await rejects({ operation: 'sweep', contract: active, sweep: { kind: 'calibration_radius', values: ['-1/10'] } }, /between zero and one/)
await rejects({ operation: 'inverse', inverse: { ...inverseInput, errors: ['-1/100', '1/100'] } }, /nonnegative error radius/)
await rejects({ operation: 'inverse', inverse: { ...inverseInput, responses: [['1'], ['1']] } }, /matching dimensions/)
await rejects({ operation: 'inverse', inverse: { ...inverseInput, observations: ['4', 2.5] } }, /exact observed value/)
await rejects({ operation: 'inverse', inverse: { ...inverseInput, target: ['1', '0', '0', '0'] } }, /1 to 3 parameters/)
await rejects({ operation: 'analyze', contract: 'é'.repeat(100001) }, /200 KB/)
await rejects({ operation: 'verify', contract: active, report: 'x'.repeat(2000001) }, /2 MB/)
await rejects({ operation: 'analyze', contract: active.replace('"1/2"', '0.5') }, /never a float/)
console.log('PASS: rejected unsupported operations, size limits, malformed dimensions, floats and invalid rational domains')
console.log('Dashboard worker checks passed against the unchanged public release wheel.')
