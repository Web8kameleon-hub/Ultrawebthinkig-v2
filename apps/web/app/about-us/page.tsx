import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS_IDENTITY, formatBusinessAddress } from '../lib/business-identity';

export const metadata: Metadata = {
  title: 'About Us | Clisonix Cloud Official Platform Overview',
  description:
    'Learn what Clisonix is, what Clisonix Cloud offers, and where to find the official platform, AI modules, and developer resources.',
  alternates: {
    canonical: '/about-us',
  },
  openGraph: {
    title: 'About Clisonix | Official Platform Overview',
    description:
      'Official overview of Clisonix Cloud, Curiosity Ocean, KLOUd Bridge, and the developer-focused AI platform at www.clisonix.com.',
    url: 'https://www.clisonix.com/about-us',
  },
};

const highlights = [
  {
    title: 'Official domain',
    body: 'The official Clisonix platform is hosted at www.clisonix.com and includes company pages, developer docs, AI modules, and platform infrastructure references.',
  },
  {
    title: 'Core products',
    body: 'Clisonix Cloud brings together Curiosity Ocean, Web Reader, KLOUd Bridge, EEG workflows, analytics tools, and production-oriented AI services.',
  },
  {
    title: 'Built for real use',
    body: 'The platform includes billing, authentication, observability, service health endpoints, SDKs, and deployment-ready architecture rather than a demo-only surface.',
  },
];

export default function AboutUsPage() {
  const officeAddress = formatBusinessAddress();

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-300">About Clisonix</p>
          <h1 className="mt-4 text-4xl font-bold md:text-5xl">Clisonix is the official AI and neural intelligence platform at www.clisonix.com</h1>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            Clisonix Cloud is a developer-focused platform for AI workflows, research, multimodal tools, neural and EEG analysis,
            and real-time operational systems. This page exists to make the official brand identity easier to verify for search engines,
            partners, and users.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {highlights.map((item) => (
            <section key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h2 className="text-xl font-semibold text-white">{item.title}</h2>
              <p className="mt-3 leading-7 text-slate-300">{item.body}</p>
            </section>
          ))}
        </div>

        <section className="mt-10 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6">
          <h2 className="text-2xl font-semibold">What you can verify here</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-200">
            <li>Clisonix and Clisonix Cloud branding on official product and company pages</li>
            <li>Curiosity Ocean, KLOUd Bridge, and developer tools as live platform surfaces</li>
            <li>Documentation, platform details, and trust pages available under the same official domain</li>
          </ul>
        </section>

        <section className="mt-10 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-2xl font-semibold">Verified Business Identity</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-700 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Legal Entity</p>
              <p className="mt-2 font-semibold text-white">{BUSINESS_IDENTITY.legalName}</p>
            </div>
            <div className="rounded-xl border border-slate-700 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Registration Number</p>
              <p className="mt-2 font-semibold text-white">{BUSINESS_IDENTITY.registrationNumber}</p>
            </div>
            <div className="rounded-xl border border-slate-700 p-4 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Operational Office</p>
              <p className="mt-2 font-semibold text-white">{officeAddress}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-300">
            Official contact and legal pages: <Link href="/contact" className="text-emerald-300 hover:text-emerald-200">Contact</Link>,{' '}
            <Link href="/privacy" className="text-emerald-300 hover:text-emerald-200">Privacy Policy</Link>,{' '}
            <Link href="/terms" className="text-emerald-300 hover:text-emerald-200">Terms & Conditions</Link>,{' '}
            <Link href="/refund-policy" className="text-emerald-300 hover:text-emerald-200">Refund Policy</Link>.
          </p>
        </section>

        <section className="mt-10 flex flex-wrap gap-3">
          <Link href="/contact" className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500">
            Contact
          </Link>
          <Link href="/company" className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500">
            Company
          </Link>
          <Link href="/platform" className="rounded-lg border border-slate-700 px-4 py-2 text-slate-200 hover:bg-slate-800">
            Platform
          </Link>
          <Link href="/faq" className="rounded-lg border border-slate-700 px-4 py-2 text-slate-200 hover:bg-slate-800">
            FAQ
          </Link>
          <Link href="/refund-policy" className="rounded-lg border border-slate-700 px-4 py-2 text-slate-200 hover:bg-slate-800">
            Refund Policy
          </Link>
          <Link href="/developers" className="rounded-lg border border-slate-700 px-4 py-2 text-slate-200 hover:bg-slate-800">
            Developers
          </Link>
        </section>
      </div>
    </main>
  );
}
