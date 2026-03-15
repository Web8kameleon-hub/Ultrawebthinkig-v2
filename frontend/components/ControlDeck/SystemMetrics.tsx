import React from "react";
import "./ControlDeck.css";

export interface SystemMetricsData {
  cpu: number; // percentage
  ram: number; // percentage
  uptime: string;
  modules: {
    name: "ALBI" | "ALBA" | "JONA";
    status: "ACTIVE" | "IDLE" | "WARN" | "ERROR";
    security: number;
    trend: "stable" | "fluctuating" | "declining";
  }[];
  bands: {
    delta: number;
    theta: number;
    alpha: number;
    beta: number;
    gamma: number;
  };
  lastCheck: string;
}

interface Props {
  data: SystemMetricsData;
}

/**
 * SystemMetrics — shows real-time metrics from ALBI/ALBA/JONA and
 * neuro-frequency bands (Delta → Gamma).
 */
export const SystemMetrics: React.FC<Props> = ({ data }) => {
  return (
    <div className="system-metrics">
      <header className="system-metrics__header">
        <h3>🧠 System Metrics</h3>
        <span className="system-metrics__timestamp">
          {new Date(data.lastCheck).toLocaleTimeString()}
        </span>
      </header>

      {/* CPU / RAM */}
      <div className="system-metrics__resources">
        <div className="metric">
          <span className="metric__label">CPU</span>
          <span className="metric__value">{data.cpu.toFixed(1)}%</span>
          <div className="mini-progress">
            <div
              className="mini-progress__bar"
              style={{ width: `${data.cpu}%` }}
            />
          </div>
        </div>

        <div className="metric">
          <span className="metric__label">RAM</span>
          <span className="metric__value">{data.ram.toFixed(1)}%</span>
          <div className="mini-progress">
            <div
              className="mini-progress__bar"
              style={{ width: `${data.ram}%` }}
            />
          </div>
        </div>

        <div className="metric">
          <span className="metric__label">Uptime</span>
          <span className="metric__value">{data.uptime}</span>
        </div>
      </div>

      {/* Modules */}
      <div className="system-metrics__modules">
        {data.modules.map((m) => (
          <div
            key={m.name}
            className={`status-pill status-pill--${m.status.toLowerCase()}`}
          >
            <span className="status-pill__dot"></span>
            {m.name}: {m.status} ({m.trend}) • {m.security.toFixed(1)}%
          </div>
        ))}
      </div>

      {/* Brainwave bands */}
      <div className="system-metrics__bands">
        <h4>Neural Frequency Bands</h4>
        <div className="activity-bands">
          {Object.entries(data.bands).map(([band, value]) => (
            <div
              key={band}
              className={`activity-band activity-band--${band}`}
              title={`${band.toUpperCase()} ${value.toFixed(2)}Hz`}
            >
              <div
                className="activity-band__fill"
                style={{ width: `${Math.min(value * 2, 100)}%` }}
              ></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SystemMetrics;
