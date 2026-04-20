import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS_IDENTITY, formatBusinessAddress } from '../lib/business-identity';

export const metadata: Metadata = {
  title: 'Privacy Policy | Clisonix',
  description:
    'Privacy Policy for Clisonix, including data collection, legal basis, retention, and data subject rights.',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPage() {
  const officeAddress = formatBusinessAddress();

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold">Privacy Policy</h1>
          <p className="mt-3 text-slate-300">{BUSINESS_IDENTITY.brandName} ({BUSINESS_IDENTITY.legalName})</p>
          <p className="mt-1 text-sm text-slate-400">Last updated: April 20, 2026</p>
        </header>

        <div className="mb-10 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-slate-100">
          <p className="font-semibold">Data Controller</p>
          <p className="mt-2">{BUSINESS_IDENTITY.legalName}</p>
          <p>{officeAddress}</p>
          <p className="mt-1">Email: {BUSINESS_IDENTITY.privacyEmail}</p>
          <p>Phone: {BUSINESS_IDENTITY.supportPhone}</p>
        </div>

        <div className="space-y-8 text-slate-200">
          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">1. Scope</h2>
            <p>
              This Privacy Policy applies to visitors and users of {BUSINESS_IDENTITY.domain}, including account,
              billing, and support interactions.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">2. Data We Process</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Account data: name, email, profile metadata from selected authentication provider.</li>
              <li>Technical data: IP address, browser/device details, security logs, and API diagnostics.</li>
              <li>Billing data: plan, invoice metadata, payment processor tokens (not full card details).</li>
              <li>Support data: messages and attachments you submit for assistance.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">3. Why We Process Data</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Service delivery, account authentication, and platform security.</li>
              <li>Contract performance and billing administration.</li>
              <li>Compliance with legal obligations and fraud prevention.</li>
              <li>Legitimate interests such as reliability, abuse detection, and service improvement.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">4. Sharing and Processors</h2>
            <p>
              We do not sell personal data. We share only with infrastructure, authentication, analytics, and payment
              processors required to operate the service and comply with law.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">5. Retention</h2>
            <p>
              We retain data only for as long as needed for service operation, legal accounting obligations,
              contractual disputes, and security auditing.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">6. Your Rights</h2>
            <p>
              Subject to applicable law, you may request access, correction, deletion, restriction, objection,
              portability, and consent withdrawal where applicable.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">7. Security Controls</h2>
            <p>
              Traffic is served over HTTPS. We apply security headers, strict transport controls, logging, and
              monitored access controls across production services.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">8. Contact for Privacy Requests</h2>
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
              <p>Email: {BUSINESS_IDENTITY.privacyEmail}</p>
              <p>General support: {BUSINESS_IDENTITY.supportEmail}</p>
              <p>Address: {officeAddress}</p>
            </div>
          </section>
        </div>

        <div className="mt-12 border-t border-slate-800 pt-6 text-sm text-slate-400">
          <p>
            See also <Link href="/terms" className="text-emerald-300 hover:text-emerald-200">Terms & Conditions</Link> and{' '}
            <Link href="/contact" className="text-emerald-300 hover:text-emerald-200">Contact</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
