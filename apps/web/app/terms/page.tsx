import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS_IDENTITY, formatBusinessAddress } from '../lib/business-identity';

export const metadata: Metadata = {
  title: 'Terms & Conditions | Clisonix',
  description:
    'Terms and Conditions for Clisonix services, billing, acceptable use, and legal responsibilities.',
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsPage() {
  const officeAddress = formatBusinessAddress();

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold">Terms & Conditions</h1>
          <p className="mt-3 text-slate-300">{BUSINESS_IDENTITY.brandName} operated by {BUSINESS_IDENTITY.legalName}</p>
          <p className="mt-1 text-sm text-slate-400">Last updated: April 20, 2026</p>
        </header>

        <div className="mb-10 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6 text-slate-100">
          <p className="font-semibold">Business Identification</p>
          <p className="mt-2">Legal entity: {BUSINESS_IDENTITY.legalName}</p>
          <p>Registration: {BUSINESS_IDENTITY.registrationNumber}</p>
          <p>Address: {officeAddress}</p>
          <p>Legal contact: {BUSINESS_IDENTITY.legalEmail}</p>
        </div>

        <div className="space-y-8 text-slate-200">
          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the services at {BUSINESS_IDENTITY.domain}, you agree to these Terms and all
              applicable laws and regulations.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">2. Services and Accounts</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>You are responsible for the confidentiality of your account credentials.</li>
              <li>You agree to provide accurate account and billing information.</li>
              <li>We may suspend access when required for security, abuse prevention, or legal compliance.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">3. Acceptable Use</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>No unlawful, fraudulent, abusive, or rights-infringing activity.</li>
              <li>No attempts to bypass security controls, rate limits, or access restrictions.</li>
              <li>No unauthorized scraping, reverse engineering, or platform disruption.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">4. Billing and Payments</h2>
            <p>
              Paid plans are billed according to selected pricing terms. Payment processing is handled by certified
              third-party providers. Refund and cancellation rules are described in our{' '}
              <Link href="/refund-policy" className="text-emerald-300 hover:text-emerald-200">Refund Policy</Link>.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">5. Intellectual Property</h2>
            <p>
              The platform, software, trademarks, and documentation are protected by intellectual property laws and
              remain property of {BUSINESS_IDENTITY.legalName} and/or licensors.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">6. Disclaimers and Liability</h2>
            <p>
              Services are provided on an as-available basis. To the maximum extent permitted by law, we disclaim
              warranties not explicitly stated and limit liability for indirect or consequential losses.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">7. Governing Law and Venue</h2>
            <p>
              These Terms are governed by applicable laws of Germany and EU legal framework, unless mandatory local
              consumer protection law requires otherwise.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">8. Contact</h2>
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
              <p>Legal: {BUSINESS_IDENTITY.legalEmail}</p>
              <p>Support: {BUSINESS_IDENTITY.supportEmail}</p>
              <p>Address: {officeAddress}</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
