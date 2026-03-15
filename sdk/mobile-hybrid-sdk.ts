/**
 * HYBRID BIOMETRIC SDK
 * Përdor sensorët e telefonit + integrohet me aparat profesionalë të klinikave
 * 
 * Telefonat: accelerometer, gyroscope, heart rate, temperature
 * Klinika: EEG profesional, ECG, pulse oximetry, blood pressure, etc.
 */

export interface PhoneSensorData {
  accelerometer: {
    x: number;
    y: number;
    z: number;
    timestamp: number;
  };
  gyroscope: {
    x: number;
    y: number;
    z: number;
    timestamp: number;
  };
  heartRate?: {
    bpm: number;
    confidence: number;
    timestamp: number;
  };
  temperature?: {
    celsius: number;
    timestamp: number;
  };
  proximity?: {
    distance: number; // in cm
    timestamp: number;
  };
}

export interface ClinicalDeviceData {
  deviceType: 'EEG' | 'ECG' | 'SpO2' | 'BloodPressure' | 'TemperatureProbe' | 'Spirometer' | 'Other';
  deviceId: string;
  deviceName: string;
  clinicId: string;
  data: {
    value: number | number[];
    unit: string;
    quality: number; // 0-100
    timestamp: number;
  };
  metadata?: Record<string, any>;
}

export interface HybridBiometricSession {
  sessionId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  dataSource: 'phone' | 'clinic' | 'hybrid';
  phoneSensorData: PhoneSensorData[];
  clinicalData: ClinicalDeviceData[];
  syncStatus: 'local' | 'syncing' | 'synced';
  storageLocation: 'phone' | 'cloud' | 'clinic-server';
}

export interface ClinicIntegrationConfig {
  clinicId: string;
  clinicName: string;
  apiEndpoint: string;
  apiKey: string;
  supportedDevices: string[];
  websocketUrl?: string;
  syncInterval: number; // ms
}

/**
 * PHONE SENSOR COLLECTOR
 * Mbërthen sensorët nativik të telefonit
 */
export class PhoneSensorCollector {
  private accelerometerData: any[] = [];
  private gyroscopeData: any[] = [];
  private heartRateData: any[] = [];
  private temperatureData: any[] = [];

  async startListening(options?: {
    sampleRate?: number;
    bufferSize?: number;
  }) {
    const sampleRate = options?.sampleRate || 100; // Hz
    const bufferSize = options?.bufferSize || 1000;

    // Accelerometer
    if ((window as any).DeviceMotionEvent) {
      window.addEventListener('devicemotion', (event) => {
        this.accelerometerData.push({
          x: event.acceleration?.x || 0,
          y: event.acceleration?.y || 0,
          z: event.acceleration?.z || 0,
          timestamp: Date.now(),
        });
        if (this.accelerometerData.length > bufferSize) {
          this.accelerometerData.shift();
        }
      });
    }

    // Gyroscope
    if ((window as any).DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (event) => {
        this.gyroscopeData.push({
          x: event.beta || 0,
          y: event.gamma || 0,
          z: event.alpha || 0,
          timestamp: Date.now(),
        });
        if (this.gyroscopeData.length > bufferSize) {
          this.gyroscopeData.shift();
        }
      });
    }
  }

  stopListening() {
    window.removeEventListener('devicemotion', null as any);
    window.removeEventListener('deviceorientation', null as any);
  }

  // Simulim i heart rate (kërkimi nëpër kamera ose i marrë nga sensori i built-in)
  async estimateHeartRate(): Promise<{ bpm: number; confidence: number }> {
    // Me kamera (PPG - Photoplethysmography)
    // ose duke përdorur sensori të built-in të telefonit
    // Këtu simulim:
    return {
      bpm: 60 + Math.random() * 40,
      confidence: 0.7 + Math.random() * 0.3,
    };
  }

  // Temperature - mund të marret nga sensori i built-in nëse ekziston
  async readTemperature(): Promise<number> {
    // Sensorë të ndryshëm të telefonit
    // Android: ThermalManager, iOS: nuk ka built-in
    // Fallback: simulim
    return 36.5 + (Math.random() - 0.5) * 2; // Normal body temp
  }

  async getCurrentData(): Promise<PhoneSensorData> {
    return {
      accelerometer: this.accelerometerData[this.accelerometerData.length - 1] || {
        x: 0,
        y: 0,
        z: 0,
        timestamp: Date.now(),
      },
      gyroscope: this.gyroscopeData[this.gyroscopeData.length - 1] || {
        x: 0,
        y: 0,
        z: 0,
        timestamp: Date.now(),
      },
      heartRate: { ...(await this.estimateHeartRate()), timestamp: Date.now() },
      temperature: { celsius: await this.readTemperature(), timestamp: Date.now() },
    };
  }

  getBufferedData(): PhoneSensorData[] {
    const buffer: PhoneSensorData[] = [];
    const minLength = Math.min(
      this.accelerometerData.length,
      this.gyroscopeData.length
    );

    for (let i = 0; i < minLength; i++) {
      buffer.push({
        accelerometer: this.accelerometerData[i],
        gyroscope: this.gyroscopeData[i],
      });
    }
    return buffer;
  }
}

