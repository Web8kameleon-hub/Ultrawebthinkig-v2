'use client';

import React, { useEffect, useState, useCallback } from 'react';
import styles from './NeuralDashboard.module.css';

const MANAGER_URL = 'https://ultra.clisonix.com/ai-manager';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const EARTHQUAKE_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';

// Tirana, Albania coordinates
const TIRANA_LAT = '41.33';
const TIRANA_LON = '19.82';

interface StatCardProps {
  icon: string;
  title: string;
  stats: { label: string; value: string }[];
  loading?: boolean;
  error?: string | null;
}

const StatCard: React.FC<StatCardProps> = ({ icon, title, stats, loading, error }) => (
  <div className={styles.statCard}>
    <div className={styles.statIcon}>{icon}</div>
    <div className={styles.statTitle}>{title}</div>
    {loading ? (
      <div className={styles.statRow}><span className={styles.statLabel}>Loading…</span></div>
    ) : error ? (
      <div className={styles.statRow}><span className={styles.statLabel} style={{ color: '#ff4444' }}>{error}</span></div>
    ) : (
      stats.map((s) => (
        <div key={s.label} className={styles.statRow}>
          <span className={styles.statLabel}>{s.label}:</span>
          <span className={styles.statValue}>{s.value}</span>
        </div>
      ))
    )}
  </div>
);

interface ManagerHealth {
  status?: string;
  uptime?: string | number;
  version?: string;
  agiCore?: boolean;
  albaNetwork?: boolean;
  asiEngine?: boolean;
  activeClients?: number;
  requestsHandled?: number;
}

interface WeatherData {
  temperature?: number;
  windspeed?: number;
  weathercode?: number;
}

interface EarthquakeData {
  count: number;
  maxMag: number | null;
  fetchedAt: string;
}

export const NeuralDashboard: React.FC = () => {
  const [managerHealth, setManagerHealth] = useState<ManagerHealth | null>(null);
  const [managerLoading, setManagerLoading] = useState(true);
  const [managerError, setManagerError] = useState<string | null>(null);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const [quake, setQuake] = useState<EarthquakeData | null>(null);
  const [quakeLoading, setQuakeLoading] = useState(true);
  const [quakeError, setQuakeError] = useState<string | null>(null);

  const fetchManagerHealth = useCallback(async () => {
    try {
      const res = await fetch(`${MANAGER_URL}/health`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ManagerHealth = await res.json();
      setManagerHealth(data);
      setManagerError(null);
    } catch (err: any) {
      setManagerError(err?.message ?? 'Unreachable');
    } finally {
      setManagerLoading(false);
    }
  }, []);

  const fetchWeather = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        latitude: TIRANA_LAT,
        longitude: TIRANA_LON,
        current_weather: 'true',
        timezone: 'auto',
      });
      const res = await fetch(`${WEATHER_URL}?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setWeather(data.current_weather ?? null);
      setWeatherError(null);
    } catch (err: any) {
      setWeatherError(err?.message ?? 'Unavailable');
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  const fetchEarthquakes = useCallback(async () => {
    try {
      const res = await fetch(EARTHQUAKE_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const features: any[] = data.features ?? [];
      const maxMag =
        features.length > 0
          ? Math.max(...features.map((f: any) => f.properties?.mag ?? 0))
          : null;
      setQuake({ count: features.length, maxMag, fetchedAt: new Date().toLocaleTimeString() });
      setQuakeError(null);
    } catch (err: any) {
      setQuakeError(err?.message ?? 'Unavailable');
    } finally {
      setQuakeLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchManagerHealth();
    fetchWeather();
    fetchEarthquakes();

    const interval = setInterval(() => {
      fetchManagerHealth();
      fetchWeather();
      fetchEarthquakes();
    }, 30_000);

    return () => clearInterval(interval);
  }, [fetchManagerHealth, fetchWeather, fetchEarthquakes]);

  const formatUptime = (uptime: string | number | undefined): string => {
    if (uptime === undefined || uptime === null) return 'N/A';
    if (typeof uptime === 'string') return uptime;
    const secs = Math.floor(Number(uptime));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const agiStats = managerHealth
    ? [
        { label: 'Status', value: managerHealth.agiCore ? '✅ Online' : '❌ Offline' },
        { label: 'System', value: managerHealth.status ?? 'Unknown' },
        { label: 'Uptime', value: formatUptime(managerHealth.uptime) },
        { label: 'Version', value: managerHealth.version ? `v${managerHealth.version}` : 'N/A' },
      ]
    : [];

  const albaStats = managerHealth
    ? [
        { label: 'Network', value: managerHealth.albaNetwork ? '✅ Online' : '❌ Offline' },
        { label: 'Active Clients', value: managerHealth.activeClients != null ? String(managerHealth.activeClients) : 'N/A' },
        { label: 'Requests Handled', value: managerHealth.requestsHandled != null ? managerHealth.requestsHandled.toLocaleString() : 'N/A' },
      ]
    : [];

  // ASI card: show manager error prominently; weather errors surface inline in the stats row
  const asiCombinedError =
    !managerLoading && !weatherLoading && managerError
      ? managerError
      : null;

  const asiStats = managerHealth
    ? [
        { label: 'Engine', value: managerHealth.asiEngine ? '✅ Online' : '❌ Offline' },
        ...(weather
          ? [
              { label: 'Temp (Tirana)', value: `${weather.temperature}°C` },
              { label: 'Wind', value: `${weather.windspeed} km/h` },
            ]
          : [{ label: 'Weather', value: weatherError ?? 'Loading…' }]),
      ]
    : [];

  const analyticsStats = quake
    ? [
        { label: 'Quakes (1h)', value: String(quake.count) },
        { label: 'Max Magnitude', value: quake.maxMag != null ? quake.maxMag.toFixed(1) : 'None' },
        { label: 'Source', value: 'USGS Live Feed' },
        { label: 'Updated', value: quake.fetchedAt },
      ]
    : [];

  return (
    <div className={styles.grid}>
      <StatCard
        icon="🧠"
        title="AGI Neural Core"
        stats={agiStats}
        loading={managerLoading}
        error={!managerLoading ? managerError : null}
      />
      <StatCard
        icon="🛰️"
        title="ALBA IoT Network"
        stats={albaStats}
        loading={managerLoading}
        error={!managerLoading ? managerError : null}
      />
      <StatCard
        icon="⚡"
        title="ASI Quantum Engine"
        stats={asiStats}
        loading={managerLoading || weatherLoading}
        error={asiCombinedError}
      />
      <StatCard
        icon="🔬"
        title="System Analytics"
        stats={analyticsStats}
        loading={quakeLoading}
        error={!quakeLoading ? quakeError : null}
      />
    </div>
  );
};

export default NeuralDashboard;
