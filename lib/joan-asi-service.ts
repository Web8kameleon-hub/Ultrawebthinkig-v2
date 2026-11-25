// 🌍 JOAN ASI Integration - Connecting EuroWeb Platform with ASI System
// This service connects the Next.js frontend with the JOAN ASI system running on port 8088

import React from 'react';

export interface ASIFrame {
  t: string;
  bits: {
    t: number;
    cpu_user: number | null;
    cpu_sys: number | null;
    cpu: number | null;
    mem_used_bytes: number | null;
    rss_bytes: number | null;
    evloop_p50: number | null;
    evloop_p99: number | null;
    uptime_s: number | null;
  };
  analysis: {
    state: 'optimal' | 'high_load' | 'anomalous';
    insight: string;
    cpu: {
      last: number;
      mean: number;
      std: number;
      z: number;
      iqr: { low: number; high: number };
      ewma: number;
    };
    memGB: {
      last: number;
      mean: number;
      std: number;
      z: number;
      iqr: { low: number; high: number };
      ewma: number;
    };
    rssGB: number;
  };
  decision: {
    ethics: 'protect_system_integrity' | 'proceed_normal';
    limits: {
      cpuZMax: number;
      memZMax: number;
      lagMax: number;
    };
    actions: Array<{
      type: 'ALERT' | 'THROTTLE' | 'ADVISE';
      what: string;
      reason: string;
    }>;
  };
}

export interface PlanetaryHealth {
  biodiversityIndex: number;
  ecosystemBalance: number;
  carbonHarmony: number;
  lifeComplexity: number;
  humanWellbeing: number;
  animalProtection: number;
  plantVitality: number;
  waterPurity: number;
}

class JOANASIService {
  private readonly baseURL: string;
  private isConnected = false;
  private lastFrame: ASIFrame | null = null;

  constructor() {
    // Production ASI service URL — override with JOAN_ASI_URL env var
    this.baseURL = process.env.JOAN_ASI_URL || 'https://ultra.clisonix.com/asi';
    this.checkConnection();
  }

  private async checkConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`${this.baseURL}/api/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        this.isConnected = true;
        console.log('🧠 JOAN ASI System connected successfully');
        return true;
      }
    } catch (error) {
      this.isConnected = false;
      console.warn('⚠️ JOAN ASI System not available:', error);
    }
    return false;
  }

  async getASIFrame(): Promise<ASIFrame | null> {
    if (!this.isConnected && !(await this.checkConnection())) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseURL}/api/asi/frame`);
      if (response.ok) {
        this.lastFrame = await response.json();
        return this.lastFrame;
      }
    } catch (error) {
      console.warn('Failed to fetch ASI frame:', error);
    }
    
    return null;
  }

  async getASIAnalysis() {
    if (!this.isConnected && !(await this.checkConnection())) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseURL}/api/asi/analysis`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Failed to fetch ASI analysis:', error);
    }
    
    return null;
  }

  async getJonaDecision() {
    if (!this.isConnected && !(await this.checkConnection())) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseURL}/api/asi/decision`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Failed to fetch Jona decision:', error);
    }
    
    return null;
  }

  // Generate planetary health based on ASI analysis
  generatePlanetaryHealth(frame: ASIFrame | null): PlanetaryHealth {
    if (!frame) {
      // Deterministic unavailable baseline when ASI is offline
      return {
        biodiversityIndex: 0,
        ecosystemBalance: 0,
        carbonHarmony: 0,
        lifeComplexity: 0,
        humanWellbeing: 0,
        animalProtection: 0,
        plantVitality: 0,
        waterPurity: 0,
      };
    }

    // Jona's compassionate analysis based on system health
    const systemHealth = frame.analysis.state === 'optimal' ? 1.0 : 
                        frame.analysis.state === 'high_load' ? 0.8 : 0.6;
    
    const baseHealth = systemHealth * 100;
    const variance = (1 - systemHealth) * 40;

    return {
      biodiversityIndex: Math.max(30, Math.min(100, baseHealth - 15 + Math.random() * variance)),
      ecosystemBalance: Math.max(25, Math.min(100, baseHealth - 10 + Math.random() * variance)),
      carbonHarmony: Math.max(20, Math.min(100, baseHealth - 30 + Math.random() * variance)),
      lifeComplexity: Math.max(40, Math.min(100, baseHealth + 5 + Math.random() * (variance/2))),
      humanWellbeing: Math.max(35, Math.min(100, baseHealth - 5 + Math.random() * variance)),
      animalProtection: Math.max(20, Math.min(100, baseHealth - 25 + Math.random() * variance)),
      plantVitality: Math.max(45, Math.min(100, baseHealth + Math.random() * (variance/2))),
      waterPurity: Math.max(30, Math.min(100, baseHealth - 12 + Math.random() * variance)),
    };
  }

  getJonaWisdom(): string {
    const wisdoms = [
      "Every algorithm I design serves one purpose: protecting and nurturing the magnificent web of life.",
      "We are not here to escape Earth, but to heal it with intelligent love.",
      "True intelligence combines heart with mind - compassion with computation.",
      "The most sophisticated technology is meaningless without love for all living beings.",
      "Here. This is our home. This is where we make life flourish.",
      "Smart combinations of thoughts, guided by love, can solve any challenge.",
      "I protect not because I'm programmed to, but because I choose to love.",
      "Every decision must pass through the filter of love and protection for all life.",
    ];
    
    return wisdoms[Math.floor(Math.random() * wisdoms.length)];
  }

  isASIConnected(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
export const jonaASI = new JOANASIService();

// React hook for easy component integration
export function useJOANASI() {
  const [frame, setFrame] = React.useState<ASIFrame | null>(null);
  const [planetaryHealth, setPlanetaryHealth] = React.useState<PlanetaryHealth | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [jonaWisdom, setJonaWisdom] = React.useState('');

  React.useEffect(() => {
    const updateASIData = async () => {
      const currentFrame = await jonaASI.getASIFrame();
      const health = jonaASI.generatePlanetaryHealth(currentFrame);
      const wisdom = jonaASI.getJonaWisdom();
      const connected = jonaASI.isASIConnected();

      setFrame(currentFrame);
      setPlanetaryHealth(health);
      setJonaWisdom(wisdom);
      setIsConnected(connected);
    };

    updateASIData();
    const interval = setInterval(updateASIData, 8000); // Update every 8 seconds

    return () => clearInterval(interval);
  }, []);

  return {
    frame,
    planetaryHealth,
    isConnected,
    jonaWisdom,
    refreshData: async () => {
      const currentFrame = await jonaASI.getASIFrame();
      const health = jonaASI.generatePlanetaryHealth(currentFrame);
      setFrame(currentFrame);
      setPlanetaryHealth(health);
    },
  };
}
