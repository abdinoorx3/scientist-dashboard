/* Browser adapter for the unmodified Constructive Access 0.10.0 wheel.
 * No uploaded Python is evaluated. Only the named analyze/verify operations run.
 */
import { loadPyodide } from './runtime/pyodide/pyodide.mjs'
const researchAsset = name => new URL('./research-assets/' + name, import.meta.url).href
let runtimePromise
let running = false
const progress = message => self.postMessage({ type: 'progress', message })
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
sys.path.insert(0, '/research-toolkit')
from constructive_access import load_contract, analyze, verify_report

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

def reject_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate report JSON key: ' + key)
        result[key] = value
    return result
`)
    return py
  })()
  return runtimePromise
}
self.onmessage = async event => {
  if (running) return
  running = true
  try {
    const { operation, contract, report } = event.data
    if (!['analyze', 'verify', 'calibration'].includes(operation)) throw new Error('Unsupported request.')
    if (operation !== 'calibration' && typeof contract !== 'string') throw new Error('A contract is required.')
    if ((contract && contract.length > 200000) || (report && report.length > 2000000)) throw new Error('Input exceeds the browser size limit.')
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