/**
 * CLINIC DEVICE INTEGRATION
 * Lidhja me aparatet profesionale të klinikave
 */
export class ClinicDeviceIntegration {
  private config: ClinicIntegrationConfig;
  private websocket?: WebSocket;
  private deviceCache: Map<string, ClinicalDeviceData> = new Map();
  private authToken?: string;

  constructor(config: ClinicIntegrationConfig) {
    this.config = config;
  }

  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
        },
        body: JSON.stringify({
          clinicId: this.config.clinicId,
          timestamp: Date.now(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.authToken = data.token;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Clinic authentication failed:', error);
      return false;
    }
  }

  async connectToDevices(): Promise<string[]> {
    if (!this.authToken) {
      const authed = await this.authenticate();
      if (!authed) return [];
    }

    try {
      const response = await fetch(`${this.config.apiEndpoint}/devices/list`, {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      });

      if (response.ok) {
        const devices = await response.json();
        return devices.map((d: any) => d.id);
      }
      return [];
    } catch (error) {
      console.error('Failed to connect to clinic devices:', error);
      return [];
    }
  }

  async startRealTimeStream(sessionId: string) {
    if (this.config.websocketUrl) {
      this.websocket = new WebSocket(this.config.websocketUrl);

      this.websocket.onopen = () => {
        this.websocket?.send(
          JSON.stringify({
            action: 'subscribe',
            sessionId,
            token: this.authToken,
          })
        );
      };

      this.websocket.onmessage = (event) => {
        const clinicalData: ClinicalDeviceData = JSON.parse(event.data);
        this.deviceCache.set(clinicalData.deviceId, clinicalData);
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    }
  }

  stopRealTimeStream() {
    this.websocket?.close();
  }

  async fetchDeviceData(deviceId: string): Promise<ClinicalDeviceData | null> {
    if (this.deviceCache.has(deviceId)) {
      return this.deviceCache.get(deviceId) || null;
    }

    try {
      const response = await fetch(`${this.config.apiEndpoint}/devices/${deviceId}/latest`, {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.deviceCache.set(deviceId, data);
        return data;
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch device ${deviceId}:`, error);
      return null;
    }
  }

  async fetchAllDevicesData(): Promise<ClinicalDeviceData[]> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/devices/data/all`, {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        data.forEach((d: ClinicalDeviceData) => {
          this.deviceCache.set(d.deviceId, d);
        });
        return data;
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch all devices data:', error);
      return [];
    }
  }

  getCachedData(): ClinicalDeviceData[] {
    return Array.from(this.deviceCache.values());
  }
}

/**
 * HYBRID SESSION MANAGER
 * Orkestrimi i të dy burimeve të të dhënave
 */
export class HybridBiometricSessionManager {
  private phoneCollector: PhoneSensorCollector;
  private clinicIntegration?: ClinicDeviceIntegration;
  private currentSession: HybridBiometricSession | null = null;
  private syncInterval?: NodeJS.Timer;

  constructor(phoneCollector: PhoneSensorCollector, clinicConfig?: ClinicIntegrationConfig) {
    this.phoneCollector = phoneCollector;
    if (clinicConfig) {
      this.clinicIntegration = new ClinicDeviceIntegration(clinicConfig);
    }
  }

  async startSession(userId: string, dataSource: 'phone' | 'clinic' | 'hybrid' = 'hybrid'): Promise<HybridBiometricSession> {
    const sessionId = `session_${userId}_${Date.now()}`;

    this.currentSession = {
      sessionId,
      userId,
      startTime: Date.now(),
      dataSource,
      phoneSensorData: [],
      clinicalData: [],
      syncStatus: 'local',
      storageLocation: 'phone',
    };

    // Start phone sensors
    await this.phoneCollector.startListening();

    // Start clinic integration if available
    if (this.clinicIntegration && (dataSource === 'clinic' || dataSource === 'hybrid')) {
      const authenticated = await this.clinicIntegration.authenticate();
      if (authenticated) {
        await this.clinicIntegration.startRealTimeStream(sessionId);
      }
    }

    // Start sync timer
    if (this.clinicIntegration) {
      this.syncInterval = setInterval(async () => {
        if (this.currentSession) {
          this.currentSession.clinicalData = await this.clinicIntegration!.fetchAllDevicesData();
          this.currentSession.syncStatus = 'synced';
        }
      }, (this.clinicIntegration as any)?.config?.syncInterval || 5000);
    }

    return this.currentSession;
  }

  async stopSession(): Promise<HybridBiometricSession | null> {
    if (!this.currentSession) return null;

    this.phoneCollector.stopListening();
    this.clinicIntegration?.stopRealTimeStream();

    if (this.syncInterval) {
      clearInterval(this.syncInterval as any);
    }

    this.currentSession.endTime = Date.now();
    this.currentSession.syncStatus = 'synced';

    // Get final phone data
    this.currentSession.phoneSensorData = this.phoneCollector.getBufferedData();

    // Get final clinic data
    if (this.clinicIntegration) {
      this.currentSession.clinicalData = this.clinicIntegration.getCachedData();
    }

    const session = this.currentSession;
    this.currentSession = null;
    return session;
  }

  getCurrentSession(): HybridBiometricSession | null {
    return this.currentSession;
  }

  async addClinicalData(data: ClinicalDeviceData) {
    if (this.currentSession) {
      this.currentSession.clinicalData.push(data);
    }
  }

  async addPhoneData(data: PhoneSensorData) {
    if (this.currentSession) {
      this.currentSession.phoneSensorData.push(data);
    }
  }

  async syncToCloud(cloudEndpoint: string, authToken: string): Promise<boolean> {
    if (!this.currentSession) return false;

    try {
      const response = await fetch(`${cloudEndpoint}/sessions/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(this.currentSession),
      });

      if (response.ok) {
        this.currentSession.storageLocation = 'cloud';
        this.currentSession.syncStatus = 'synced';
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to sync to cloud:', error);
      return false;
    }
  }

  async syncToClinicServer(clinicEndpoint: string, authToken: string): Promise<boolean> {
    if (!this.currentSession) return false;

    try {
      const response = await fetch(`${clinicEndpoint}/sessions/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(this.currentSession),
      });

      if (response.ok) {
        this.currentSession.storageLocation = 'clinic-server';
        this.currentSession.syncStatus = 'synced';
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to sync to clinic server:', error);
      return false;
    }
  }
}

/**
 * EXPORT FUNCTIONS FOR EASY USE
 */

export async function initializeHybridSystem(config: {
  clinicConfig?: ClinicIntegrationConfig;
  cloudEndpoint?: string;
}) {
  const phoneCollector = new PhoneSensorCollector();
  const sessionManager = new HybridBiometricSessionManager(phoneCollector, config.clinicConfig);

  return {
    phoneCollector,
    sessionManager,
    clinicIntegration: config.clinicConfig
      ? new ClinicDeviceIntegration(config.clinicConfig)
      : null,
  };
}

export default {
  PhoneSensorCollector,
  ClinicDeviceIntegration,
  HybridBiometricSessionManager,
  initializeHybridSystem,
};
