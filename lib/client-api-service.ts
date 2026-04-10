/**
 * UltraWebThinking - Client-Safe API Service
 * Frontend-compatible API integration without Node.js dependencies
 */

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  source: string;
  timestamp: number;
}

export interface APIHealthStatus {
  api: string;
  status: 'healthy' | 'error';
  source: string;
  duration: string;
  keyRequired: boolean;
  hasKey: boolean | string;
}

class ClientAPIService {
  /**
   * Frontend-safe API calls through our API routes
   */
  async callAPIRoute<T>(endpoint: string, params: any = {}): Promise<APIResponse<T>> {
    try {
      const response = await fetch(`/api/integration/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      const result = await response.json();
      return result;
    } catch (error) {
      return {
        success: false,
        error: `API call failed: ${error}`,
        source: 'client-error',
        timestamp: Date.now()
      };
    }
  }

  async healthCheck(): Promise<APIHealthStatus[]> {
    try {
      const response = await fetch('/api/integration/health');
      const result = await response.json();
      return result.data || [];
    } catch (error) {
      return [
        {
          api: 'integration-api',
          status: 'error',
          source: 'unreachable',
          duration: 'n/a',
          keyRequired: false,
          hasKey: 'N/A'
        }
      ];
    }
  }

  async getDashboardData() {
    try {
      const result = await this.callAPIRoute('health', { action: 'dashboard' });
      return result.data;
    } catch (error) {
      return {
        error: `Dashboard data unavailable: ${error}`,
        sources: 'unavailable',
        timestamp: Date.now(),
        weather: null,
        crypto: null,
        nasa: null,
        spacex: null,
        covid: null
      };
    }
  }

  async getWeather(city: string) {
    return this.callAPIRoute('health', { action: 'weather', params: { city } });
  }

  async getCrypto(symbols?: string[]) {
    return this.callAPIRoute('health', { action: 'crypto', params: { symbols } });
  }

  async getNews(category: string = 'technology') {
    return this.callAPIRoute('health', { action: 'news', params: { category } });
  }

  async getNASA() {
    return this.callAPIRoute('health', { action: 'nasa' });
  }

  async getSpaceX() {
    return this.callAPIRoute('health', { action: 'spacex' });
  }

  async getCovid(country: string = 'all') {
    return this.callAPIRoute('health', { action: 'covid', params: { country } });
  }
}

export const clientAPIService = new ClientAPIService();
export default clientAPIService;
