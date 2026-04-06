import type { Metadata } from 'next';
import HomePageClient from './HomePageClient';

const HOME_OG_IMAGE = 'https://www.clisonix.com/icons/icon-512x512.png';

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
    images: [
      {
        url: HOME_OG_IMAGE,
        width: 512,
        height: 512,
        alt: 'Clisonix neural intelligence platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Clisonix | Official Neural Intelligence Platform',
    description:
      'Official Clisonix Cloud software platform for AI workflows, neuroscience research, EEG analysis, neural tooling, and real-time analytics.',
    images: [HOME_OG_IMAGE],
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
