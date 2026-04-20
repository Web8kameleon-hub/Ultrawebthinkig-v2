/**
 * Clisonix Modules Layout
 * Advanced neuroacoustic processing, EEG analysis, and industrial monitoring
 */

import { Metadata } from 'next'
import ModuleDocsDock from '../../src/components/module-docs/ModuleDocsDock'

export const metadata: Metadata = {
  title: {
    default: 'Clisonix Modules | AI Chat, EEG, Research and Data Tools',
    template: '%s | Clisonix Modules',
  },
  description:
    'Explore Clisonix modules for AI chat, web reading, document research, EEG analysis, neural workflows, and real-time data tooling on www.clisonix.com.',
  keywords: [
    'clisonix modules',
    'official clisonix modules',
    'clisonix.com modules',
    'ai chat modules',
    'enterprise ai chat',
    'ai assistant platform',
    'ai modules',
    'curiosity ocean',
    'openmind ai chat',
    'web reader ai',
    'specialized expert chat',
    'chat with web pages',
    'chat with documents',
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
    title: 'Clisonix Modules | AI Chat, EEG, Research and Data Tools',
    description:
      'Browse Clisonix module pages for AI chat, web and document research, EEG intelligence, and developer workflows.',
    url: 'https://www.clisonix.com/modules',
    siteName: 'Clisonix',
    type: 'website',
    images: [
      {
        url: 'https://www.clisonix.com/icons/icon-512x512.png',
        width: 512,
        height: 512,
        alt: 'Clisonix modules and AI chat platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Clisonix Modules | AI Chat, EEG, Research and Data Tools',
    description:
      'Find Clisonix modules for AI chat, research automation, EEG analysis, and production intelligence workflows.',
    images: ['https://www.clisonix.com/icons/icon-512x512.png'],
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








