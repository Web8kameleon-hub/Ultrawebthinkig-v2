import type { Metadata } from 'next'
import KloudBridge2026Panel from '@/components/KloudBridge2026Panel'

export const metadata: Metadata = {
  title: 'Kloud Bridge • Ultra 2026',
  description: 'Enterprise Kloud Bridge integration panel with live health status and direct Clisonix bridge connectivity.'
}

export default function KloudBridgePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,rgba(6,182,212,0.16),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(37,99,235,0.14),transparent_32%),#020617] px-4 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <KloudBridge2026Panel />
      </div>
    </main>
  )
}
