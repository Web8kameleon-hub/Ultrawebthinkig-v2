import type { Metadata } from 'next';
import HomePageClient from './HomePageClient';

export const metadata: Metadata = {
  title: 'Clisonix | Official Neural Intelligence Platform',
  description:
    'Official homepage of Clisonix, the AI and neuroscience software platform at www.clisonix.com for workflows, EEG analysis, neural synthesis, and real-time analytics.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Clisonix | Official Neural Intelligence Platform',
    description:
      'Official homepage of Clisonix, the AI and neuroscience software platform for workflows, EEG analysis, neural synthesis, and real-time analytics.',
    url: 'https://www.clisonix.com',
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
