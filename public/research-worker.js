/* Browser adapter for the unmodified Constructive Access 0.10.0 wheel.
 * No uploaded Python is evaluated. Only the named research operations run.
 */
import { loadPyodide } from './runtime/pyodide/pyodide.mjs'
const researchAsset = name => new URL('./research-assets/' + name, import.meta.url).href
let runtimePromise
let running = false
const progress = message => self.postMessage({ type: 'progress', message })
const bytes = text => new TextEncoder().encode(text).length
const exactText = value => typeof value === 'string' && value.length <= 128 && /^[+-]?(?:\d+(?:\/[+-]?\d+)?|\d*\.\d+)$/.test(value.trim())
function validateRequest(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('A research request is required.')
  const { operation, contract, report, sweep, inverse } = data
  if (!['analyze', 'verify', 'calibration', 'sweep', 'inverse'].includes(operation)) throw new Error('Unsupported request.')
  if (['analyze', 'verify', 'sweep'].includes(operation) && (typeof contract !== 'string' || !contract.trim())) throw new Error('A contract is required.')
  if (contract !== undefined && (typeof contract !== 'string' || bytes(contract) > 200000)) throw new Error('The browser contract limit is 200 KB.')
  if (operation === 'verify' && (typeof report !== 'string' || !report.trim())) throw new Error('A report is required for verification.')
  if (report !== undefined && (typeof report !== 'string' || bytes(report) > 2000000)) throw new Error('The browser report limit is 2 MB.')
  if (operation === 'sweep') {
    if (!sweep || !['target_error', 'calibration_radius'].includes(sweep.kind) || !Array.isArray(sweep.values) || sweep.values.length < 1 || sweep.values.length > 9 || !sweep.values.every(exactText)) throw new Error('Choose a supported sweep with 1 to 9 exact rational values.')
  }
  if (operation === 'inverse') {
    if (!inverse || typeof inverse !== 'object' || !Array.isArray(inverse.responses) || inverse.responses.length < 1 || inverse.responses.length > 4 || !Array.isArray(inverse.target) || inverse.target.length < 1 || inverse.target.length > 3) throw new Error('Linear reconstruction supports 1 to 4 observations and 1 to 3 parameters.')
    const width = inverse.target.length
    if (!inverse.target.every(exactText) || !inverse.responses.every(row => Array.isArray(row) && row.length === width && row.every(exactText))) throw new Error('Enter an exact rational response matrix and target with matching dimensions.')
    if (!Array.isArray(inverse.errors) || inverse.errors.length !== inverse.responses.length || !inverse.errors.every(exactText)) throw new Error('Provide one nonnegative exact error radius per observation.')
    if (!Array.isArray(inverse.observations) || inverse.observations.length !== inverse.responses.length || !inverse.observations.every(exactText)) throw new Error('Provide one exact observed value per response row.')
  }
}
async function runtime() {
  if (!runtimePromise) runtimePromise = (async () => {
    progress('Loading the local Python runtime…')
    const py = await loadPyodide({ indexURL: new URL('./runtime/pyodide/', import.meta.url).href })
    progress('Loading exact-arithmetic dependencies…')
    await py.loadPackage(['sympy', 'mpmath'])
    const response = await fetch(researchAsset('constructive_access-0.10.0-py3-none-any.whl'))
    if (!response.ok) throw new Error('The research toolkit could not be loaded.')
    py.unpackArchive(await response.arrayBuffer(), 'zip', { extractDir: '/research-toolkit' })
    // Match the released reproduction dependency; the newer runtime bundles mpmath 1.4.
    const mathWheel = await fetch(researchAsset('mpmath-1.3.0-py3-none-any.whl'))
    if (!mathWheel.ok) throw new Error('The pinned arithmetic dependency could not be loaded.')
    py.unpackArchive(await mathWheel.arrayBuffer(), 'zip', { extractDir: '/research-toolkit' })
    await py.runPythonAsync(`
import sys, json
from fractions import Fraction
sys.path.insert(0, '/research-toolkit')
from constructive_access import load_contract, analyze, verify_report, identify_linear_target, minimax_certificate, verify_minimax_certificate

def browser_contract(text):
    if len(text.encode('utf-8')) > 200000:
        raise ValueError('The browser contract limit is 200 KB.')
    with open('/tmp/browser-contract.json', 'w', encoding='utf-8') as stream:
        stream.write(text)
    contract = load_contract('/tmp/browser-contract.json')
    data = contract.to_dict()
    # Computational limits affect browser eligibility, never the scientific contract.
    for model in data['models']:
        if len(model['initial']) > 8:
            raise ValueError('The browser supports at most 8 states per model. Use the downloadable toolkit for larger inputs.')
        if len(model['actions']) > 6 or any(len(outcomes) > 6 for outcomes in model['actions'].values()):
            raise ValueError('The browser supports at most 6 actions and 6 outcomes per action.')
    design = data['design']
    if design['max_transcripts'] > 100000 or design['max_precision_bits'] > 4096:
        raise ValueError('Browser limits: max_transcripts must be at most 100000 and max_precision_bits at most 4096.')
    return contract

def browser_sweep(base, options):
    source = browser_contract(base)
    points = []
    for value in options['values']:
        number = Fraction(value)
        data = source.to_dict()
        if options['kind'] == 'target_error':
            data['design']['target_average_error'] = str(number)
        else:
            if not 0 <= number <= 1:
                raise ValueError('Calibration radii must be between zero and one.')
            calibration = data.get('calibration', {
                'scope': 'whole_record_for_returned_protocol',
                'joint_failure_probability': '1/100',
                'justification': 'Illustrative assumed complete-record TV bounds, including preparation and readout. No laboratory calibration has been performed.'
            })
            calibration['record_tv_radii'] = [str(number), str(number)]
            calibration['justification'] += ' Sensitivity analysis replaces both radii with an assumed value; it does not measure calibration.'
            data['calibration'] = calibration
        current = load_contract(data)
        report = analyze(current)
        checked = verify_report(current, report)
        points.append({'value': str(number), 'report': report, 'verification': checked})
    return {'kind': options['kind'], 'points': points,
            'all_verified': all(point['verification']['verified'] for point in points),
            'source_contract_sha256': source.sha256,
            'scope': 'Sensitivity analysis of supplied model contracts, not new physical measurements. Each point has its own independently checked mathematical report.'}

def browser_inverse(options):
    responses, target, errors, observations = (
        options['responses'], options['target'], options['errors'], options['observations'])
    observed = list(map(Fraction, observations))
    identification = identify_linear_target(responses, target)
    certificate = minimax_certificate(responses, target, errors)
    checked = verify_minimax_certificate(responses, target, errors, certificate) if certificate['finite'] else None
    result = {'schema': 'constructive-access-browser-inverse-v1',
              'responses': responses, 'target': target, 'errors': errors,
              'observations': observations, 'identification': identification,
              'certificate': certificate, 'verification': checked,
              'scope': ['Known rational response matrix and a linear target over the full positive parameter domain.',
                        'The observation vector is assumed to satisfy the complete declared coordinatewise deterministic error box.',
                        'Mathematical checks do not establish physical response calibration, model adequacy, or experimental evidence.']}
    if certificate['finite']:
        estimate = sum((Fraction(weight)*value for weight, value in zip(certificate['weights'], observed)), Fraction(0))
        radius = Fraction(certificate['absolute_error'])
        result.update(estimate=str(estimate), interval=[str(estimate-radius), str(estimate+radius)])
    return result

def reject_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate report JSON key: ' + key)
        result[key] = value
    return result
`)
    return py
  })().catch(error => { runtimePromise = undefined; throw error })
  return runtimePromise
}
self.onmessage = async event => {
  if (running) return
  running = true
  try {
    validateRequest(event.data)
    const { operation, contract, report, sweep, inverse } = event.data
    const py = await runtime()
    if (operation === 'calibration') {
      progress('Replaying the retained simulated calibration dataset…')
      const [tutorial, fixture] = await Promise.all(['calibration_tutorial.py', 'calibration_counts.json'].map(async name => {
        const response = await fetch(researchAsset(name))
        if (!response.ok) throw new Error('The calibration release files could not be loaded.')
        return response.text()
      }))
      py.FS.mkdirTree('/research-examples')
      py.FS.writeFile('/research-examples/calibration_tutorial.py', tutorial)
      py.globals.set('_fixture_text', fixture)
      const value = await py.runPythonAsync(`
import importlib.util, hashlib
spec = importlib.util.spec_from_file_location('release_calibration_tutorial', '/research-examples/calibration_tutorial.py')
tutorial = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tutorial)
cert = tutorial.certification_module()
fixture = json.loads(_fixture_text)
if hashlib.sha256(open(cert.__file__, 'rb').read()).hexdigest() != fixture['contract']['source_sha256']['code/certification.py']:
    raise ValueError('Calibration source does not match the retained dataset contract.')
calibration_result = tutorial.replay(fixture, cert)
calibration_result['combination_branch_checks'] = tutorial.validate_combination_fixture()
json.dumps({'calibration': cert.jsonable(calibration_result)})
`)
      self.postMessage({ type: 'result', result: JSON.parse(value) })
      return
    }
    if (operation === 'sweep') {
      py.globals.set('_contract_text', contract)
      // Yield between points so progress is visible and terminating the worker cancels the sweep.
      const points = []
      let metadata
      for (let index = 0; index < sweep.values.length; index++) {
        progress(`Checking sweep point ${index + 1} of ${sweep.values.length}…`)
        py.globals.set('_sweep_options_text', JSON.stringify({ kind: sweep.kind, values: [sweep.values[index]] }))
        const value = await py.runPythonAsync("json.dumps({'sweep': browser_sweep(_contract_text, json.loads(_sweep_options_text))})")
        const point = JSON.parse(value).sweep
        points.push(point.points[0])
        metadata = point
      }
      self.postMessage({ type: 'result', result: { sweep: { ...metadata, points, all_verified: points.every(point => point.verification.verified === true) } } })
      return
    }
    if (operation === 'inverse') {
      progress('Solving and independently checking the exact reconstruction…')
      py.globals.set('_inverse_options_text', JSON.stringify(inverse))
      const value = await py.runPythonAsync("json.dumps({'inverse': browser_inverse(json.loads(_inverse_options_text))})")
      self.postMessage({ type: 'result', result: JSON.parse(value) })
      return
    }
    py.globals.set('_contract_text', contract)
    py.globals.set('_report_text', operation === 'verify' ? report : '')
    progress(operation === 'analyze' ? 'Synthesizing and checking the certificate…' : 'Checking the report against the supplied contract…')
    const code = operation === 'analyze' ? `
_contract = browser_contract(_contract_text)
_report = analyze(_contract)
_verification = verify_report(_contract, _report)
json.dumps({'report': _report, 'verification': _verification})
` : `
_contract = browser_contract(_contract_text)
_report = json.loads(_report_text, object_pairs_hook=reject_duplicate_keys)
_verification = verify_report(_contract, _report)
json.dumps({'report': _report, 'verification': _verification})
`
    const result = JSON.parse(await py.runPythonAsync(code))
    self.postMessage({ type: 'result', result })
  } catch (error) {
    const detail = error.message || 'The calculation could not be completed.'
    const message = detail.trim().split('\n').filter(Boolean).at(-1).replace(/^[\w.]+(?:Error|Exception):\s*/, '')
    self.postMessage({ type: 'error', message })
  } finally { running = false }
}
