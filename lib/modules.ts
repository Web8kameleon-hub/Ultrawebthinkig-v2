// lib/modules.ts - Shared Ultra SaaS modules data (46 total)
export interface ModuleCategory {
  id: string;
  title: string;
  icon: string;
  modules: ModuleItem[];
  color: string;
}

export interface ModuleItem {
  id: string;
  title: string;
  path: string;
  description: string;
  status: 'active' | 'beta' | 'new';
  icon: string;
  featured?: boolean;
}

export const moduleCategories: ModuleCategory[] = [
  // AGI System (8)
  {
    id: 'agi',
    title: 'AGI System',
    icon: '🧠',
    color: '#00ff88',
    modules: [
      { id: 'agi-core', title: 'AGI Core Ultra', path: '/agi', description: 'Advanced General Intelligence Core', status: 'active', icon: '🧠' },
      { id: 'agi-tunnel', title: 'AGI Tunnel', path: '/agi-tunnel', description: 'Neural Processing Tunnel', status: 'active', icon: '🌀' },
      { id: 'agi-med', title: 'Medical AGI', path: '/agimed-professional', description: 'Professional Medical AI', status: 'active', icon: '🏥' },
      { id: 'agi-eco', title: 'Eco AGI', path: '/economics/agixeco', description: 'Environmental Intelligence - Real API', status: 'active', icon: '🌿' },
      { id: 'agi-bio', title: 'Bio Nature AGI', path: '/medical/bionature', description: 'Biological Systems AI - Real API', status: 'active', icon: '🦋' },
      { id: 'agi-alba', title: 'Alba Med AGI', path: '/albamed-demo', description: 'Albanian Medical System', status: 'active', icon: '🇦🇱' },
      { id: 'ai-manager', title: 'AI Manager Dashboard', path: '/ai-manager', description: 'Neural Network Communication Interface', status: 'new', icon: '🤖' },
      { id: 'asi-dashboard', title: 'ASI Dashboard', path: '/ultra-saas/asi-dashboard', description: 'Albanian System Intelligence Control Panel', status: 'new', icon: '🎛️' }
    ]
  },
  // ASI (5)
  {
    id: 'asi',
    title: 'ASI (Albanian System Intelligence)',
    icon: '🇦🇱',
    color: '#ff6b6b',
    modules: [
      { id: 'asi-dashboard', title: 'ASI Dashboard', path: '/ultra-saas/asi-dashboard', description: 'Complete ASI Dashboard with WebSocket + 60+ API endpoints + Real-time Analytics', status: 'active', icon: '🎯' },
      { id: 'asi-core', title: 'ASI Core Engine', path: '/asi-core', description: 'Albanian System Intelligence Core', status: 'active', icon: '🧠' },
      { id: 'asi-medical', title: 'ASI Medical', path: '/asi-medical', description: 'Albanian Medical Intelligence', status: 'active', icon: '🏥' },
      { id: 'asi-cultural', title: 'ASI Cultural', path: '/asi-cultural', description: 'Albanian Cultural Intelligence', status: 'active', icon: '🏛️' },
      { id: 'asi-technical', title: 'ASI Technical', path: '/asi-technical', description: 'Albanian Technical Intelligence', status: 'active', icon: '⚙️' }
    ]
  },
  // Chat Systems (3)
  {
    id: 'chat',
    title: 'Chat Systems',
    icon: '💬',
    color: '#00ccff',
    modules: [
      { id: 'openmind', title: 'OpenMind Chat', path: '/openmind-chat', description: 'Advanced AI Chat System', status: 'active', icon: '🤖' },
      { id: 'enhanced-chat', title: 'Enhanced Chat', path: '/enhanced-chat', description: 'Ultra Enhanced Chat Interface', status: 'new', icon: '⚡' },
      { id: 'chat-demo', title: 'Chat Demo', path: '/chat-demo', description: 'Interactive Chat Demonstration', status: 'active', icon: '🎯' }
    ]
  },
  // Search Engines (4)
  {
    id: 'search',
    title: 'Search Engines',
    icon: '🔍',
    color: '#ffaa00',
    modules: [
      { id: 'neural-search', title: 'Neural Search', path: '/neural-search', description: 'AI-Powered Search Engine', status: 'active', icon: '🧠' },
      { id: 'real-search', title: 'Real Search', path: '/real-search', description: 'Real-time Search System', status: 'active', icon: '⚡' },
      { id: 'web-search', title: 'Web Search', path: '/web-search', description: 'Advanced Web Search', status: 'active', icon: '🌐' },
      { id: 'neural-dev', title: 'Neural Dev', path: '/neural-dev', description: 'Neural Development Environment', status: 'beta', icon: '🔬' }
    ]
  },
  // Ultra Industrial (7)
  {
    id: 'industrial',
    title: 'Ultra Industrial',
    icon: '🏭',
    color: '#ffa502',
    modules: [
      { id: 'main-dashboard', title: 'Main Dashboard', path: '/ultra-industrial', description: 'EXTREME Analytics Platform', status: 'active', icon: '🎛️' },
      { id: 'best-analytics', title: 'BEST Analytics', path: '/best-analytics', description: 'Born Enhanced Tech Safe - Leadership Assessment', status: 'new', icon: '🧠' },
      { id: 'weather', title: 'Weather System', path: '/ultra-industrial/weather', description: '500+ Global Locations', status: 'active', icon: '🌍' },
      { id: 'financial', title: 'Financial Markets', path: '/ultra-industrial/financial', description: 'Real-time Stock Data', status: 'active', icon: '💰' },
      { id: 'economic', title: 'Economic Data', path: '/ultra-industrial/economic', description: 'Global Economic Metrics', status: 'active', icon: '📊' },
      { id: 'satellite', title: 'Satellite Monitor', path: '/ultra-industrial/satellite', description: 'NASA Earth Data', status: 'active', icon: '🛰️' },
      { id: 'system-monitor', title: 'System Monitor', path: '/ultra-industrial/system', description: 'Infrastructure Monitoring', status: 'active', icon: '🖥️' }
    ]
  },
  // Security Systems (2)
  {
    id: 'security',
    title: 'Security Systems',
    icon: '🛡️',
    color: '#e74c3c',
    modules: [
      { id: 'guardian', title: 'Guardian System', path: '/guardian-system', description: 'Advanced Security Monitoring', status: 'active', icon: '👮' },
      { id: 'ultra-speed', title: 'Ultra Speed', path: '/ultra-speed', description: 'Performance Optimization', status: 'active', icon: '⚡' }
    ]
  },
  // Performance & UI (3)
  {
    id: 'performance',
    title: 'Performance & UI',
    icon: '🌊',
    color: '#9b59b6',
    modules: [
      { id: 'fluid-demo', title: 'Fluid Demo', path: '/fluid-demo', description: 'Fluid Interface System', status: 'active', icon: '🌊' },
      { id: 'lazy-loading', title: 'Lazy Loading', path: '/lazy-loading', description: 'Advanced Lazy Loading', status: 'active', icon: '⏳' },
      { id: 'cva-system', title: 'CVA System', path: '/cva-system', description: 'Component Variant System', status: 'beta', icon: '🎨' }
    ]
  },
  // Revolution Platform (5)
  {
    id: 'revolution',
    title: 'Revolution Platform',
    icon: '🚀',
    color: '#ff0080',
    modules: [
      { id: 'nodesms', title: 'NodeSMS Messenger', path: '/nodesms', description: 'PWA mobile messaging with offline LoRaWAN fallback', status: 'new', icon: '💬', featured: true },
      { id: 'revolution-core', title: 'Revolution Core', path: '/revolution-core', description: 'Ultra Advanced Revolutionary Technology Platform', status: 'new', icon: '🚀' },
      { id: 'revolution-agi', title: 'Revolution AGI', path: '/revolution-agi', description: 'Revolutionary AGI with quantum processing', status: 'new', icon: '🧠' },
      { id: 'quantum-engine', title: 'Quantum Engine', path: '/quantum-engine', description: 'Quantum-enhanced processing system', status: 'new', icon: '⚛️' },
      { id: 'neural-mesh', title: 'Neural Mesh', path: '/neural-mesh', description: 'Revolutionary neural network architecture', status: 'new', icon: '🕸️' }
    ]
  },
  // Infrastructure & Networks (9)
  {
    id: 'infrastructure',
    title: 'Infrastructure & Networks',
    icon: '🌐',
    color: '#00d4ff',
    modules: [
      { id: 'api-gateway', title: 'API Gateway', path: '/api-gateway', description: 'API routing and load balancing dashboard', status: 'new', icon: '🚪' },
      { id: 'lora-mesh', title: 'LoRa Mesh Network', path: '/lora-mesh', description: 'LoRa mesh network topology visualization', status: 'new', icon: '📡' },
      { id: 'iot-manager', title: 'IoT Device Manager', path: '/iot-manager', description: 'IoT device connectivity and monitoring', status: 'new', icon: '🔌' },
      { id: 'aviation-weather', title: 'Aviation Weather', path: '/aviation-weather', description: 'Specialized aviation weather system', status: 'new', icon: '✈️' },
      { id: 'radio-propaganda', title: 'Radio Propaganda', path: '/radio-propaganda', description: 'Radio broadcast management system', status: 'new', icon: '📻' },
      { id: 'ultra-tech-tools', title: 'Ultra Tech Tools', path: '/ultra-tech-tools', description: 'Advanced technical tools suite', status: 'new', icon: '🛠️' },
      { id: 'albion-utt', title: 'Albion UTT', path: '/albion-utt', description: 'Albanian Ultra Tech Tools - Specialized Albanian technical operations platform', status: 'new', icon: '🇦🇱' },
      { id: 'advanced-security', title: 'Advanced Security', path: '/advanced-security', description: 'Advanced security firewall with real-time threat monitoring', status: 'new', icon: '🛡️' },
      { id: 'cyber-security-center', title: 'Cyber Security Center', path: '/cyber-security-center', description: 'Real-time cyber defense and mirror security command center', status: 'new', icon: '🚀' }
    ]
  }
];

// Stats helpers
export const getTotalModules = (): number => moduleCategories.reduce((acc, cat) => acc + cat.modules.length, 0);
export const getActiveModules = (): number => moduleCategories.reduce((acc, cat) => acc + cat.modules.filter(m => m.status === 'active').length, 0);
export const getCategoryStats = (): Array<{id: string, title: string, total: number, active: number, pct: number}> => 
  moduleCategories.map(cat => ({
    id: cat.id,
    title: cat.title,
    total: cat.modules.length,
    active: cat.modules.filter(m => m.status === 'active').length,
    pct: Math.round((cat.modules.filter(m => m.status === 'active').length / cat.modules.length) * 100)
  }));
