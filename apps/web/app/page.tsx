import type { Metadata } from 'next';
import HomePageClient from './HomePageClient';

export const metadata: Metadata = {
  title: 'Clisonix | Official Neural Intelligence Platform',
  description:
    'Official homepage of Clisonix at www.clisonix.com for AI workflows, EEG analysis, neural synthesis, and real-time analytics.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Clisonix | Official Neural Intelligence Platform',
    description:
      'Official homepage of Clisonix for AI workflows, EEG analysis, neural synthesis, and real-time analytics.',
    url: 'https://www.clisonix.com',
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
