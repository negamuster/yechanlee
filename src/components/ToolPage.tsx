import type { ReactNode } from 'react'
import '../pages/Tools.css'

export default function ToolPage({ title, description, className, children }: {
  title: string; description: string; className: string; children: ReactNode
}) {
  return <div className={`financial-tool-page ${className}`}>
    <main className="financial-tool-content">
      <header className="tool-page-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      {children}
    </main>
    <footer className="tool-footer">Anthracite © 2026</footer>
  </div>
}
