'use client';

/**
 * LazyPageWrapper — a lightweight page-level wrapper that adds a header
 * with a gradient title and description, then renders the child content below.
 *
 * @author Ledjan Ahmati
 * @version 8.0.0-WEB8
 */

import React, { Suspense } from 'react';

interface LazyPageWrapperProps {
  title: string;
  description?: string;
  gradient?: string; // Tailwind gradient class e.g. "from-violet-600 to-purple-600"
  children: React.ReactNode;
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-violet-500" />
    </div>
  );
}

export default function LazyPageWrapper({
  title,
  description,
  gradient = 'from-violet-600 to-purple-600',
  children,
}: LazyPageWrapperProps) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className={`bg-gradient-to-r ${gradient} py-8 px-6 shadow-lg`}>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-2 text-sm text-white/80 max-w-2xl">{description}</p>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </div>
    </div>
  );
}
