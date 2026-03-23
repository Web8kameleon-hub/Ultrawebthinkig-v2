/**
 * Clisonix Modules Layout
 * Advanced neuroacoustic processing, EEG analysis, and industrial monitoring
 */

import { Metadata } from 'next'
import ModuleDocsDock from '../../src/components/module-docs/ModuleDocsDock'

export const metadata: Metadata = {
  title: 'Clisonix Modules - Advanced Neural Processing',
  description: 'Industrial-grade EEG analysis, neuroacoustic conversion, biofeedback training, and spectrum analysis',
  keywords: [
    'clisonix modules',
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
    title: 'Clisonix Modules',
    description: 'Explore AI, research, EEG, weather and data modules in Clisonix Cloud.',
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








