// Performance Monitor - System Metrics & Analytics
export interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  memoryUsage: number | null;
  cpuUsage: number | null;
  timestamp: Date;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private startTime: number = Date.now();

  recordMetric(metric: Partial<PerformanceMetrics>): void {
    const fullMetric: PerformanceMetrics = {
      responseTime: metric.responseTime || 0,
      throughput: metric.throughput || 0,
      errorRate: metric.errorRate || 0,
      memoryUsage: metric.memoryUsage ?? null,
      cpuUsage: metric.cpuUsage ?? null,
      timestamp: new Date(),
      ...metric
    };

    this.metrics.push(fullMetric);
    
    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }

  getAverageResponseTime(): number {
    if (this.metrics.length === 0) return 0;
    const sum = this.metrics.reduce((acc, m) => acc + m.responseTime, 0);
    return sum / this.metrics.length;
  }

  getCurrentThroughput(): number {
    const recentMetrics = this.metrics.filter(
      m => Date.now() - m.timestamp.getTime() < 60000
    );
    return recentMetrics.length;
  }

  getErrorRate(): number {
    if (this.metrics.length === 0) return 0;
    const errors = this.metrics.filter(m => m.errorRate > 0).length;
    return (errors / this.metrics.length) * 100;
  }

  getSystemHealth(): 'excellent' | 'good' | 'fair' | 'poor' {
    const avgResponseTime = this.getAverageResponseTime();
    const errorRate = this.getErrorRate();

    if (avgResponseTime < 500 && errorRate < 1) return 'excellent';
    if (avgResponseTime < 1000 && errorRate < 5) return 'good';
    if (avgResponseTime < 2000 && errorRate < 10) return 'fair';
    return 'poor';
  }

  exportMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  reset(): void {
    this.metrics = [];
    this.startTime = Date.now();
  }
}
