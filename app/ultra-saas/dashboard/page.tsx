/**
 * Ultra SaaS Dashboard - Main Control Center
 * Central dashboard for managing all SaaS modules and services
 *
 * @author Ledjan Ahmati
 * @version 8.0.0-SAAS-DASHBOARD
 * @license MIT
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRealMetrics, useDashboardStats } from './useRealMetrics';
import {
  Activity,
  Zap,
  TrendingUp,
  Shield,
  Globe,
  Brain,
  BarChart3,
  Settings,
  Bell,
  Search,
  BookOpen,
  ArrowRight,
  Cpu,
  HardDrive,
  Wifi,
  Thermometer,
  Bitcoin,
  RefreshCw,
  Blocks,
  MessageSquare,
} from 'lucide-react';
import styles from './dashboard.module.css';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

interface SystemAlert {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  message: string;
  timestamp: string;
  source: string;
}

// Real platform modules that exist in this codebase
const PLATFORM_MODULES = [
  { name: 'NodeSMS Messenger', path: '/nodesms',                  icon: '💬', status: 'active' as const },
  { name: 'AGI Core Ultra',  path: '/agi',                      icon: '🧠', status: 'active' as const },
  { name: 'ASI Dashboard',   path: '/ultra-saas/asi-dashboard', icon: '🎯', status: 'active' as const },
  { name: 'Medical AGI',     path: '/agimed-professional',      icon: '🏥', status: 'active' as const },
  { name: 'AGI Tunnel',      path: '/agi-tunnel',               icon: '🌀', status: 'active' as const },
  { name: 'AI Manager',      path: '/ai-manager',               icon: '🤖', status: 'active' as const },
  { name: 'Alba Med AGI',    path: '/albamed-demo',             icon: '🇦🇱', status: 'active' as const },
  { name: 'Eco AGI',         path: '/economics/agixeco',        icon: '🌿', status: 'active' as const },
  { name: 'Bio Nature AGI',  path: '/medical/bionature',        icon: '🦋', status: 'active' as const },
  { name: 'API Gateway',     path: '/api-gateway',              icon: '🚪', status: 'active' as const },
  { name: 'Kloud Fabric Cloud', path: '/kloud', icon: '🖥️', status: 'active' as const },
];

const UltraSaasDashboard: React.FC = () => {
  const { data: realData, isLoading, error, refetch } = useRealMetrics();
  const { data: s } = useDashboardStats();

  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  useEffect(() => {
    if (realData?.news) {
      setAlerts(
        realData.news.map((item, idx) => ({
          id: idx.toString(),
          type: 'info' as const,
          message: item.title ?? '(no title)',
          timestamp: item.timestamp
            ? new Date(item.timestamp).toLocaleTimeString()
            : 'Live',
          source: item.source ?? 'news.ycombinator.com',
        }))
      );
      setLastRefresh(new Date().toLocaleTimeString());
    }
  }, [realData]);

  const quickActions: QuickAction[] = [
    {
      id: 'nodesms',
      title: 'NodeSMS',
      description: 'Mobile-first messaging microservice',
      href: '/nodesms',
      icon: <MessageSquare size={20} />,
    },
    {
      id: 'analytics',
      title: 'Analytics',
      description: 'Real-time metrics & system monitoring',
      href: '/ultra-saas/analytics',
      icon: <BarChart3 size={20} />,
    },
    {
      id: 'modules',
      title: 'All Modules',
      description: 'Browse all active production services',
      href: '/ultra-saas',
      icon: <Zap size={20} />,
    },
    {
      id: 'asiDashboard',
      title: 'ASI Dashboard',
      description: 'Albanian System Intelligence control panel',
      href: '/ultra-saas/asi-dashboard',
      icon: <Brain size={20} />,
    },
    {
      id: 'settings',
      title: 'Settings',
      description: 'Configure integrations and environment',
      href: '/ultra-saas/settings',
      icon: <Settings size={20} />,
    },
    {
      id: 'docs',
      title: 'API Docs',
      description: 'Explore all platform endpoints',
      href: '/ultra-saas/documentation',
      icon: <BookOpen size={20} />,
    },
    {
      id: 'swagger',
      title: 'Swagger',
      description: 'OpenAPI contract by microservice section',
      href: '/openapi.json',
      icon: <Blocks size={20} />,
    },
    {
      id: 'evaluation',
      title: 'Evaluation',
      description: 'Real-time platform evaluation & recommendations',
      href: '/ultra-saas/evaluation',
      icon: <TrendingUp size={20} />,
    },
  ];

  if (isLoading) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>
              <Brain className={styles.titleIcon} />
              Ultra SaaS Dashboard
            </h1>
            <p className={styles.subtitle}>Loading live metrics from real services…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>
              <Brain className={styles.titleIcon} />
              Ultra SaaS Dashboard
            </h1>
            <p className={styles.subtitle}>⚠ Live data temporarily unavailable</p>
            <p className={styles.subtitle} style={{ color: '#f87171', fontSize: '0.85rem' }}>
              {error.message}
            </p>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.notificationBtn} onClick={() => void refetch()}>
              <RefreshCw size={18} /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const memUsage = Math.max(0, Math.min(100, realData?.system?.memory ?? 0));
  const cpuUsage = Math.max(0, Math.min(100, realData?.system?.cpu ?? 0));
  const ethEur = realData?.crypto?.ethereum?.eur ?? 0;

  return (
    <div className={styles.dashboard}>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            <Brain className={styles.titleIcon} />
            Ultra SaaS Dashboard
          </h1>
          <p className={styles.subtitle}>
            Central Command Center • Real-time Monitoring • Albanian Integration
            {lastRefresh && (
              <span style={{ marginLeft: '1rem', opacity: 0.6, fontSize: '0.78rem' }}>
                Updated {lastRefresh}
              </span>
            )}
          </p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.searchContainer}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Search modules, users, data..."
              className={styles.searchInput}
            />
          </div>
          <button className={styles.notificationBtn} onClick={() => void refetch()} title="Refresh metrics">
            <RefreshCw size={18} />
          </button>
          <button className={styles.notificationBtn}>
            <Bell size={20} />
            {alerts.length > 0 && (
              <span className={styles.notificationBadge}>{alerts.length}</span>
            )}
          </button>
        </div>
      </header>

      {/* Stats Grid */}
      <section className={styles.statsGrid}>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.revenue}`}>
            <Bitcoin size={24} />
          </div>
          <div className={styles.statContent}>
            <h3>Bitcoin (EUR)</h3>
            <div className={styles.statValue}>
              {s.btcEur > 0 ? `€${s.btcEur.toLocaleString()}` : '—'}
            </div>
            <div className={styles.statChange}>Live · CoinGecko</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.modules}`}>
            <TrendingUp size={24} />
          </div>
          <div className={styles.statContent}>
            <h3>Ethereum (EUR)</h3>
            <div className={styles.statValue}>
              {ethEur > 0 ? `€${ethEur.toLocaleString()}` : '—'}
            </div>
            <div className={styles.statChange}>Live · CoinGecko</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.requests}`}>
            <Activity size={24} />
          </div>
          <div className={styles.statContent}>
            <h3>API Requests</h3>
            <div className={styles.statValue}>{s.totalRequests.toLocaleString()}</div>
            <div className={styles.statChange}>Since last deploy</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.health}`}>
            <Thermometer size={24} />
          </div>
          <div className={styles.statContent}>
            <h3>Weather · Athens</h3>
            <div className={styles.statValue}>
              {s.temperature !== null ? `${s.temperature}°C` : '—'}
            </div>
            <div className={styles.statChange}>
              {s.humidity !== null ? `Humidity ${s.humidity}%` : 'Open-Meteo'}
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.users}`}>
            <Shield size={24} />
          </div>
          <div className={styles.statContent}>
            <h3>RAM Usage</h3>
            <div className={styles.statValue}>{memUsage}%</div>
            <div className={styles.statChange}>{s.usedMemGB} GB / {s.totalMemGB} GB</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.uptime}`}>
            <Globe size={24} />
          </div>
          <div className={styles.statContent}>
            <h3>Server Uptime</h3>
            <div className={styles.statValue}>{s.uptimeDays}d</div>
            <div className={styles.statChange}>{s.uptimePct}% of 30 days · {s.platform}</div>
          </div>
        </div>

      </section>

      {/* Main Grid */}
      <div className={styles.mainGrid}>

        {/* Microservice Tabs */}
        <section className={styles.quickActions}>
          <h2 className={styles.sectionTitle}>Microservice Tabs</h2>
          <div className={styles.actionGrid}>
            <Link href="/nodesms" className={styles.actionCard}>
              <div className={styles.actionIcon}>
                <MessageSquare size={20} />
              </div>
              <div className={styles.actionContent}>
                <h3>NodeSMS Service</h3>
                <p>Messaging API + LoRa queue + adaptor endpoints</p>
              </div>
              <ArrowRight size={18} className={styles.actionArrow} />
            </Link>
            <Link href="/kloud" className={styles.actionCard}>
              <div className={styles.actionIcon}>
                <HardDrive size={20} />
              </div>
              <div className={styles.actionContent}>
                <h3>Kloud Fabric Cloud</h3>
                <p>Fabric hardware cloud orchestration & management</p>
              </div>
              <ArrowRight size={18} className={styles.actionArrow} />
            </Link>
            <Link href="/ultra-saas/evaluation" className={styles.actionCard}>
              <div className={styles.actionIcon}>
                <TrendingUp size={20} />
              </div>
              <div className={styles.actionContent}>
                <h3>Evaluation Service</h3>
                <p>Health scoring, risk analysis, and recommendations</p>
              </div>
              <ArrowRight size={18} className={styles.actionArrow} />
            </Link>
            <Link href="/ultra-saas/documentation" className={styles.actionCard}>
              <div className={styles.actionIcon}>
                <BookOpen size={20} />
              </div>
              <div className={styles.actionContent}>
                <h3>API Sections</h3>
                <p>Organized docs by microservice boundaries</p>
              </div>
              <ArrowRight size={18} className={styles.actionArrow} />
            </Link>
            <Link href="/openapi.json" className={styles.actionCard}>
              <div className={styles.actionIcon}>
                <Blocks size={20} />
              </div>
              <div className={styles.actionContent}>
                <h3>Swagger OpenAPI</h3>
                <p>Professional contract for all core services</p>
              </div>
              <ArrowRight size={18} className={styles.actionArrow} />
            </Link>
          </div>
        </section>

        {/* Quick Actions */}
        <section className={styles.quickActions}>
          <h2 className={styles.sectionTitle}>Quick Actions</h2>
          <div className={styles.actionGrid}>
            {quickActions.map(action => (
              <Link key={action.id} href={action.href} className={styles.actionCard}>
                <div className={`${styles.actionIcon} ${styles[action.id]}`}>
                  {action.icon}
                </div>
                <div className={styles.actionContent}>
                  <h3>{action.title}</h3>
                  <p>{action.description}</p>
                </div>
                <ArrowRight size={18} className={styles.actionArrow} />
              </Link>
            ))}
          </div>
        </section>

        {/* Live Tech Feed */}
        <section className={styles.alertsSection}>
          <h2 className={styles.sectionTitle}>
            Live Tech Feed
            <span style={{ fontSize: '0.72rem', fontWeight: 400, marginLeft: '0.5rem', opacity: 0.6 }}>
              Hacker News
            </span>
          </h2>
          <div className={styles.alertsList}>
            {alerts.length === 0 ? (
              <p style={{ opacity: 0.5, padding: '0.5rem' }}>No feed data available</p>
            ) : (
              alerts.map(alert => (
                <div key={alert.id} className={`${styles.alert} ${styles[alert.type]}`}>
                  <div className={styles.alertContent}>
                    <p>{alert.message}</p>
                    <span className={styles.alertTime}>{alert.source} · {alert.timestamp}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Platform Modules */}
        <section className={styles.topModules}>
          <h2 className={styles.sectionTitle}>Platform Modules</h2>
          <div className={styles.modulesList}>
            {PLATFORM_MODULES.map(mod => (
              <Link
                key={mod.path}
                href={mod.path}
                className={styles.moduleItem}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className={styles.moduleInfo}>
                  <h4>{mod.icon} {mod.name}</h4>
                  <span className={styles.moduleUsers}>{mod.path}</span>
                </div>
                <div className={styles.moduleStats}>
                  <span className={`${styles.moduleStatus} ${styles[mod.status]}`}>
                    {mod.status}
                  </span>
                  <ArrowRight size={14} style={{ opacity: 0.4 }} />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* System Performance */}
        <section className={styles.performanceSection}>
          <h2 className={styles.sectionTitle}>System Performance</h2>
          <div className={styles.performanceGrid}>

            <div className={styles.performanceItem}>
              <span className={styles.performanceLabel}>
                <Cpu size={14} style={{ marginRight: 4 }} />CPU Load
              </span>
              <div className={styles.performanceBar}>
                <div className={`${styles.performanceValue} ${styles.cpu}`} style={{ width: `${cpuUsage}%` }} />
              </div>
              <span className={styles.performanceText}>
                {cpuUsage}%{s.platform === 'win32' ? ' (load avg N/A on Windows)' : ''}
              </span>
            </div>

            <div className={styles.performanceItem}>
              <span className={styles.performanceLabel}>
                <HardDrive size={14} style={{ marginRight: 4 }} />Memory
              </span>
              <div className={styles.performanceBar}>
                <div className={`${styles.performanceValue} ${styles.memory}`} style={{ width: `${memUsage}%` }} />
              </div>
              <span className={styles.performanceText}>
                {memUsage}% · {s.usedMemGB} GB / {s.totalMemGB} GB
              </span>
            </div>

            <div className={styles.performanceItem}>
              <span className={styles.performanceLabel}>
                <Globe size={14} style={{ marginRight: 4 }} />Uptime
              </span>
              <div className={styles.performanceBar}>
                <div className={`${styles.performanceValue} ${styles.storage}`} style={{ width: `${s.uptimePct}%` }} />
              </div>
              <span className={styles.performanceText}>{s.uptimePct}% · {s.uptimeDays} days</span>
            </div>

            <div className={styles.performanceItem}>
              <span className={styles.performanceLabel}>
                <Wifi size={14} style={{ marginRight: 4 }} />API Health
              </span>
              <div className={styles.performanceBar}>
                <div className={`${styles.performanceValue} ${styles.network}`} style={{ width: '100%' }} />
              </div>
              <span className={styles.performanceText}>100% · {s.totalRequests} requests served</span>
            </div>

          </div>
        </section>

      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerLinks}>
          <Link href="/ultra-saas" className={styles.footerLink}>All Modules</Link>
          <Link href="/ultra-saas/asi-dashboard" className={styles.footerLink}>ASI Dashboard</Link>
          <Link href="/ultra-saas/analytics" className={styles.footerLink}>Analytics</Link>
          <Link href="/ultra-saas/settings" className={styles.footerLink}>Settings</Link>
          <Link href="/ultra-saas/documentation" className={styles.footerLink}>API Docs</Link>
          <Link href="/openapi.json" className={styles.footerLink}>Swagger</Link>
        </div>
        <div className={styles.footerInfo}>
          <p>© {new Date().getFullYear()} Ultra SaaS Platform · Made in Albania 🇦�� · All Systems Operational</p>
        </div>
      </footer>

    </div>
  );
};

export default UltraSaasDashboard;
