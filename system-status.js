#!/usr/bin/env node

/**
 * UltraWebThinking - Real-time System Status Monitor
 * Monitoron gjendjen e të gjithë 46 moduleve në kohë reale
 */

const http = require('http');
const { URL } = require('url');

// Configuration
const BASE_URL = 'http://localhost:23000';
const REFRESH_INTERVAL = 5000; // 5 seconds
const MODULES = [
  // AI & AGI Core (10 modules)
  { name: 'AGI Core', path: '/agi', category: '🧠 AI & AGI' },
  { name: 'AGI Demo', path: '/agi-demo', category: '🧠 AI & AGI' },
  { name: 'AGI Search Demo', path: '/agi-search-demo', category: '🧠 AI & AGI' },
  { name: 'AGI Tunnel', path: '/agi-tunnel', category: '🧠 AI & AGI' },
  { name: 'ASI 12-Layer', path: '/asi-12layer', category: '🧠 AI & AGI' },
  { name: 'ASI Dashboard', path: '/asi-dashboard', category: '🧠 AI & AGI' },
  { name: 'ASI Ultimate', path: '/asi-ultimate', category: '🧠 AI & AGI' },
  { name: 'AGIMed Professional', path: '/agimed-professional', category: '🧠 AI & AGI' },
  { name: 'Bio Nature Demo', path: '/agixbionature-demo', category: '🧠 AI & AGI' },
  { name: 'Eco Demo', path: '/agixeco-demo', category: '🧠 AI & AGI' },
  
  // AI & Neural Networks (7 modules)
  { name: 'Neural Demo', path: '/neural-demo', category: '🧬 Neural Networks' },
  { name: 'Neural Dev', path: '/neural-dev', category: '🧬 Neural Networks' },
  { name: 'Neural Acceleration', path: '/neural-acceleration', category: '🧬 Neural Networks' },
  { name: 'OpenMind Chat', path: '/openmind-chat', category: '🧬 Neural Networks' },
  { name: 'OpenMind Demo', path: '/openmind-demo', category: '🧬 Neural Networks' },
  { name: 'OpenMind Enhanced', path: '/openmind-enhanced', category: '🧬 Neural Networks' },
  { name: 'Neural Search Demo', path: '/neural-search-demo', category: '🧬 Neural Networks' },
  
  // Performance Systems (6 modules)
  { name: 'Ultra Industrial', path: '/ultra-industrial', category: '⚡ Performance' },
  { name: 'Light Speed IO', path: '/light-speed-io', category: '⚡ Performance' },
  { name: 'Zero Latency', path: '/zero-latency', category: '⚡ Performance' },
  { name: 'Quantum Processing', path: '/quantum-processing', category: '⚡ Performance' },
  { name: 'Ultra Speed', path: '/ultra-speed', category: '⚡ Performance' },
  { name: 'Ultra SaaS', path: '/ultra-saas', category: '⚡ Performance' },
  
  // Security Systems (3 modules)
  { name: 'Guardian Demo', path: '/guardian-demo', category: '🛡️ Security' },
  { name: 'Advanced Security', path: '/advanced-security', category: '🛡️ Security' },
  { name: 'Cyber Security', path: '/cyber-security', category: '🛡️ Security' },
  
  // Network & IoT (3 modules)
  { name: 'LoRa Mesh', path: '/lora-mesh', category: '📡 Network' },
  { name: 'IoT Manager', path: '/iot-manager', category: '📡 Network' },
  { name: 'Infinite Bandwidth', path: '/infinite-bandwidth', category: '📡 Network' },
  
  // System Utilities (7 modules)
  { name: 'API Gateway', path: '/api-gateway', category: '🔧 System' },
  { name: 'Browser', path: '/browser', category: '🔧 System' },
  { name: 'Overview', path: '/overview', category: '🔧 System' },
  { name: 'Revolution', path: '/revolution', category: '🔧 System' },
  { name: 'Time Compression', path: '/time-compression', category: '🔧 System' },
  { name: 'UTT Tools', path: '/utt-tools', category: '🔧 System' },
  { name: 'Base JSON', path: '/base.json', category: '🔧 System' },
  
  // Medical AI (2 modules)
  { name: 'AlbaMed Demo', path: '/albamed-demo', category: '🏥 Medical' },
  { name: 'Albion UTT', path: '/albion-utt', category: '🏥 Medical' },
  
  // Search Engines (2 modules)
  { name: 'Real Search Demo', path: '/real-search-demo', category: '🔍 Search' },
  { name: 'Web Search Demo', path: '/web-search-demo', category: '🔍 Search' },
  
  // Specialized Systems (2 modules)
  { name: 'Aviation Weather', path: '/aviation-weather', category: '✈️ Specialized' },
  { name: 'Radio Propaganda', path: '/radio-propaganda', category: '✈️ Specialized' },
  
  // Demos & Testing (3 modules)
  { name: 'CVA Demo', path: '/cva-demo', category: '🧪 Demos' },
  { name: 'Fluid Demo', path: '/fluid-demo', category: '🧪 Demos' },
  { name: 'Lazy Demo', path: '/lazy-demo', category: '🧪 Demos' },
  
  // Business & SaaS (1 module)
  { name: 'SaaS Dashboard', path: '/saas-dashboard', category: '💼 Business' }
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Module status tracking
let moduleStatus = new Map();
let statusHistory = [];
let startTime = Date.now();

// Clear screen
function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[0f');
}

// Display header
function displayHeader() {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const uptimeFormatted = `${Math.floor(uptime / 60)}m ${uptime % 60}s`;
  
  console.log(`${colors.bright}${colors.cyan}
╔══════════════════════════════════════════════════════════════════════╗
║                    🚀 UltraWebThinking Live Monitor                  ║
║                     Real-time System Status                          ║
╚══════════════════════════════════════════════════════════════════════╝${colors.reset}`);
  
  console.log(`${colors.blue}📊 Total Modules: ${colors.bright}${MODULES.length}${colors.reset} | ${colors.green}🕒 Uptime: ${colors.bright}${uptimeFormatted}${colors.reset} | ${colors.yellow}🔄 Auto-refresh: ${REFRESH_INTERVAL/1000}s${colors.reset}`);
  console.log(`${colors.magenta}🌐 Base URL: ${colors.bright}${BASE_URL}${colors.reset}\n`);
}

// Test a single module
function testModule(module) {
  return new Promise((resolve) => {
    const url = new URL(module.path, BASE_URL);
    const startTime = Date.now();
    
    const req = http.get(url, (res) => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      resolve({
        ...module,
        status: res.statusCode >= 200 && res.statusCode < 400 ? 'online' : 'error',
        statusCode: res.statusCode,
        responseTime,
        lastCheck: new Date()
      });
    });
    
    req.on('error', () => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      resolve({
        ...module,
        status: 'offline',
        statusCode: 'ERR',
        responseTime,
        lastCheck: new Date()
      });
    });
    
    req.setTimeout(3000, () => {
      req.destroy();
      resolve({
        ...module,
        status: 'timeout',
        statusCode: 'TMO',
        responseTime: 3000,
        lastCheck: new Date()
      });
    });
  });
}

