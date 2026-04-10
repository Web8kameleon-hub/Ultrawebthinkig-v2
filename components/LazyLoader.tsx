'use client';

/**
 * LazyLoader — Industrial-grade dynamic component loading system
 * Mbështet variant, priority, viewport preloading dhe error handling.
 *
 * @author Ledjan Ahmati
 * @version 8.0.0-WEB8
 */

import React, { Suspense, useEffect, useRef, useState, lazy } from 'react';
import styles from './LazyLoader.module.css';

// ─── Regjistri i komponentëve ────────────────────────────────────────────────

type ComponentLoader = () => Promise<{ default: React.ComponentType<any> }>;

const COMPONENT_REGISTRY: Record<string, ComponentLoader> = {
  LoRaMeshNetwork:       () => import('./LoRaMeshNetwork'),
  EuroMeshDashboard:     () => import('./EuroMeshDashboard'),
  AGITunnel:             () => import('./AGITunnel'),
  SecurityDashboard:     () => import('./SecurityDashboard'),
  AIManagerAdvanced:     () => import('./AIManagerAdvanced'),
  OpenMindChat:          () => import('./OpenMindChat'),
  OpenMindChatEnhanced:  () => import('./OpenMindChatEnhanced'),
  PerformanceMonitor:    () => import('./PerformanceMonitor'),
  NeuralDashboard:       () => import('./NeuralDashboard'),
  GuardianDashboard:     () => import('./GuardianDashboard'),
};

/** Regjistro komponent custom në kohë ekzekutimi */
export function registerLazyComponent(config: {
  name: string;
  loader: ComponentLoader;
  priority?: LazyLoaderProps['priority'];
  chunk?: string;
  preload?: boolean;
}) {
  COMPONENT_REGISTRY[config.name] = config.loader;
  if (config.preload) {
    config.loader().catch(() => {});
  }
}

/** Preloado komponent në sfond */
export function preloadComponent(name: string) {
  const loader = COMPONENT_REGISTRY[name];
  if (loader) loader().catch(() => {});
}

// ─── Tipi i Props ────────────────────────────────────────────────────────────

export interface LazyLoaderProps {
  component: string;
  variant?: 'default' | 'industrial' | 'neural' | 'quantum';
  priority?: 'critical' | 'high' | 'normal' | 'low';
  preload?: boolean;
  viewport?: boolean;
  className?: string;
  fallback?: React.ReactNode;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  [key: string]: any; // props shtesë për komponentin e ngarkuar
}

// ─── Spinners ────────────────────────────────────────────────────────────────

const VARIANT_COLORS: Record<string, string> = {
  default:    '#6366f1',
  industrial: '#00ff7f',
  neural:     '#818cf8',
  quantum:    '#f093fb',
};

function Spinner({ variant = 'default', priority = 'normal' }: { variant?: string; priority?: string }) {
  const color = VARIANT_COLORS[variant] ?? '#6366f1';
  return (
    <div className={styles.spinner}>
      <div
        className={styles.spinnerCore}
        style={{ background: color }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `2px solid transparent`,
          borderTopColor: color,
          animation: 'spin 0.8s linear infinite',
        }}
      />
    </div>
  );
}

// ─── Fallback standard ───────────────────────────────────────────────────────

function DefaultFallback({
  variant,
  priority,
  label,
}: {
  variant: LazyLoaderProps['variant'];
  priority: LazyLoaderProps['priority'];
  label: string;
}) {
  return (
    <div
      className={[
        styles.container,
        styles[variant ?? 'default'],
        styles.loading,
        styles[`${priority ?? 'normal'}Priority`],
      ].join(' ')}
    >
      <Spinner variant={variant} priority={priority} />
      <p style={{ color: '#aaa', fontSize: '0.8rem', marginTop: 8 }}>
        Duke ngarkuar <strong>{label}</strong>…
      </p>
    </div>
  );
}

// ─── Error fallback ──────────────────────────────────────────────────────────

function ErrorFallback({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div
      className={styles.container}
      style={{ flexDirection: 'column', gap: 12 }}
    >
      <p style={{ color: '#f87171' }}>⚠️ Komponenti <strong>{label}</strong> nuk u ngarkua.</p>
      <button
        onClick={onRetry}
        style={{
          padding: '6px 16px',
          background: '#6366f1',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        Provo sërish
      </button>
    </div>
  );
}

// ─── LazyLoader kryesor ──────────────────────────────────────────────────────

export function LazyLoader({
  component,
  variant = 'default',
  priority = 'normal',
  preload = false,
  viewport = false,
  className,
  fallback,
  onLoad,
  onError,
  ...restProps
}: LazyLoaderProps) {
  const [visible, setVisible] = useState(!viewport);
  const [error, setError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport detection
  useEffect(() => {
    if (!viewport || visible) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );
    const el = containerRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [viewport, visible]);

  // Preload in background
  useEffect(() => {
    if (preload) preloadComponent(component);
  }, [preload, component]);

  // Load
  const loader = COMPONENT_REGISTRY[component];

  if (!loader) {
    return (
      <div className={[styles.container, className].filter(Boolean).join(' ')}>
        <p style={{ color: '#f87171' }}>
          ⚠️ Komponenti <code>{component}</code> nuk është i regjistruar.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorFallback
        label={component}
        onRetry={() => {
          setError(null);
          setRetryKey((k) => k + 1);
        }}
      />
    );
  }

  if (!visible) {
    return (
      <div ref={containerRef} className={[styles.container, className].filter(Boolean).join(' ')}>
        {fallback ?? (
          <DefaultFallback variant={variant} priority={priority} label={component} />
        )}
      </div>
    );
  }

  const LazyComponent = lazy(loader);

  class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean }
  > {
    constructor(props: { children: React.ReactNode }) {
      super(props);
      this.state = { hasError: false };
    }
    static getDerivedStateFromError(err: Error) {
      return { hasError: true };
    }
    componentDidCatch(err: Error) {
      setError(err);
      onError?.(err);
    }
    render() {
      if (this.state.hasError) return null;
      return this.props.children;
    }
  }

  return (
    <div
      key={retryKey}
      className={[
        styles.container,
        styles[variant],
        styles.loaded,
        styles[`${priority}Priority`],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <ErrorBoundary>
        <Suspense
          fallback={
            fallback ?? (
              <DefaultFallback variant={variant} priority={priority} label={component} />
            )
          }
        >
          <LazyComponent {...restProps} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

export default LazyLoader;
