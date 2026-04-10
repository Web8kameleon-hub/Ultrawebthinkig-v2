/**
 * ASI (Albanian System Intelligence) Core Engine
 * Core engine për Albanian Language Processing dhe Real-Time Intelligence
 * 
 * @author Ledjan Ahmati
 * @version 8.0.0 Web8
 */

// ASI Core Types
export interface ASIStatus {
  isActive: boolean;
  timestamp: number;
  activeModules: string[];
  processingQueue: number;
  language: 'sq' | 'en' | 'mixed';
  confidence: number;
}

export interface ASIResponse {
  id: string;
  text: string;
  language: 'sq' | 'en' | 'mixed';
  confidence: number;
  timestamp: number;
  processing_time: number;
  modules_used: string[];
  intelligence_level: 'basic' | 'standard' | 'advanced' | 'expert';
}

export interface ASIModule {
  id: string;
  name: string;
  nameAlbanian: string;
  status: 'active' | 'standby' | 'processing' | 'error';
  type: 'medical' | 'general' | 'technical' | 'cultural' | 'academic';
  capabilities: string[];
  description: string;
  descriptionAlbanian: string;
}

export interface ASIMemory {
  responses: ASIResponse[];
  language_patterns: Record<string, number>;
  user_preferences: Record<string, any>;
  processing_stats: {
    total_processed: number;
    avg_response_time: number;
    accuracy_rate: number;
    language_distribution: Record<string, number>;
  };
}

// ASI Core State Management
class ASICoreEngine {
  private status: ASIStatus;
  private memory: ASIMemory;
  private listeners: Set<(status: ASIStatus) => void> = new Set();
  private modules: Map<string, ASIModule> = new Map();
  private requestSequence = 0;
  private prefetchCache = new Map<string, { text: string; confidence: number; expiresAt: number }>();

  constructor() {
    this.status = {
      isActive: false,
      timestamp: Date.now(),
      activeModules: [],
      processingQueue: 0,
      language: 'sq',
      confidence: 1.0
    };

    this.memory = {
      responses: [],
      language_patterns: {
        'sq': 0,
        'en': 0,
        'mixed': 0
      },
      user_preferences: {},
      processing_stats: {
        total_processed: 0,
        avg_response_time: 0,
        accuracy_rate: 0.95,
        language_distribution: { 'sq': 0, 'en': 0, 'mixed': 0 }
      }
    };

    this.initializeModules();
  }

  private initializeModules(): void {
    // Core ASI Modules
    const coreModules: ASIModule[] = [
      {
        id: 'asi-medical',
        name: 'Medical Intelligence',
        nameAlbanian: 'Inteligjenca Mjekësore',
        status: 'active',
        type: 'medical',
        capabilities: ['diagnosis', 'symptoms', 'treatment', 'prevention'],
        description: 'Advanced medical AI for diagnosis and treatment recommendations',
        descriptionAlbanian: 'AI mjekësore e avancuar për diagnozë dhe rekomandime trajtimi'
      },
      {
        id: 'asi-general',
        name: 'General Intelligence',
        nameAlbanian: 'Inteligjenca e Përgjithshme',
        status: 'active',
        type: 'general',
        capabilities: ['conversation', 'questions', 'assistance', 'guidance'],
        description: 'General AI for everyday assistance and conversation',
        descriptionAlbanian: 'AI e përgjithshme për ndihmë dhe bisedë të përditshme'
      },
      {
        id: 'asi-cultural',
        name: 'Cultural Intelligence',
        nameAlbanian: 'Inteligjenca Kulturore',
        status: 'active',
        type: 'cultural',
        capabilities: ['traditions', 'history', 'customs', 'language'],
        description: 'Albanian cultural and historical knowledge system',
        descriptionAlbanian: 'Sistem dijesh për kulturën dhe historinë shqiptare'
      },
      {
        id: 'asi-technical',
        name: 'Technical Intelligence',
        nameAlbanian: 'Inteligjenca Teknike',
        status: 'active',
        type: 'technical',
        capabilities: ['programming', 'engineering', 'analysis', 'solutions'],
        description: 'Technical and engineering intelligence system',
        descriptionAlbanian: 'Sistem inteligjence teknike dhe inxhinierike'
      }
    ];

    coreModules.forEach(module => {
      this.modules.set(module.id, module);
    });
  }

  // Core Methods
  public activateASI(): void {
    this.status.isActive = true;
    this.status.timestamp = Date.now();
    this.status.activeModules = Array.from(this.modules.keys());
    this.notifyListeners();
  }

  public deactivateASI(): void {
    this.status.isActive = false;
    this.status.timestamp = Date.now();
    this.status.activeModules = [];
    this.notifyListeners();
  }

