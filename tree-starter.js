#!/usr/bin/env node
/**
 * 🌳 ASI MONOREPO TREE STARTER
 * Organic startup sequence following tree architecture
 * 
 * @version 8.0.0
 * @author Ledjan Ahmati <dealsjona@gmail.com>
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';

class ASITreeManager {
    constructor() {
        this.treeConfig = this.loadTreeConfig();
        this.services = new Map();
        this.startTime = new Date();
    }

    loadTreeConfig() {
        const configPath = './monorepo-tree.json';
        if (existsSync(configPath)) {
            return JSON.parse(readFileSync(configPath, 'utf8'));
        }
        return this.getDefaultConfig();
    }

    getDefaultConfig() {
        return {
            tree: {
                branches: {
                    components: [
                        {
                            name: "asi-saas-frontend",
                            port: 3001,
                            command: "cd asi-saas-frontend && npm run dev",
                            role: "user-interface-branch"
                        },
                        {
                            name: "api-gateway", 
                            port: 3003,
                            command: "cd api-gateway && node server.js",
                            role: "data-gateway-branch"
                        },
                        {
                            name: "asi-agent-ultra-demo",
                            port: 3004,
                            command: "node asi-agent-ultra-demo.js",
                            role: "demonstration-branch"
                        },
                        {
                            name: "asi-api-producer",
                            port: 3005,
                            command: "node asi-api-producer.js", 
                            role: "production-branch"
                        }
                    ]
                }
            }
        };
    }

    async plantTree() {
        this.log('🌳', 'PLANTING ASI MONOREPO TREE...', 'green');
        this.log('🌱', 'Initializing roots...', 'cyan');
        
        // 🌱 ROOTS: Load configuration
        await this.sleep(500);
        this.log('🌱', 'Root configuration loaded', 'green');

        // 🌲 TRUNK: Start central coordination  
        this.log('🌲', 'Growing trunk - Central coordination active', 'cyan');
        await this.sleep(500);

        // 🌿 BRANCHES: Start services
        this.log('🌿', 'Growing branches - Starting services...', 'cyan');
        await this.startBranches();

        // 🍎 FRUITS: Validate outputs
        await this.sleep(2000);
        this.log('🍎', 'Harvesting fruits - Validating outputs...', 'cyan');
        await this.validateFruits();

        this.showTreeStatus();
    }

    async startBranches() {
        const branches = this.treeConfig.tree.branches.components;
        
        for (const branch of branches) {
            this.log('🌿', `Starting ${branch.name} on port ${branch.port}...`, 'yellow');
            await this.startService(branch);
            await this.sleep(1500); // Give time to start properly
        }
    }

    async startService(service) {
        return new Promise((resolve) => {
            const parts = service.command.split(' && ');
            let command, args, cwd;

            if (parts.length > 1) {
                // Handle "cd directory && command"
                const cdMatch = parts[0].match(/cd\s+(.+)/);
                if (cdMatch) {
                    cwd = cdMatch[1];
                    const restCommand = parts[1].split(' ');
                    command = restCommand[0];
                    args = restCommand.slice(1);
                }
            } else {
                // Simple command
                const cmdParts = service.command.split(' ');
                command = cmdParts[0];
                args = cmdParts.slice(1);
            }

            const childProcess = spawn(command, args, {
                cwd: cwd || process.cwd(),
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: true
            });

            this.services.set(service.name, {
                ...service,
                process: childProcess,
                startTime: new Date(),
                status: 'starting'
            });

            childProcess.stdout?.on('data', (data) => {
                const output = data.toString();
                if (output.includes('ready') || output.includes('started') || output.includes('listening')) {
                    const serviceData = this.services.get(service.name);
                    serviceData.status = 'running';
                    this.services.set(service.name, serviceData);
                    this.log('✅', `${service.name} is ready on port ${service.port}`, 'green');
                }
            });

            childProcess.on('error', (err) => {
                this.log('❌', `Error starting ${service.name}: ${err.message}`, 'red');
            });

            // Assume started after 1 second
            setTimeout(() => {
                const serviceData = this.services.get(service.name);
                if (serviceData.status === 'starting') {
                    serviceData.status = 'running';
                    this.services.set(service.name, serviceData);
                }
                resolve();
            }, 1000);
        });
    }

    async validateFruits() {
        const fruits = [
            { name: 'Interactive Dashboard', url: 'http://localhost:23004/demo/interactive-dashboard' },
            { name: 'Ultra SaaS Frontend', url: 'http://localhost:23001' },
            { name: 'API Gateway Health', url: 'http://localhost:23003/api/health' },
            { name: 'API Producer Registry', url: 'http://localhost:23005/asi/apis-registry' }
        ];

        for (const fruit of fruits) {
            try {
                const response = await fetch(fruit.url, { 
                    method: 'GET',
                    signal: AbortSignal.timeout(3000)
                });
                if (response.ok) {
                    this.log('🍎', `${fruit.name} - Fruit ready!`, 'green');
                } else {
                    this.log('🥀', `${fruit.name} - Not responding`, 'yellow');
                }
            } catch (_err) {
                this.log('🥀', `${fruit.name} - Connection failed`, 'red');
            }
        }
    }

    showTreeStatus() {
        console.log('\n🌳 ========================================');
        console.log('🇦🇱      ASI MONOREPO TREE STATUS');
        console.log('🌳 ========================================');
        console.log(`⏰ Planted: ${this.startTime.toLocaleString()}`);
        console.log(`👨‍💻 Gardener: ${this.treeConfig.monorepo?.name || 'ASI Laboratory'}`);
        console.log(`📊 Active Branches: ${this.services.size}\n`);

        console.log('🚀 TREE BRANCHES:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        this.services.forEach((service, name) => {
            const uptime = Math.floor((Date.now() - service.startTime.getTime()) / 1000);
            const status = service.status === 'running' ? '✅' : '⚠️';
            const url = `http://localhost:${service.port}`;
            
            console.log(`  ${status} ${name.padEnd(25)} Port: ${service.port}  URL: ${url}  Uptime: ${uptime}s`);
        });

        console.log('\n🌍 TREE FRUITS (Quick Access):');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('  🎨 Ultra SaaS Dashboard: http://localhost:23001');
        console.log('  📊 Interactive Dashboard: http://localhost:23004/demo/interactive-dashboard');
        console.log('  🌍 API Gateway: http://localhost:23003');
        console.log('  ⚡ API Producer: http://localhost:23005');

        console.log('\n🎉 ========================================');
        console.log('🇦🇱 ASI MONOREPO TREE IS FLOURISHING!');
        console.log('🎉 ========================================');
        
        console.log('\n💡 Tree Management Commands:');
        console.log('   node tree-starter.js         # Plant the tree');
        console.log('   node lab-manager.js status    # Check tree health');
        console.log('   node lab-manager.js stop      # Cut down tree');
        console.log('   yarn lab                      # Quick plant');
    }

    log(icon, message, color = 'white') {
        const colors = {
            red: '\x1b[31m',
            green: '\x1b[32m', 
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            magenta: '\x1b[35m',
            cyan: '\x1b[36m',
            white: '\x1b[37m',
            reset: '\x1b[0m'
        };
        
        const timestamp = new Date().toLocaleTimeString();
        console.log(`${colors[color]}[${timestamp}] ${icon} ${message}${colors.reset}`);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async stopTree() {
        this.log('🔥', 'Stopping ASI Monorepo Tree...', 'red');
        
        for (const [name, service] of this.services) {
            try {
                service.process.kill();
                this.log('✅', `Stopped ${name}`, 'yellow');
            } catch (err) {
                this.log('❌', `Error stopping ${name}: ${err.message}`, 'red');
            }
        }
        
        this.services.clear();
        this.log('🌳', 'Tree has been cut down. Seeds remain for replanting.', 'green');
    }
}

// 🌳 Tree Command Handler
const command = process.argv[2];
const tree = new ASITreeManager();

switch (command) {
    case 'plant':
    case 'start':
    default:
        tree.plantTree();
        break;
    case 'stop':
    case 'cut':
        tree.stopTree();
        process.exit(0);
        break;
    case 'status':
    case 'health':
        tree.showTreeStatus();
        break;
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🔥 Received interrupt signal, cutting down tree...');
    tree.stopTree().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
    console.log('\n🔥 Received terminate signal, cutting down tree...');
    tree.stopTree().then(() => process.exit(0));
});
