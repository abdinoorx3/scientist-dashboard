# Third-party components and attribution

Original dashboard interface and adapter material use the Constructive Access Research and Revenue-Threshold License 1.0 in `LICENSE`. Each dependency and research asset retains its own applicable license.

- **Constructive Access 0.10.0:** The unmodified first-party wheel, reference PDF, core toolkit ZIP and illustrative inputs are included in `public/research-assets/`. Their license is `public/research-assets/LICENSE.txt`. Keep `THIRD_PARTY_NOTICES.txt` and the notices inside the wheel/ZIP. The research reference's embedded fonts have the accompanying notices under `public/research-assets/font_licenses/`. Original third-party experimental data described in the research notices belongs to the full research release, not this dashboard's sample set.
- **Pyodide 314.0.7:** Fetched from the pinned official distribution at build time. The supplied Mozilla Public License 2.0 text is retained as `public/research-assets/PYODIDE-LICENSE.txt`. Generated runtime distributions retain their upstream component terms. Sources: https://github.com/pyodide/pyodide and the source release for version 314.0.7.
- **CPython:** The runtime uses the Python version recorded in the pinned Pyodide lock file. Its supplied notice is `public/research-assets/PYTHON-LICENSE.txt`.
- **SymPy 1.14.0 and runtime mpmath:** The generated mathematical packages are fetched according to the official Pyodide lock file and verified against its digests. Their upstream license files remain in the package wheels.
- **mpmath 1.3.0:** This dependency is separately prepared from its unchanged official wheel to match the original reproduction environment; the upstream license remains inside the wheel at `mpmath-1.3.0.dist-info/LICENSE`. It takes precedence over the runtime's newer mpmath package for the research calculation.
- **Next.js 16.1.6, React 19.2.3, React DOM 19.2.3, TypeScript, ESLint and npm dependencies:** Versions are recorded in `package-lock.json`; their own licenses remain in their package distributions.

The dashboard does not relicense third-party material under its revenue threshold. Generated runtime files and third-party mathematical wheels are build artifacts rather than tracked source files.
