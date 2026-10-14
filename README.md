# Scientist Dashboard

**[Use the live dashboard at 2dlabs.org/dashboard](https://2dlabs.org/dashboard).**

This is the standalone browser workspace for **Constructive Access — Abdinoor, 2D Labs**. Dashboard **1.1.0** runs the released research toolkit **0.10.0** in a dedicated browser worker. It combines editable models, exact calculations, visual diagnostics and a local research notebook. The enclosing navigation is specific to this software repository.

The flagship research, complete scientific sources and full datasets are published separately at **[abdinoorx3/constructive-access](https://github.com/abdinoorx3/constructive-access)**. This repository contains the dashboard, not the 2D Labs company website.

## Workflows

- **Design an access experiment.** Load the released active, passive, calibrated or calibration-gap-closed example; inspect model matrices and edit the contract through visual controls or exact JSON. Analyze exactly two finite classical instruments with rational coefficients, then inspect the distinguishing protocol, complete-record laws and declared resource costs.
- **Check the calculation.** Independently verify a supplied report against its contract, including the assumptions and physical resource ledger that give the result its scope.
- **Explore sensitivity.** Sweep target error or assumed calibration radius and compare verified results, record counts and declared batch charges. Each point is a fresh calculation and verification using the toolkit. An assumed calibration radius is a sensitivity input, not a measured calibration.
- **Reconstruct a linear target.** Enter a known rational response matrix, target, observations and deterministic error bounds. Inspect exact identification and an independently checked minimax certificate when the target is identifiable, or an obstruction when the supplied access does not identify it.
- **Replay detector calibration.** Reproduce the retained **simulated** detector-calibration record through the original exact-arithmetic tutorial, then inspect the geometry, endpoint and combined lower bounds under their declared confidence event and physical premises.
- **Keep a research notebook.** Save and compare runs in the current browser, or import/export a notebook with the calculation inputs and outputs needed to revisit the work. Saved or imported results remain historical copies until freshly recomputed or verified.

The interface retains the scientific boundaries: a supplied calculation does not establish physical calibration, model adequacy or physical validation. Exact model access, finite-error inference and measured physical evidence are distinct. Decimal displays and charts are approximations; exported reports retain exact rational values. The dashboard does not execute the entire research compendium's simulation bank.

## Version 1.1.0

This release expands the original contract-and-replay interface into a multi-workflow research workspace. It adds visual contract exploration, verified sensitivity sweeps, exact linear-target reconstruction and obstruction checks, richer detector-replay diagnostics, and notebook import/export and comparison. The changes are in the browser interface and adapter. The released toolkit wheel, reference paper, scientific tutorials, frozen records, example contracts and license terms are unchanged.

## Run and build

Use Node.js 20.9 or later (CI uses Node.js 22) and npm:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Both `/` and `/dashboard` expose the workspace. For a production static export:

```sh
npm run lint
npm run build
npm run typecheck
npm run verify:worker
```

The static result is in `out/`. Serve that directory from the origin root with clean-URL support; for a local preview:

```sh
python3 -m http.server 4173 --directory out
```

Open http://localhost:4173. The default build serves from the origin root. For hosting under a subpath (for example GitHub Pages), set `NEXT_PUBLIC_DASHBOARD_BASE_PATH=/scientist-dashboard` for the build; the same setting prefixes client assets and Next.js routes, while the worker resolves its runtime and research assets relative to its own URL. Serve `out/` at that prefix. No publishing credentials or company hosting configuration are included.

## Pinned runtime and released inputs

`scripts/prepare-browser-runtime.mjs` prepares the official **Pyodide 314.0.7** runtime, its exact SymPy/runtime mpmath packages, and the official **mpmath 1.3.0** overlay required by the research release. Downloads are verified against retained SHA-256 digests. Generated third-party runtime files and the mpmath overlay wheel are ignored by Git. The first preparation needs access to the official runtime distribution and Python package index.

`RELEASE_INPUTS.json` records hashes for the published dashboard interface, helpers and worker, together with the first-party toolkit wheel, core toolkit ZIP, scientific reference, license notices and sample/replay inputs. It retains the original publication baseline separately. `npm run verify:inputs` checks the publication bytes. The browser adapter selects bounded operations from the released toolkit and checks the returned certificates; the standalone distribution resolves asset paths independently of the company website. The runtime preparer makes the standalone build reproducible and verifies its generated assets. No released scientific toolkit code, tutorial, fixture or retained result is modified.

`npm run verify:worker` exercises the shipped worker with the real local Pyodide runtime and unchanged toolkit wheel. It covers independent report checks, tampering and contract substitution rejection, initialization retry, verified sensitivity sweeps, linear identification and obstruction cases, exact minimax bounds, frozen detector replay and bounded input rejection. Its asset transport checks worker-relative URLs under a standalone hosting subpath; scientific code is not mocked.

## Browser limits and local data

Contracts are limited to 200,000 UTF-8 bytes, eight states per model, six actions, six outcomes per action, 100,000 maximum transcripts and 4,096 maximum precision bits. Reports are limited to 2,000,000 UTF-8 bytes. Sensitivity sweeps accept up to nine exact rational values. Linear reconstruction accepts up to four response rows and three parameters. Runtime initialization and calculations are time-limited; cancellation terminates the worker. Use the downloadable toolkit for larger inputs.

Calculations and saved runs stay in the current browser. The software loads its runtime and release inputs from the server; it does not upload contracts, observations, reports or notebooks to an application server, accept executable Python uploads or collect payment information. Importing a notebook restores data rather than executing uploaded code. Local browser storage can be unavailable or cleared; export reports or notebooks to keep them.

## License

Original dashboard material and research inputs are source-available under the included **Constructive Access Research and Revenue-Threshold License 1.0**. Academic research and qualifying business use at or below **US$10 million worldwide group revenue over the trailing twelve months** are permitted subject to its conditions. Business use above that threshold requires a separate written commercial license. `LICENSE` contains the controlling terms; contact helloworld@2dai.org for commercial terms.

Third-party material retains its original terms and notices. See `THIRD_PARTY_NOTICES.md` and the licenses distributed with the research assets and runtime packages.