  public getStatus(): ASIStatus {
    return { ...this.status };
  }

  public getMemory(): ASIMemory {
    return JSON.parse(JSON.stringify(this.memory));
  }

  public getModules(): ASIModule[] {
    return Array.from(this.modules.values());
  }

  public getModule(id: string): ASIModule | null {
    return this.modules.get(id) || null;
  }

  // Language Processing
  public detectLanguage(text: string): 'sq' | 'en' | 'mixed' {
    // Albanian language patterns
    const albanianPatterns = [
      /\b(është|dhe|ose|por|në|me|nga|për|që|do|kam|ke|ka|kemi|keni|kanë)\b/gi,
      /[ëçajkshtnjvzpqm]/gi,
      /\b(mirë|faleminderit|përshëndetje|si|çfarë|kur|ku|pse|si)\b/gi
    ];

    // English patterns
    const englishPatterns = [
      /\b(the|and|or|but|in|with|from|for|that|will|have|has|am|is|are)\b/gi,
      /\b(good|thank|hello|how|what|when|where|why|how)\b/gi
    ];

    let albanianScore = 0;
    let englishScore = 0;

    albanianPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) albanianScore += matches.length;
    });

    englishPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) englishScore += matches.length;
    });

    if (albanianScore > 0 && englishScore > 0) return 'mixed';
    if (albanianScore > englishScore) return 'sq';
    if (englishScore > albanianScore) return 'en';
    
    return 'sq'; // Default to Albanian
  }

  // Processing Methods
  public async processRequest(text: string, moduleIds?: string[]): Promise<ASIResponse> {
    const startTime = Date.now();
    const language = this.detectLanguage(text);
    this.requestSequence += 1;
    const requestId = `ASI_${Date.now()}_${this.requestSequence}`;

    // Update processing queue
    this.status.processingQueue++;
    this.status.language = language;
    this.notifyListeners();

    // Determine modules to use
    const modulesToUse = moduleIds || Array.from(this.modules.keys());
    const activeModules = modulesToUse.filter(id => 
      this.modules.has(id) && this.modules.get(id)?.status === 'active'
    );

    const cacheKey = this.buildPrefetchKey(text, language, activeModules);
    const cached = this.prefetchCache.get(cacheKey);

    // Real processing through platform AI API (Ollama primary)
    const aiResult = cached && cached.expiresAt > Date.now()
      ? { text: cached.text, confidence: cached.confidence }
      : await this.callPlatformAI(text, language, activeModules);

    this.prefetchCache.set(cacheKey, {
      text: aiResult.text,
      confidence: aiResult.confidence,
      expiresAt: Date.now() + 30_000,
    });
    const processingTime = Date.now() - startTime;

    // Create ASI Response
    const asiResponse: ASIResponse = {
      id: requestId,
      text: aiResult.text,
      language,
      confidence: aiResult.confidence,
      timestamp: Date.now(),
      processing_time: processingTime,
      modules_used: activeModules,
      intelligence_level: this.determineIntelligenceLevel(activeModules)
    };

    // Update memory and stats
    this.memory.responses.push(asiResponse);
    this.memory.language_patterns[language] = (this.memory.language_patterns[language] || 0) + 1;
    this.memory.processing_stats.total_processed++;
    this.memory.processing_stats.language_distribution[language] = (this.memory.processing_stats.language_distribution[language] || 0) + 1;
    this.memory.processing_stats.avg_response_time =
      this.memory.processing_stats.total_processed === 1
        ? processingTime
        : Math.round(
            ((this.memory.processing_stats.avg_response_time * (this.memory.processing_stats.total_processed - 1)) + processingTime) /
              this.memory.processing_stats.total_processed
          );
    this.memory.processing_stats.accuracy_rate = aiResult.confidence;
    
    // Keep only last 100 responses
    if (this.memory.responses.length > 100) {
      this.memory.responses = this.memory.responses.slice(-100);
    }

    // Update processing queue
    this.status.processingQueue--;
    this.status.confidence = aiResult.confidence;
    this.notifyListeners();

    return asiResponse;
  }

  private async callPlatformAI(
    text: string,
    language: 'sq' | 'en' | 'mixed',
    modules: string[]
  ): Promise<{ text: string; confidence: number }> {
    try {
      const isMedical = modules.includes('asi-medical');
      const endpoints = isMedical
        ? ['/api/albamed/ai', '/api/chat']
        : ['/api/chat'];

      for (const endpoint of endpoints) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            mode: 'focused',
            personality: isMedical ? 'scientist' : 'assistant',
            language,
            chunkSize: 320,
            modules,
            context: [`ASI modules: ${modules.join(', ')}`],
          }),
        });

        if (!response.ok) continue;

        const data = await response.json();
        const outputText = typeof data?.response === 'string' && data.response.trim().length > 0 ? data.response : 'no data';
        const confidence = typeof data?.metadata?.confidence === 'number' ? data.metadata.confidence : 0;

        if (outputText !== 'no data') {
          return { text: outputText, confidence };
        }
      }

      return { text: 'no data', confidence: 0 };
    } catch {
      return { text: 'no data', confidence: 0 };
    }
  }

  private determineIntelligenceLevel(modules: string[]): 'basic' | 'standard' | 'advanced' | 'expert' {
    if (modules.length >= 4) return 'expert';
    if (modules.length >= 3) return 'advanced';
    if (modules.length >= 2) return 'standard';
    return 'basic';
  }

  public async prefetchRequest(text: string, moduleIds?: string[]): Promise<void> {
    const normalized = text.trim();
    if (!normalized) return;

    const language = this.detectLanguage(normalized);
    const modulesToUse = moduleIds || Array.from(this.modules.keys());
    const activeModules = modulesToUse.filter(id =>
      this.modules.has(id) && this.modules.get(id)?.status === 'active'
    );

    const cacheKey = this.buildPrefetchKey(normalized, language, activeModules);
    const cached = this.prefetchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return;

    const aiResult = await this.callPlatformAI(normalized, language, activeModules);
    this.prefetchCache.set(cacheKey, {
      text: aiResult.text,
      confidence: aiResult.confidence,
      expiresAt: Date.now() + 30_000,
    });
  }

  private buildPrefetchKey(
    text: string,
    language: 'sq' | 'en' | 'mixed',
    modules: string[]
  ): string {
    return `${language}::${modules.slice().sort().join(',')}::${text.trim()}`;
  }

  // Event System
  public addStatusListener(listener: (status: ASIStatus) => void): void {
    this.listeners.add(listener);
  }

  public removeStatusListener(listener: (status: ASIStatus) => void): void {
    this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getStatus());
      } catch (error) {
        console.error('ASI Status listener error:', error);
      }
    });
  }

  // Module Management
  public activateModule(moduleId: string): boolean {
    const module = this.modules.get(moduleId);
    if (module) {
      module.status = 'active';
      this.updateActiveModules();
      return true;
    }
    return false;
  }

  public deactivateModule(moduleId: string): boolean {
    const module = this.modules.get(moduleId);
    if (module) {
      module.status = 'standby';
      this.updateActiveModules();
      return true;
    }
    return false;
  }

  private updateActiveModules(): void {
    this.status.activeModules = Array.from(this.modules.values())
      .filter(module => module.status === 'active')
      .map(module => module.id);
    this.notifyListeners();
  }

  // System Health
  public getSystemHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    metrics: {
      uptime: number;
      response_time: number;
      accuracy: number;
      module_health: Record<string, 'ok' | 'warning' | 'error'>;
    };
  } {
    const moduleHealth: Record<string, 'ok' | 'warning' | 'error'> = {};
    
    Array.from(this.modules.values()).forEach(module => {
      moduleHealth[module.id] = module.status === 'active' ? 'ok' : 
                                module.status === 'error' ? 'error' : 'warning';
    });

    return {
      status: 'healthy',
      metrics: {
        uptime: Date.now() - this.status.timestamp,
        response_time: this.memory.processing_stats.avg_response_time,
        accuracy: this.memory.processing_stats.accuracy_rate,
        module_health: moduleHealth
      }
    };
  }
}

// Singleton Instance
const asiCore = new ASICoreEngine();

// Export Core Functions
export const activateASI = () => asiCore.activateASI();
export const deactivateASI = () => asiCore.deactivateASI();
export const getASIStatus = () => asiCore.getStatus();
export const getASIMemory = () => asiCore.getMemory();
export const getASIModules = () => asiCore.getModules();
export const getASIModule = (id: string) => asiCore.getModule(id);
export const processASIRequest = (text: string, modules?: string[]) => asiCore.processRequest(text, modules);
export const prefetchASIRequest = (text: string, modules?: string[]) => asiCore.prefetchRequest(text, modules);
export const addASIStatusListener = (listener: (status: ASIStatus) => void) => asiCore.addStatusListener(listener);
export const removeASIStatusListener = (listener: (status: ASIStatus) => void) => asiCore.removeStatusListener(listener);
export const activateASIModule = (moduleId: string) => asiCore.activateModule(moduleId);
export const deactivateASIModule = (moduleId: string) => asiCore.deactivateModule(moduleId);
export const getASISystemHealth = () => asiCore.getSystemHealth();

// Initialize ASI on import
activateASI();

export default asiCore;