// Get status icon and color
function getStatusDisplay(status) {
  switch (status) {
    case 'online': return `${colors.green}🟢 ONLINE${colors.reset}`;
    case 'offline': return `${colors.red}🔴 OFFLINE${colors.reset}`;
    case 'error': return `${colors.yellow}🟡 ERROR${colors.reset}`;
    case 'timeout': return `${colors.red}⏰ TIMEOUT${colors.reset}`;
    default: return `${colors.white}⚪ UNKNOWN${colors.reset}`;
  }
}

// Display modules by category
function displayModulesByCategory(results) {
  const byCategory = results.reduce((acc, module) => {
    if (!acc[module.category]) acc[module.category] = [];
    acc[module.category].push(module);
    return acc;
  }, {});
  
  Object.entries(byCategory).forEach(([category, modules]) => {
    console.log(`${colors.bright}${colors.cyan}${category} (${modules.length} modules)${colors.reset}`);
    console.log('─'.repeat(70));
    
    modules.forEach(module => {
      const status = getStatusDisplay(module.status);
      const responseTime = module.responseTime < 1000 ? 
        `${colors.green}${module.responseTime}ms${colors.reset}` :
        `${colors.yellow}${module.responseTime}ms${colors.reset}`;
      
      console.log(`  ${status} ${colors.white}${module.name.padEnd(25)}${colors.reset} ${responseTime} ${colors.blue}${module.path}${colors.reset}`);
    });
    
    console.log(''); // Empty line between categories
  });
}

