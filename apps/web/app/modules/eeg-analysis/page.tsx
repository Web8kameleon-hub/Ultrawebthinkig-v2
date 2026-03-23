'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Square,
  Upload,
  BarChart3,
  Settings,
  ArrowLeft,
  Wifi,
  WifiOff,
  ZoomIn,
  ZoomOut,
  Plus,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  Info,
  Activity,
  Brain,
  Clock,
  Cpu,
  HardDrive,
  Gauge,
  FileText
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================
interface BrainwaveBand {
  name: string;
  value: number;
  color: string;
  description: string;
}

interface EEGChannel {
  id: string;
  name: string;
  data: number[];
  color: string;
}

interface TimelineEvent {
  id: string;
  type: 'stimulus' | 'blink' | 'artifact' | 'marker';
  time: string;
  label: string;
}

interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  color: string;
}

interface Alert {
  id: string;
  level: 'error' | 'warning' | 'info';
  message: string;
  time: string;
}

interface LogEntry {
  time: string;
  message: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================
const SESSIONS = [
  'Resting_Eyes_Closed',
  'Resting_Eyes_Open',
  'Cognitive_Task_01',
  'Memory_Test_A',
  'Attention_Assessment'
];

const CHANNEL_CONFIGS = {
  8: ['Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4', 'P3', 'P4'],
  16: ['Fp1', 'Fp2', 'F7', 'F3', 'Fz', 'F4', 'F8', 'T3', 'C3', 'Cz', 'C4', 'T4', 'P3', 'Pz', 'P4', 'O1'],
  32: ['Fp1', 'Fp2', 'F7', 'F3', 'Fz', 'F4', 'F8', 'FC5', 'FC1', 'FC2', 'FC6', 'T7', 'C3', 'Cz', 'C4', 'T8', 'TP9', 'CP5', 'CP1', 'CP2', 'CP6', 'TP10', 'P7', 'P3', 'Pz', 'P4', 'P8', 'PO9', 'O1', 'Oz', 'O2', 'PO10']
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
const generateEEGData = (length: number = 100): number[] => {
  const data: number[] = [];
  let value = 0;
  for (let i = 0; i < length; i++) {
    value += (Math.random() - 0.5) * 20;
    value = Math.max(-50, Math.min(50, value));
    data.push(value);
  }
  return data;
};

const generateSpectrogramData = (rows: number = 20, cols: number = 50): number[][] => {
  const data: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      row.push(Math.random());
    }
    data.push(row);
  }
  return data;
};

// ============================================================================
// COMPONENTS
// ============================================================================

