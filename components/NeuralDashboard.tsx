import React from 'react';
import styles from './NeuralDashboard.module.css';

interface StatCardProps {
  icon: string;
  title: string;
  stats: { label: string; value: string }[];
}

const StatCard: React.FC<StatCardProps> = ({ icon, title, stats }) => (
  <div className={styles.statCard}>
    <div className={styles.statIcon}>{icon}</div>
    <div className={styles.statTitle}>{title}</div>
    {stats.map((s) => (
      <div key={s.label} className={styles.statRow}>
        <span className={styles.statLabel}>{s.label}:</span>
        <span className={styles.statValue}>{s.value}</span>
      </div>
    ))}
  </div>
);

export const NeuralDashboard: React.FC = () => {
  return (
    <div className={styles.grid}>
      <StatCard
        icon="🧠"
        title="AGI Neural Core"
        stats={[
          { label: 'Consciousness Level', value: '85.7%' },
          { label: 'Neural Networks', value: 'Active' },
        ]}
      />
      <StatCard
        icon="🛰️"
        title="ALBA IoT Network"
        stats={[
          { label: 'Active Nodes', value: '8,293' },
          { label: 'Signal Strength', value: '95.9%' },
        ]}
      />
      <StatCard
        icon="⚡"
        title="ASI Quantum Engine"
        stats={[
          { label: 'Processing Units', value: '19,427' },
          { label: 'Efficiency', value: '95.1%' },
        ]}
      />
      <StatCard
        icon="🔬"
        title="System Analytics"
        stats={[
          { label: 'Neural Pathways', value: '2.48M' },
          { label: 'Quantum Coherence', value: 'Active' },
        ]}
      />
    </div>
  );
};

export default NeuralDashboard;
