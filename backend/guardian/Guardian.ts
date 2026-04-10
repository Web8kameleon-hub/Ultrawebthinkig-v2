/**
 * Guardian Security Module - REAL DATA ONLY
 *
 * Returns measured browser data when available.
 * For unsupported/server context returns no-data equivalents (0 / [] / "no data").
 */

interface SecurityMetrics {
  activeConnections: number;
  openPorts: number[];
  runningProcesses: number;
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
  networkActivity: NetworkActivity;
  systemInfo: SystemInfo;
  securityAlerts: SecurityAlert[];
  timestamp: string;
}

interface NetworkActivity {
  totalConnections: number;
  activeListeners: number;
  establishedConnections: number;
  timeWaitConnections: number;
}

interface SystemInfo {
  platform: string;
  architecture: string;
  cpuCores: number;
  totalMemory: number;
  uptime: number;
  networkInterfaces: string[];
}

interface SecurityAlert {
  level: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  source: string;
}

class GuardianSecurity {
  private alerts: SecurityAlert[] = [];
  private startTime = Date.now();

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined' && typeof navigator !== 'undefined';
  }

  private async getRealMemoryUsage(): Promise<number> {
    try {
      if (!this.isBrowser()) return 0;

      if ('memory' in performance && (performance as any).memory) {
        const memory = (performance as any).memory;
        const used = memory.usedJSHeapSize || 0;
        const total = memory.totalJSHeapSize || memory.jsHeapSizeLimit || 0;
        if (total > 0) {
          return Math.round((used / total) * 100);
        }
      }

      return 0;
    } catch (error) {
      this.addAlert('warning', `Memory check failed: ${error}`, 'memory-monitor');
      return 0;
    }
  }

  private getRealCpuInfo(): { cores: number; usage: number } {
    try {
      if (!this.isBrowser()) return { cores: 0, usage: 0 };

      const cores = navigator.hardwareConcurrency || 0;
      return { cores, usage: 0 };
    } catch (error) {
      this.addAlert('warning', `CPU check failed: ${error}`, 'cpu-monitor');
      return { cores: 0, usage: 0 };
    }
  }

  private async getRealNetworkConnections(): Promise<NetworkActivity> {
    try {
      if (!this.isBrowser()) {
        return {
          totalConnections: 0,
          activeListeners: 0,
          establishedConnections: 0,
          timeWaitConnections: 0,
        };
      }

      const resourceTiming = performance.getEntriesByType('resource');
      const recentRequests = resourceTiming.filter((entry) => entry.startTime > performance.now() - 60000);
      const establishedConnections = recentRequests.filter((entry) => !!entry.duration && entry.duration > 0).length;

      return {
        totalConnections: recentRequests.length,
        activeListeners: 0,
        establishedConnections,
        timeWaitConnections: Math.max(0, recentRequests.length - establishedConnections),
      };
    } catch (error) {
      this.addAlert('warning', `Network scan failed: ${error}`, 'network-monitor');
      return {
        totalConnections: 0,
        activeListeners: 0,
        establishedConnections: 0,
        timeWaitConnections: 0,
      };
    }
  }

  private async getRealStorageUsage(): Promise<number> {
    try {
      if (!this.isBrowser()) return 0;

      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const quota = estimate.quota || 0;
        if (quota > 0) return Math.round((used / quota) * 100);
      }

      return 0;
    } catch (error) {
      this.addAlert('warning', `Storage check failed: ${error}`, 'storage-monitor');
      return 0;
    }
  }

  private getRealSystemInfo(): SystemInfo {
    if (!this.isBrowser()) {
      return {
        platform: 'no data',
        architecture: 'no data',
        cpuCores: 0,
        totalMemory: 0,
        uptime: Date.now() - this.startTime,
        networkInterfaces: [],
      };
    }

    const userAgent = navigator.userAgent;
    let platform = 'Unknown';

    if (userAgent.includes('Windows')) platform = 'Windows';
    else if (userAgent.includes('Mac')) platform = 'macOS';
    else if (userAgent.includes('Linux')) platform = 'Linux';
    else if (userAgent.includes('Android')) platform = 'Android';
    else if (userAgent.includes('iOS')) platform = 'iOS';

    return {
      platform,
      architecture: navigator.platform || 'no data',
      cpuCores: navigator.hardwareConcurrency || 0,
      totalMemory: ((navigator as any).deviceMemory || 0) * 1024 * 1024 * 1024,
      uptime: Date.now() - this.startTime,
      networkInterfaces: [],
    };
  }

  private getRealOpenPorts(): number[] {
    if (!this.isBrowser()) return [];

    const activePorts: number[] = [];
    const currentPort = parseInt(window.location.port, 10) || (window.location.protocol === 'https:' ? 443 : 80);
    activePorts.push(currentPort);
    return [...new Set(activePorts)].sort((a, b) => a - b);
  }

  private addAlert(level: 'info' | 'warning' | 'critical', message: string, source: string): void {
    this.alerts.unshift({
      level,
      message,
      timestamp: new Date().toISOString(),
      source,
    });

    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(0, 50);
    }
  }

  private async analyzeSecurityThreats(): Promise<void> {
    const memoryUsage = await this.getRealMemoryUsage();
    const cpuInfo = this.getRealCpuInfo();
    const storageUsage = await this.getRealStorageUsage();
    const networkActivity = await this.getRealNetworkConnections();

    if (memoryUsage > 80) {
      this.addAlert('warning', `High memory usage detected: ${memoryUsage}%`, 'memory-analyzer');
    }

    if (cpuInfo.usage > 80) {
      this.addAlert('warning', `High CPU usage detected: ${cpuInfo.usage}%`, 'cpu-analyzer');
    }

    if (storageUsage > 80) {
      this.addAlert('warning', `High storage usage: ${storageUsage}%`, 'storage-analyzer');
    }

    if (networkActivity.totalConnections > 50) {
      this.addAlert('info', `High network activity: ${networkActivity.totalConnections} connections`, 'network-analyzer');
    }

    if (!this.isBrowser()) {
      return;
    }

    if (window.location.protocol === 'https:' && document.querySelectorAll('[src^="http:"]').length > 0) {
      this.addAlert('warning', 'Mixed content detected - HTTP resources on HTTPS page', 'content-security');
    }

    const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!cspMeta) {
      this.addAlert('info', 'No Content Security Policy detected', 'security-headers');
    }
  }

  public async getDashboard(): Promise<SecurityMetrics> {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.alerts = this.alerts.filter((alert) => new Date(alert.timestamp).getTime() > oneHourAgo);

    await this.analyzeSecurityThreats();

    const networkActivity = await this.getRealNetworkConnections();
    const openPorts = this.getRealOpenPorts();
    const memoryUsage = await this.getRealMemoryUsage();
    const cpuInfo = this.getRealCpuInfo();
    const storageUsage = await this.getRealStorageUsage();
    const systemInfo = this.getRealSystemInfo();

    return {
      activeConnections: networkActivity.totalConnections,
      openPorts,
      runningProcesses: 0,
      memoryUsage,
      cpuUsage: cpuInfo.usage,
      diskUsage: storageUsage,
      networkActivity,
      systemInfo,
      securityAlerts: this.alerts,
      timestamp: new Date().toISOString(),
    };
  }

  public async getNetworkStatus() {
    return await this.getRealNetworkConnections();
  }

  public async getSystemHealth() {
    const memoryUsage = await this.getRealMemoryUsage();
    const cpuInfo = this.getRealCpuInfo();
    const storageUsage = await this.getRealStorageUsage();

    return {
      memory: memoryUsage,
      cpu: cpuInfo.usage,
      disk: storageUsage,
      processes: 0,
      uptime: Date.now() - this.startTime,
      timestamp: new Date().toISOString(),
    };
  }
}

export const guardian = new GuardianSecurity();