// Header Component
const Header = ({
  session,
  setSession,
  isConnected,
  isRecording,
  onStartStop,
  onExport,
  onToggleMode,
  mode
}: {
  session: string;
  setSession: (s: string) => void;
  isConnected: boolean;
  isRecording: boolean;
  onStartStop: () => void;
  onExport: () => void;
  onToggleMode: () => void;
  mode: 'clinical' | 'observability';
}) => {
  const [showSessionDropdown, setShowSessionDropdown] = useState(false);

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Brain className="w-8 h-8 text-blue-600" />
            <h1 className="text-xl font-semibold text-slate-800">ALBI EEG</h1>
          </div>

          {/* Session Selector */}
          <div className="relative">
            <button
              onClick={() => setShowSessionDropdown(!showSessionDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <span className="text-slate-600">Session:</span>
              <span className="font-medium text-slate-800">{session}</span>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </button>

            {showSessionDropdown && (
              <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[200px]">
                {SESSIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => { setSession(s); setShowSessionDropdown(false); }}
                    className={`w-full px-4 py-2 text-left hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg ${s === session ? 'bg-blue-50 text-blue-600' : 'text-slate-700'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Connection Status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <span className="text-sm font-medium">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onStartStop}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isRecording ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isRecording ? 'Stop Session' : 'Start Session'}
          </button>

          <button
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            Export
          </button>

          <button
            onClick={onToggleMode}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              mode === 'observability'
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Observability
          </button>

          <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// EEG Waveform Component
const EEGWaveform = ({ channel, zoom }: { channel: EEGChannel; zoom: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Draw baseline
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Draw waveform
    ctx.strokeStyle = channel.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const step = width / channel.data.length;
    channel.data.forEach((value, i) => {
      const x = i * step;
      const y = centerY - (value * zoom * 0.5);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  }, [channel, zoom]);

  return (
    <div className="flex items-center gap-3 py-1">
      <span className="w-10 text-xs font-medium text-slate-500">{channel.name}</span>
      <canvas
        ref={canvasRef}
        width={400}
        height={40}
        className="flex-1 bg-slate-50 rounded"
      />
    </div>
  );
};

// Live EEG Panel
const LiveEEGPanel = ({
  channels,
  channelCount,
  setChannelCount,
  noiseFilter,
  setNoiseFilter,
  zoom,
  setZoom
}: {
  channels: EEGChannel[];
  channelCount: 8 | 16 | 32;
  setChannelCount: (c: 8 | 16 | 32) => void;
  noiseFilter: boolean;
  setNoiseFilter: (f: boolean) => void;
  zoom: number;
  setZoom: (z: number) => void;
}) => {
  const [spectrogramData, setSpectrogramData] = useState<number[][]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setSpectrogramData(generateSpectrogramData());
  }, []);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          Live EEG (Real-Time)
        </h2>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-slate-500">Streaming</span>
        </div>
      </div>

      {/* EEG Channels */}
      <div className="flex-1 overflow-y-auto space-y-1 mb-4">
        {channels.slice(0, channelCount).map(channel => (
          <EEGWaveform key={channel.id} channel={channel} zoom={zoom} />
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.5))}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(Math.min(3, zoom + 0.5))}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setNoiseFilter(!noiseFilter)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              noiseFilter ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Noise {noiseFilter ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="flex items-center gap-1">
          {([8, 16, 32] as const).map(count => (
            <button
              key={count}
              onClick={() => setChannelCount(count)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                channelCount === count ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {count}ch
            </button>
          ))}
        </div>
      </div>

      {/* Spectrogram */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <h3 className="text-sm font-medium text-slate-600 mb-2">Spectrogram</h3>
        <div
          className="h-20 rounded-lg overflow-hidden"
          style={isClient && spectrogramData.length > 0 ? {
            background: `linear-gradient(to right, ${spectrogramData.map((row) => {
              const avg = row.reduce((a, b) => a + b, 0) / row.length;
              const hue = 240 - avg * 200;
              return `hsl(${hue}, 70%, ${40 + avg * 30}%)`;
            }).join(', ')})`
          } : { background: 'linear-gradient(to right, #3B82F6, #8B5CF6, #EC4899)' }}
        />
      </div>
    </div>
  );
};

// Brainwave Band Bar
const BandBar = ({ band }: { band: BrainwaveBand }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-slate-700">{band.name}</span>
      <span className="text-sm font-semibold text-slate-800">{Math.round(band.value)}%</span>
    </div>
    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${band.value}%`, backgroundColor: band.color }}
      />
    </div>
  </div>
);

// Brainwave Bands Panel
const BrainwaveBandsPanel = ({ bands, dominantBand }: { bands: BrainwaveBand[]; dominantBand: string }) => {
  const leftHemisphere = 65;
  const rightHemisphere = 78;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col h-full">
      <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
        <Brain className="w-5 h-5 text-purple-600" />
        Brainwave Bands
      </h2>

      {/* Band Bars */}
      <div className="space-y-4 flex-1">
        {bands.map(band => (
          <BandBar key={band.name} band={band} />
        ))}
      </div>

      {/* Dominant Band */}
      <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
        <div className="text-sm text-slate-600">Dominant Band</div>
        <div className="text-xl font-bold text-blue-700">{dominantBand}</div>
        <div className="text-sm text-slate-500 mt-1">
          {dominantBand === 'Alpha' && 'Resting State / Relaxed'}
          {dominantBand === 'Beta' && 'Active Thinking / Focused'}
          {dominantBand === 'Theta' && 'Drowsy / Light Sleep'}
          {dominantBand === 'Delta' && 'Deep Sleep'}
          {dominantBand === 'Gamma' && 'High Cognition'}
        </div>
      </div>

      {/* Hemispheric Comparison */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <h3 className="text-sm font-medium text-slate-600 mb-3">Hemispheric Comparison</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-6 text-xs font-medium text-slate-500">L</span>
            <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${leftHemisphere}%` }}
              />
            </div>
            <span className="w-10 text-xs font-medium text-slate-600">{leftHemisphere}%</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-6 text-xs font-medium text-slate-500">R</span>
            <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full"
                style={{ width: `${rightHemisphere}%` }}
              />
            </div>
            <span className="w-10 text-xs font-medium text-slate-600">{rightHemisphere}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Session Timeline Panel
const SessionTimeline = ({ events, onAddEvent }: { events: TimelineEvent[]; onAddEvent: () => void }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
        <Clock className="w-5 h-5 text-green-600" />
        Session Timeline
      </h2>
    </div>

    {/* Timeline Track */}
    <div className="relative h-16 bg-slate-50 rounded-lg mb-4">
      <div className="absolute inset-x-4 top-1/2 h-0.5 bg-slate-200 -translate-y-1/2" />

      {events.map((event, i) => {
        const position = (i + 1) * (100 / (events.length + 1));
        return (
          <div
            key={event.id}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group"
            style={{ left: `${position}%` }}
          >
            <div className={`w-4 h-4 rounded-full border-2 border-white shadow cursor-pointer transition-transform hover:scale-125 ${
              event.type === 'stimulus' ? 'bg-blue-500' :
              event.type === 'blink' ? 'bg-yellow-500' :
              event.type === 'artifact' ? 'bg-red-500' :
              'bg-green-500'
            }`} />
            <div className="absolute top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              {event.label} @ {event.time}
            </div>
          </div>
        );
      })}
    </div>

    {/* Event List */}
    <div className="flex items-center gap-4 text-sm">
      {events.map(event => (
        <div key={event.id} className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            event.type === 'stimulus' ? 'bg-blue-500' :
            event.type === 'blink' ? 'bg-yellow-500' :
            event.type === 'artifact' ? 'bg-red-500' :
            'bg-green-500'
          }`} />
          <span className="text-slate-600">{event.label} @ {event.time}</span>
        </div>
      ))}
    </div>

    {/* Actions */}
    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
      <button
        onClick={onAddEvent}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Event
      </button>
      <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
        Jump to Event
      </button>
    </div>
  </div>
);

