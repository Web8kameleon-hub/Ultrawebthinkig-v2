/**
 * Clisonix Modules Layout
 * Advanced neuroacoustic processing, EEG analysis, and industrial monitoring
 */

import { Metadata } from 'next'
import ModuleDocsDock from '../../src/components/module-docs/ModuleDocsDock'

export const metadata: Metadata = {
  title: 'Clisonix Modules | Official AI, EEG and Research Tools',
  description:
    'Explore the official Clisonix modules at www.clisonix.com for AI chat, EEG analysis, research workflows, weather intelligence, and real-time data tooling.',
  keywords: [
    'clisonix modules',
    'official clisonix modules',
    'clisonix.com modules',
    'ai modules',
    'curiosity ocean',
    'web reader ai',
    'archive research ai',
    'eeg analysis',
    'neural synthesis',
    'aviation weather',
    'social intelligence',
    'specialized expert chat',
    'data dashboard',
    'cognitive analytics',
  ],
  alternates: {
    canonical: '/modules',
  },
  openGraph: {
    title: 'Clisonix Modules | Official Platform Tools',
    description:
      'Explore the official AI, research, EEG, weather and data modules available on Clisonix at www.clisonix.com.',
    url: 'https://www.clisonix.com/modules',
    siteName: 'Clisonix',
    type: 'website',
  },
}

export default function ModulesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {children}
      </div>
      <ModuleDocsDock />
    </div>
  )
}








