import React from "react";
import "./ControlDeck.css";
import "./EntityCard.css";

export interface Alert {
  id: string;
  source: "ALBI" | "ALBA" | "JONA" | "SYSTEM";
  level: "info" | "warn" | "error";
  message: string;
  timestamp: string;
  suggestion?: string;
}

interface AlertsPanelProps {
  alerts: Alert[];
  onAcknowledge?: (id: string) => void;
}

/**
 * AlertsPanel — shows real-time warnings and system alerts
 * Layer integrated with ControlDeck and EntityCard styles.
 */
export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  alerts,
  onAcknowledge,
}) => {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="alerts-panel alerts-panel--empty">
        <p className="alerts-panel__empty-text">✅ No active alerts — system stable.</p>
      </div>
    );
  }

  return (
    <div className="alerts-panel">
      <div className="alerts-panel__header">
        <h3 className="alerts-panel__title">⚠️ Active Alerts</h3>
        <span className="alerts-panel__count">{alerts.length}</span>
      </div>

      <div className="alerts-panel__list">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`alert alert--${alert.level.toLowerCase()}`}
          >
            <div className="alert__icon">
              {alert.level === "warn" && "🟠"}
              {alert.level === "error" && "🔴"}
              {alert.level === "info" && "🔵"}
            </div>

            <div className="alert__body">
              <div className="alert__source">
                <strong>{alert.source}</strong> •{" "}
                <span className="alert__time">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="alert__message">{alert.message}</div>
              {alert.suggestion && (
                <div className="alert__suggestion">
                  💡 {alert.suggestion}
                </div>
              )}
            </div>

            {onAcknowledge && (
              <div className="alert__cta">
                <button
                  className="btn btn--primary"
                  onClick={() => onAcknowledge(alert.id)}
                >
                  Acknowledge
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlertsPanel;