// ============================================================================
// OBSERVABILITY MODE COMPONENTS
// ============================================================================

// Metric Card
const MetricCard = ({ metric }: { metric: SystemMetric }) => {
  const [sparklineHeights, setSparklineHeights] = useState<number[]>([]);

  useEffect(() => {
    setSparklineHeights(Array.from({ length: 20 }, () => 20 + Math.random() * 80));
  }, []);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${metric.color}15` }}>
          {metric.icon}
        </div>
        <span className="text-sm font-medium text-slate-600">{metric.name}</span>
      </div>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-bold text-slate-800">{metric.value}</span>
        <span className="text-sm text-slate-500 mb-1">{metric.unit}</span>
      </div>
      {/* Sparkline */}
      <div className="mt-3 h-8 flex items-end gap-0.5">
        {sparklineHeights.map((height, i) => (
          <div
            key={i}
            className="flex-1 rounded-t"
            style={{
              height: `${height}%`,
              backgroundColor: metric.color,
              opacity: 0.3 + (i / 20) * 0.7
            }}
          />
        ))}
      </div>
    </div>
  );
};

// Band Power Chart
const BandPowerChart = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw band lines
    const bands = [
      { color: '#3B82F6', label: 'Alpha' },
      { color: '#10B981', label: 'Beta' },
      { color: '#F59E0B', label: 'Theta' },
      { color: '#8B5CF6', label: 'Delta' },
      { color: '#EC4899', label: 'Gamma' }
    ];

    bands.forEach((band, bandIndex) => {
      ctx.strokeStyle = band.color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let i = 0; i < 50; i++) {
        const x = (width / 49) * i;
        const baseY = height * 0.3 + bandIndex * 20;
        const y = baseY + Math.sin(i * 0.2 + bandIndex) * 30 + Math.random() * 10;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    });
  }, [isClient]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Band Power Over Time</h3>
      <canvas ref={canvasRef} width={800} height={200} className="w-full" />
      <div className="flex items-center justify-center gap-6 mt-4">
        {['Alpha', 'Beta', 'Theta', 'Delta', 'Gamma'].map((band, i) => (
          <div key={band} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{
              backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'][i]
            }} />
            <span className="text-sm text-slate-600">{band}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Artifact Chart
const ArtifactChart = () => {
  const artifacts = [
    { name: 'Eye Blink', count: 24, color: '#3B82F6' },
    { name: 'Muscle', count: 18, color: '#10B981' },
    { name: 'Movement', count: 12, color: '#F59E0B' },
    { name: 'Electrode', count: 8, color: '#8B5CF6' },
    { name: 'EMG', count: 6, color: '#EC4899' }
  ];

  const maxCount = Math.max(...artifacts.map(a => a.count));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Artifact Frequency</h3>
      <div className="space-y-3">
        {artifacts.map(artifact => (
          <div key={artifact.name} className="flex items-center gap-3">
            <span className="w-20 text-sm text-slate-600">{artifact.name}</span>
            <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden">
              <div
                className="h-full rounded-lg transition-all duration-500"
                style={{
                  width: `${(artifact.count / maxCount) * 100}%`,
                  backgroundColor: artifact.color
                }}
              />
            </div>
            <span className="w-8 text-sm font-medium text-slate-700">{artifact.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Alerts Panel
const AlertsPanel = ({ alerts }: { alerts: Alert[] }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5 h-full">
    <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
      <AlertCircle className="w-5 h-5 text-red-500" />
      Alerts
    </h3>
    <div className="space-y-3">
      {alerts.map(alert => (
        <div
          key={alert.id}
          className={`flex items-start gap-3 p-3 rounded-lg ${
            alert.level === 'error' ? 'bg-red-50' :
            alert.level === 'warning' ? 'bg-yellow-50' :
            'bg-blue-50'
          }`}
        >
          {alert.level === 'error' && <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
          {alert.level === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />}
          {alert.level === 'info' && <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />}
          <div className="flex-1">
            <p className={`text-sm font-medium ${
              alert.level === 'error' ? 'text-red-700' :
              alert.level === 'warning' ? 'text-yellow-700' :
              'text-blue-700'
            }`}>{alert.message}</p>
            <p className="text-xs text-slate-500 mt-1">{alert.time}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Logs Panel
const LogsPanel = ({ logs }: { logs: LogEntry[] }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5 h-full">
    <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
      <FileText className="w-5 h-5 text-slate-500" />
      Logs
    </h3>
    <div className="space-y-2 font-mono text-sm">
      {logs.map((log, i) => (
        <div key={i} className="flex gap-3 text-slate-600">
          <span className="text-slate-400">[{log.time}]</span>
          <span>{log.message}</span>
        </div>
      ))}
    </div>
  </div>
);

// Observability Header
const ObservabilityHeader = ({ onBack, session }: { onBack: () => void; session: string }) => (
  <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Clinical
        </button>
        <h1 className="text-xl font-semibold text-white">ALBI EEG – Observability Mode</h1>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg">
          <span className="text-slate-300">Session:</span>
          <span className="font-medium text-white">{session}</span>
        </div>
      </div>
      <button className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors">
        <Settings className="w-5 h-5" />
      </button>
    </div>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function EEGAnalysisPage() {
  const API_BASE = '/api/albi-user';
  const [mode, setMode] = useState<'clinical' | 'observability'>('clinical');
  const [session, setSession] = useState('Resting_Eyes_Closed');
  const [isConnected] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [backendSessionId, setBackendSessionId] = useState<string | null>(null);
  const [channelCount, setChannelCount] = useState<8 | 16 | 32>(8);
  const [noiseFilter, setNoiseFilter] = useState(true);
  const [zoom, setZoom] = useState(1);

  // Generate initial data
  const [channels, setChannels] = useState<EEGChannel[]>(() =>
    CHANNEL_CONFIGS[32].map((name, i) => ({
      id: `ch-${i}`,
      name,
      data: generateEEGData(),
      color: `hsl(${(i * 360) / 32}, 70%, 50%)`
    }))
  );

  const [bands, setBands] = useState<BrainwaveBand[]>([
    { name: 'Alpha', value: 78, color: '#3B82F6', description: '8-12 Hz' },
    { name: 'Beta', value: 54, color: '#10B981', description: '12-30 Hz' },
    { name: 'Theta', value: 41, color: '#F59E0B', description: '4-8 Hz' },
    { name: 'Delta', value: 28, color: '#8B5CF6', description: '0.5-4 Hz' },
    { name: 'Gamma', value: 19, color: '#EC4899', description: '30-100 Hz' }
  ]);

  const [events, setEvents] = useState<TimelineEvent[]>([
    { id: '1', type: 'stimulus', time: '00:05', label: 'Stimulus' },
    { id: '2', type: 'blink', time: '00:07', label: 'Blink' },
    { id: '3', type: 'stimulus', time: '00:12', label: 'Stimulus' }
  ]);

  const [metrics] = useState<SystemMetric[]>([
    { name: 'CPU Usage', value: 32, unit: '%', icon: <Cpu className="w-5 h-5 text-blue-600" />, color: '#3B82F6' },
    { name: 'Memory Usage', value: 61, unit: '%', icon: <HardDrive className="w-5 h-5 text-green-600" />, color: '#10B981' },
    { name: 'Stream Latency', value: 12, unit: 'ms', icon: <Gauge className="w-5 h-5 text-yellow-600" />, color: '#F59E0B' },
    { name: 'Packet Loss', value: 0.4, unit: '%', icon: <Activity className="w-5 h-5 text-red-600" />, color: '#EF4444' }
  ]);

  const [alerts] = useState<Alert[]>([
    { id: '1', level: 'error', message: 'High Noise on CH7', time: '14:05' },
    { id: '2', level: 'warning', message: 'Device Disconnect (reconnecting)', time: '14:03' },
    { id: '3', level: 'info', message: 'Missing packets detected', time: '14:01' }
  ]);

  const [logs] = useState<LogEntry[]>([
    { time: '14:02', message: 'Session started' },
    { time: '14:03', message: 'Event added: stimulus' },
    { time: '14:04', message: 'Noise filter applied' },
    { time: '14:05', message: 'Channel 7 recalibrated' }
  ]);

  const channelsRef = useRef<EEGChannel[]>(channels);
  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  // Simulate real-time updates
  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      setChannels(prev => prev.map(ch => ({
        ...ch,
        data: [...ch.data.slice(1), ch.data[ch.data.length - 1] + (Math.random() - 0.5) * 20]
      })));

      setBands(prev => prev.map(band => ({
        ...band,
        value: Math.max(5, Math.min(100, band.value + (Math.random() - 0.5) * 10))
      })));
    }, 100);

    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    if (!isRecording || !backendSessionId) return;

    const interval = setInterval(async () => {
      try {
        const activeChannels = channelsRef.current.slice(0, channelCount);
        const payloadChannels = Object.fromEntries(
          activeChannels.map((channel) => [
            channel.name,
            Number((channel.data[channel.data.length - 1] || 0).toFixed(3)),
          ]),
        );

        await fetch(`${API_BASE}/session/${backendSessionId}/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timestamp: Date.now() / 1000,
            channels: payloadChannels,
            sample_rate: 256,
          }),
        });
      } catch {
        // keep UI running even if backend stream is temporarily unavailable
      }
    }, 500);

    return () => clearInterval(interval);
  }, [API_BASE, backendSessionId, channelCount, isRecording]);

  const startBackendSession = useCallback(async () => {
    const params = new URLSearchParams({
      user_id: `clinical_${Math.random().toString(36).slice(2, 9)}`,
      session_name: session,
    });

    const response = await fetch(`${API_BASE}/session/start?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.detail || 'Failed to start ALBI backend session');
    }

    const payload = await response.json();
    setBackendSessionId(payload.session_id || null);
  }, [API_BASE, session]);

  const stopBackendSession = useCallback(async () => {
    if (!backendSessionId) return;
    try {
      await fetch(`${API_BASE}/session/${backendSessionId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // session may already be closed; ignore
    }
    setBackendSessionId(null);
  }, [API_BASE, backendSessionId]);

  const handleStartStop = useCallback(async () => {
    try {
      if (!isRecording) {
        await startBackendSession();
        setIsRecording(true);
        return;
      }

      setIsRecording(false);
      await stopBackendSession();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to toggle ALBI session';
      console.error('[eeg-analysis] session toggle error:', err);
      alert(message);
    }
  }, [isRecording, startBackendSession, stopBackendSession]);

  const handleExport = useCallback(() => {
    if (!backendSessionId) {
      alert('No active ALBI session found. Start a session first to export PDF.');
      return;
    }
    window.open(`${API_BASE}/session/${backendSessionId}/export?format=pdf`, '_blank');
  }, [API_BASE, backendSessionId]);

  const handleAddEvent = useCallback(() => {
    const newEvent: TimelineEvent = {
      id: Date.now().toString(),
      type: 'marker',
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      label: 'Manual Marker'
    };
    setEvents(prev => [...prev, newEvent]);
  }, []);

  const dominantBand = bands.reduce((a, b) => a.value > b.value ? a : b).name;

  // ============================================================================
  // RENDER
  // ============================================================================

  if (mode === 'observability') {
    return (
      <div className="min-h-screen bg-slate-100">
        <ObservabilityHeader onBack={() => setMode('clinical')} session={session} />

        <div className="p-6 space-y-6">
          {/* Metrics Row */}
          <div className="grid grid-cols-4 gap-4">
            {metrics.map(metric => (
              <MetricCard key={metric.name} metric={metric} />
            ))}
          </div>

          {/* Band Power Chart */}
          <BandPowerChart />

          {/* Artifact Chart */}
          <ArtifactChart />

          {/* Alerts & Logs */}
          <div className="grid grid-cols-2 gap-6">
            <AlertsPanel alerts={alerts} />
            <LogsPanel logs={logs} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Header
        session={session}
        setSession={setSession}
        isConnected={isConnected}
        isRecording={isRecording}
        onStartStop={handleStartStop}
        onExport={handleExport}
        onToggleMode={() => setMode('observability')}
        mode={mode}
      />

      <div className="p-6 space-y-6">
        {/* Main Panels */}
        <div className="grid grid-cols-2 gap-6" style={{ minHeight: '500px' }}>
          <LiveEEGPanel
            channels={channels}
            channelCount={channelCount}
            setChannelCount={setChannelCount}
            noiseFilter={noiseFilter}
            setNoiseFilter={setNoiseFilter}
            zoom={zoom}
            setZoom={setZoom}
          />
          <BrainwaveBandsPanel bands={bands} dominantBand={dominantBand} />
        </div>

        {/* Session Timeline */}
        <SessionTimeline events={events} onAddEvent={handleAddEvent} />
      </div>
    </div>
  );
}








