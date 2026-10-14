import type { Metadata } from 'next'
import './globals.css'
import { assetPath } from './asset-path'

export const metadata: Metadata = {
  title: 'Scientist Dashboard — Constructive Access / 2D Labs',
  description: 'Design exact access experiments, inspect hidden-state models, run verified sensitivity sweeps, reconstruct linear targets with minimax bounds, and replay retained simulated detector records in your browser.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="dashboard-header">
      <a href={assetPath('/')}>Scientist Dashboard<span>CONSTRUCTIVE ACCESS / 2D LABS</span></a>
      <nav aria-label="Dashboard resources">
        <a href="https://2dlabs.org/dashboard">Live dashboard ↗</a>
        <a href="https://github.com/abdinoorx3/constructive-access">Research & toolkit ↗</a>
        <a href={assetPath('/research-assets/LICENSE.txt')}>License ↗</a>
      </nav>
    </header>
    <main id="main-content">{children}</main>
    <footer className="dashboard-footer"><span>Constructive Access — Abdinoor, 2D Labs</span><a href="https://2dlabs.org">2D Labs ↗</a></footer>
  </body></html>
}
