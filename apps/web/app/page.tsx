import dynamic from 'next/dynamic';

const HomePageClient = dynamic(() => import('./HomePageClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-white text-black">
      <div className="max-w-7xl mx-auto px-4 py-32 text-center">
        <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-gray-100/50 border border-emerald-500/30 mb-8">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"></span>
          <span className="text-sm text-emerald-600 font-medium">Loading Clisonix…</span>
        </div>
      </div>
    </div>
  ),
});

export default function HomePage() {
  return <HomePageClient />;
}