// Display summary statistics
function displaySummary(results) {
  const stats = results.reduce((acc, module) => {
    acc[module.status] = (acc[module.status] || 0) + 1;
    return acc;
  }, {});
  
  const total = results.length;
  const online = stats.online || 0;
  const offline = stats.offline || 0;
  const error = stats.error || 0;
  const timeout = stats.timeout || 0;
  
  const avgResponseTime = results.reduce((sum, m) => sum + m.responseTime, 0) / total;
  
  console.log(`${colors.bright}${colors.cyan}SYSTEM SUMMARY${colors.reset}`);
  console.log('═'.repeat(70));
  console.log(`${colors.green}🟢 Online: ${online}/${total} (${((online/total)*100).toFixed(1)}%)${colors.reset}`);
  console.log(`${colors.red}🔴 Offline: ${offline}/${total} (${((offline/total)*100).toFixed(1)}%)${colors.reset}`);
  console.log(`${colors.yellow}🟡 Errors: ${error}/${total} (${((error/total)*100).toFixed(1)}%)${colors.reset}`);
  console.log(`${colors.red}⏰ Timeouts: ${timeout}/${total} (${((timeout/total)*100).toFixed(1)}%)${colors.reset}`);
  console.log(`${colors.blue}📈 Avg Response: ${avgResponseTime.toFixed(0)}ms${colors.reset}`);
  
  // System health indicator
  const healthScore = (online / total) * 100;
  let healthStatus = '';
  if (healthScore >= 90) healthStatus = `${colors.green}🚀 EXCELLENT${colors.reset}`;
  else if (healthScore >= 70) healthStatus = `${colors.yellow}⚡ GOOD${colors.reset}`;
  else if (healthScore >= 50) healthStatus = `${colors.yellow}⚠️ WARNING${colors.reset}`;
  else healthStatus = `${colors.red}🚨 CRITICAL${colors.reset}`;
  
  console.log(`${colors.bright}🏥 System Health: ${healthStatus} (${healthScore.toFixed(1)}%)${colors.reset}`);
  console.log('');
}

// Run full system check
async function runSystemCheck() {
  console.log(`${colors.yellow}🔄 Testing all ${MODULES.length} modules...${colors.reset}\n`);
  
  const batchSize = 5;
  const results = [];
  
  for (let i = 0; i < MODULES.length; i += batchSize) {
    const batch = MODULES.slice(i, i + batchSize);
    const batchPromises = batch.map(module => testModule(module));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches
    if (i + batchSize < MODULES.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Update status map
  results.forEach(result => {
    moduleStatus.set(result.name, result);
  });
  
  // Add to history
  statusHistory.push({
    timestamp: new Date(),
    onlineCount: results.filter(r => r.status === 'online').length,
    totalCount: results.length
  });
  
  // Keep only last 20 entries
  if (statusHistory.length > 20) {
    statusHistory = statusHistory.slice(-20);
  }
  
  return results;
}

// Main monitoring loop
async function startMonitoring() {
  console.log(`${colors.bright}${colors.green}🚀 Starting UltraWebThinking System Monitor...${colors.reset}\n`);
  console.log(`${colors.blue}Monitoring ${MODULES.length} modules every ${REFRESH_INTERVAL/1000} seconds${colors.reset}\n`);
  
  while (true) {
    try {
      clearScreen();
      displayHeader();
      
      const results = await runSystemCheck();
      displayModulesByCategory(results);
      displaySummary(results);
      
      console.log(`${colors.bright}${colors.blue}Next refresh in ${REFRESH_INTERVAL/1000} seconds... Press Ctrl+C to stop${colors.reset}`);
      
      await new Promise(resolve => setTimeout(resolve, REFRESH_INTERVAL));
      
    } catch (error) {
      console.error(`${colors.red}❌ Monitoring error: ${error.message}${colors.reset}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  clearScreen();
  console.log(`${colors.bright}${colors.yellow}
╔══════════════════════════════════════════════════════════════════════╗
║                    🛑 Monitor Stopping...                           ║
║              Thanks for using UltraWebThinking Monitor!              ║
╚══════════════════════════════════════════════════════════════════════╝${colors.reset}`);
  
  console.log(`${colors.green}👋 Monitor stopped. Final status:${colors.reset}`);
  if (moduleStatus.size > 0) {
    const online = Array.from(moduleStatus.values()).filter(m => m.status === 'online').length;
    console.log(`   🟢 ${online}/${moduleStatus.size} modules were online`);
  }
  
  process.exit(0);
});

// Export for testing
module.exports = {
  MODULES,
  testModule,
  runSystemCheck,
  startMonitoring
};

// Run if called directly
if (require.main === module) {
  startMonitoring();
}
