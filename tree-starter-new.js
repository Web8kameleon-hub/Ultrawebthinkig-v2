const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

class ASITreeManager {
    constructor() {
        this.configPath = path.join(__dirname, 'monorepo-tree.json');
        this.processes = new Map();
        this.registryUrl = 'http://localhost:22999';
        this.isPlanted = false;
        this.healingEnabled = true;
        this.log('🌳 ASI Tree Manager initialized');
    }

    async loadTreeConfig() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            const config = JSON.parse(configData);
            this.log('📋 Tree configuration loaded successfully');
            return config;
        } catch (error) {
            this.logError(`Failed to load tree config: ${error.message}`);
            throw error;
        }
    }

    async plantTree() {
        if (this.isPlanted) {
            this.log('🌳 Tree is already planted and growing');
            return;
        }

        try {
            this.log('🌱 Planting the ASI Tree...');
            const config = await this.loadTreeConfig();
            
            // First, start the registry (root system)
            await this.plantRoots(config.roots);
            
            // Wait for registry to be ready
            await this.waitForRegistry();
            
            // Then start the trunk (orchestrator)
            await this.growTrunk(config.trunk);
            
            // Finally, grow the branches (services)
            await this.growBranches(config.trunk.branches);
            
            this.isPlanted = true;
            this.log('🌳 Tree successfully planted and growing!');
            
            if (this.healingEnabled) {
                this.startAutoHeal();
            }
            
        } catch (error) {
            this.logError(`Failed to plant tree: ${error.message}`);
            throw error;
        }
    }

    async plantRoots(rootsConfig) {
        this.log('🌿 Planting roots (Registry Service)...');
        
        // Start registry service
        const registryProcess = spawn('node', ['registry/registry-service.js'], {
            cwd: __dirname,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        registryProcess.stdout.on('data', (data) => {
            process.stdout.write(`[REGISTRY] ${data}`);
        });

        registryProcess.stderr.on('data', (data) => {
            process.stderr.write(`[REGISTRY-ERROR] ${data}`);
        });

        registryProcess.on('exit', (code) => {
            this.log(`Registry process exited with code ${code}`);
            if (this.healingEnabled && code !== 0) {
                setTimeout(() => this.healService('registry'), 5000);
            }
        });

        this.processes.set('registry', {
            process: registryProcess,
            name: 'registry-service',
            type: 'root',
            startTime: Date.now()
        });

        this.log('🌿 Roots planted successfully');
    }

    async waitForRegistry() {
        this.log('⏳ Waiting for registry service to be ready...');
        
        for (let i = 0; i < 30; i++) { // Wait up to 30 seconds
            try {
                const response = await axios.get(`${this.registryUrl}/health`, { timeout: 2000 });
                if (response.status === 200) {
                    this.log('✅ Registry service is ready');
                    return;
                }
            } catch (error) {
                // Registry not ready yet
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        throw new Error('Registry service failed to start within timeout');
    }

    async growTrunk(trunkConfig) {
        this.log('🌲 Growing trunk (Main Orchestrator)...');
        // The trunk is this current process
        this.log('🌲 Trunk is growing (current orchestrator process)');
    }

    async growBranches(branchesConfig) {
        this.log('🌿 Growing branches (Services)...');
        
        for (const branch of branchesConfig) {
            this.log(`🌿 Growing branch: ${branch.name}`);
            
            for (const fruit of branch.fruits) {
                await this.growFruit(fruit, branch);
            }
        }
    }

    async growFruit(fruit, branch) {
        this.log(`🍎 Growing fruit: ${fruit.name} (${fruit.command})`);
        
        try {
            // Use module path if it exists, otherwise use command directly
            const scriptPath = fruit.command.startsWith('modules/') ? 
                fruit.command : `modules/${fruit.command}`;
            
            const fruitProcess = spawn('node', [scriptPath], {
                cwd: __dirname,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            fruitProcess.stdout.on('data', (data) => {
                process.stdout.write(`[${fruit.name.toUpperCase()}] ${data}`);
            });

            fruitProcess.stderr.on('data', (data) => {
                process.stderr.write(`[${fruit.name.toUpperCase()}-ERROR] ${data}`);
            });

            fruitProcess.on('exit', (code) => {
                this.log(`${fruit.name} process exited with code ${code}`);
                if (this.healingEnabled && code !== 0) {
                    setTimeout(() => this.healService(fruit.name), 5000);
                }
            });

            this.processes.set(fruit.name, {
                process: fruitProcess,
                name: fruit.name,
                type: 'fruit',
                branch: branch.name,
                startTime: Date.now(),
                config: fruit
            });

            this.log(`🍎 Fruit ${fruit.name} is growing`);
            
            // Brief delay between service starts
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error) {
            this.logError(`Failed to grow fruit ${fruit.name}: ${error.message}`);
        }
    }

    async validateFruits() {
        this.log('🔍 Validating all fruits (services)...');
        
        try {
            const response = await axios.get(`${this.registryUrl}/services`, { timeout: 5000 });
            const data = response.data;
            
            this.log(`📊 Registry reports ${data.services.length} services:`);
            data.services.forEach(service => {
                const status = service.status === 'active' ? '✅' : '⚠️';
                this.log(`   ${status} ${service.name} on port ${service.port} (${service.status})`);
            });
            
            return data.services;
            
        } catch (error) {
            this.logError(`Failed to validate fruits: ${error.message}`);
            return [];
        }
    }

    startAutoHeal() {
        this.log('🏥 Auto-healing system activated');
        
        setInterval(async () => {
            try {
                await this.validateFruits();
            } catch (error) {
                this.logError(`Auto-heal check failed: ${error.message}`);
            }
        }, 30000); // Check every 30 seconds
    }

    async healService(serviceName) {
        this.log(`🏥 Attempting to heal service: ${serviceName}`);
        
        const processInfo = this.processes.get(serviceName);
        if (processInfo && processInfo.config) {
            try {
                // Kill existing process if still running
                if (processInfo.process && !processInfo.process.killed) {
                    processInfo.process.kill();
                }
                
                // Restart the service
                await this.growFruit(processInfo.config, { name: processInfo.branch });
                this.log(`🏥 Service ${serviceName} healed successfully`);
                
            } catch (error) {
                this.logError(`Failed to heal ${serviceName}: ${error.message}`);
            }
        }
    }

    async cutTree() {
        this.log('🪓 Cutting down the tree...');
        
        for (const [name, processInfo] of this.processes) {
            try {
                if (processInfo.process && !processInfo.process.killed) {
                    this.log(`🪓 Stopping ${name}...`);
                    processInfo.process.kill('SIGTERM');
                    
                    // Force kill after 5 seconds if not stopped
                    setTimeout(() => {
                        if (!processInfo.process.killed) {
                            processInfo.process.kill('SIGKILL');
                        }
                    }, 5000);
                }
            } catch (error) {
                this.logError(`Failed to stop ${name}: ${error.message}`);
            }
        }
        
        this.processes.clear();
        this.isPlanted = false;
        this.log('🪓 Tree has been cut down');
    }

    getTreeStatus() {
        const status = {
            planted: this.isPlanted,
            processes: this.processes.size,
            services: []
        };
        
        for (const [name, info] of this.processes) {
            status.services.push({
                name: name,
                type: info.type,
                uptime: Date.now() - info.startTime,
                running: !info.process.killed
            });
        }
        
        return status;
    }

    log(message) {
        const timestamp = new Date().toISOString();
        process.stdout.write(`[TREE] ${timestamp} - ${message}\n`);
    }

    logError(message) {
        const timestamp = new Date().toISOString();
        process.stderr.write(`[TREE-ERROR] ${timestamp} - ${message}\n`);
    }
}

// Handle process termination
let treeManager = null;

process.on('SIGINT', async () => {
    if (treeManager) {
        process.stdout.write('\n🪓 Received shutdown signal, cutting down tree...\n');
        await treeManager.cutTree();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    if (treeManager) {
        await treeManager.cutTree();
    }
    process.exit(0);
});

// Auto-start if run directly
if (require.main === module) {
    async function startTree() {
        treeManager = new ASITreeManager();
        
        try {
            await treeManager.plantTree();
            
            // Show status every 30 seconds
            setInterval(async () => {
                const status = treeManager.getTreeStatus();
                treeManager.log(`🌳 Tree Status: ${status.processes} processes running`);
                
                if (status.planted) {
                    await treeManager.validateFruits();
                }
            }, 30000);
            
        } catch (error) {
            process.stderr.write(`Tree startup failed: ${error.message}\n`);
            process.exit(1);
        }
    }
    
    startTree();
}

module.exports = ASITreeManager;
