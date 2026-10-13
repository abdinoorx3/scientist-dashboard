# Scientist Dashboard

**[Use the live dashboard at 2dlabs.org/dashboard](https://2dlabs.org/dashboard).**

This is the standalone browser workspace for **Constructive Access — Abdinoor, 2D Labs**. It runs the released research toolkit 0.10.0 in a dedicated browser worker. The dashboard interface, worker and released inputs are preserved from the working live dashboard; the enclosing navigation is specific to this software repository.

The flagship research, complete scientific sources and full datasets are published separately at **[abdinoorx3/constructive-access](https://github.com/abdinoorx3/constructive-access)**. This repository contains the dashboard, not the 2D Labs company website.

## Workflows

- Analyze a JSON access contract comparing exactly two finite classical instruments with rational coefficients.
- Independently check a report against its supplied contract.
- Load the released active, passive, calibrated and calibration-gap-closed examples.
- Replay a retained **simulated** detector-calibration record through the original exact-arithmetic tutorial.
- Export exact JSON results and keep up to six saved runs in the current browser. A saved copy needs a fresh verifier run to be freshly verified.

The interface retains the scientific boundaries: a supplied calculation does not establish physical calibration, model adequacy or physical validation. Exact model access, finite-error inference and measured physical evidence are distinct. Decimal displays are approximations; exported reports retain exact rational values. The dashboard does not execute the entire research compendium's simulation bank.

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
```

The static result is in `out/`. Serve that directory from the origin root with clean-URL support; for a local preview:

```sh
python3 -m http.server 4173 --directory out
```

Open http://localhost:4173. The default build serves from the origin root. For hosting under a subpath (for example GitHub Pages), set `NEXT_PUBLIC_DASHBOARD_BASE_PATH=/scientist-dashboard` for the build; the same setting prefixes client assets and Next.js routes, while the worker resolves its runtime and research assets relative to its own URL. Serve `out/` at that prefix. No publishing credentials or company hosting configuration are included.

## Pinned runtime and released inputs

`scripts/prepare-browser-runtime.mjs` prepares the official **Pyodide 314.0.7** runtime, its exact SymPy/runtime mpmath packages, and the official **mpmath 1.3.0** overlay required by the research release. Downloads are verified against retained SHA-256 digests. Generated third-party runtime files and the mpmath overlay wheel are ignored by Git. The first preparation needs access to the official runtime distribution and Python package index.

`RELEASE_INPUTS.json` records the original and publication hashes of the client and worker, plus unchanged dashboard CSS, first-party toolkit wheel, core toolkit ZIP, scientific reference, license notices and sample/replay inputs. `npm run verify:inputs` checks the publication bytes. Client and worker adaptations only resolve asset paths and isolate software repository links; embedded scientific Python remains identical. The runtime preparer makes the standalone build reproducible and verifies its generated assets. No scientific toolkit code, tutorial, fixture or result is modified.

## Browser limits and local data

Contracts are limited to 200,000 UTF-8 bytes, eight states per model, six actions, six outcomes per action, 100,000 maximum transcripts and 4,096 maximum precision bits. Reports are limited to 2,000,000 characters. Runtime initialization is bounded by 120 seconds and calculation by 45 seconds; cancellation terminates the worker. Use the downloadable toolkit for larger inputs.

Calculations and saved runs stay in the current browser. The software loads its runtime and release inputs over HTTP; it does not upload contracts or reports to an application server, accept executable Python uploads or collect payment information. Local browser storage can be unavailable or cleared; export reports to keep them.

## License

Original dashboard material and research inputs are source-available under the included **Constructive Access Research and Revenue-Threshold License 1.0**. Academic research and qualifying business use at or below **US$10 million worldwide group revenue over the trailing twelve months** are permitted subject to its conditions. Business use above that threshold requires a separate written commercial license. `LICENSE` contains the controlling terms; contact helloworld@2dai.org for commercial terms.

Third-party material retains its original terms and notices. See `THIRD_PARTY_NOTICES.md` and the licenses distributed with the research assets and runtime packages.
