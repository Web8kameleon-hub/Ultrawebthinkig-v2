// core/monitoring/PerformanceMonitor.ts
/**
 * 📈 PERFORMANCE MONITOR
 * Real-time Performance Tracking
 */

export interface PerformanceMetrics {
  fps: number;
  memory: number | null;
  latency: number | null;
  cpuUsage: number | null;
  networkLatency: number | null;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    fps: 60,
    memory: null,
    latency: null,
    cpuUsage: null,
    networkLatency: null
  };

  private lastTime = performance.now();
  private frameCount = 0;

  constructor() {
    this.startMonitoring();
  }

  private startMonitoring(): void {
    // FPS monitoring
    const updateFPS = () => {
      this.frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - this.lastTime >= 1000) {
        this.metrics.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
        this.frameCount = 0;
        this.lastTime = currentTime;
      }
      
      requestAnimationFrame(updateFPS);
    };
    
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(updateFPS);
    }

    // Memory monitoring
    this.updateMemoryUsage();
    setInterval(() => {
      this.updateMemoryUsage();
    }, 5000);
  }

  private updateMemoryUsage(): void {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      this.metrics.memory = Math.round(memory.usedJSHeapSize / 1024 / 1024); // MB
    } else {
      this.metrics.memory = null;
    }
  }

  getFPS(): number {
    return this.metrics.fps;
  }

  getMemoryUsage(): number | null {
    return this.metrics.memory;
  }

  getLatency(): number | null {
    return this.metrics.latency;
  }

  getCPUUsage(): number | null {
    return this.metrics.cpuUsage;
  }

  getAllMetrics(): PerformanceMetrics {
    return {
      ...this.metrics,
      latency: this.getLatency(),
      cpuUsage: this.getCPUUsage()
    };
  }

  recordMetric(name: string, value: number): void {
    console.log(`[Performance] ${name}: ${value}ms`);
  }

  recordError(context: string, error: any): void {
    console.error(`[Performance] Error in ${context}:`, error);
  }
}
