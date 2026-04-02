const express = require('express');
const axios = require('axios');

// API Producer Module - NO PORT MODE (Integrated into Ultra SaaS Dashboard)

class ApiProducerModule {
    constructor() {
        this.name = 'asi-api-producer';
        this.integrated = true; // Integrated into Ultra SaaS Dashboard
        this.app = null; // No standalone server
        this.registryUrl = null; // No external registry needed
        this.heartbeatInterval = 15000;
        this.heartbeatTimer = null;
        this.metrics = {
            requests: 0,
            apiCalls: 0,
            dataGenerated: 0,
            startTime: Date.now(),
            memory: 0,
            errors: 0
        };
        this.realOnlyMode = (process.env.REAL_ONLY_MODE || 'true').toLowerCase() !== 'false';
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(express.json());
        
        this.app.use((req, res, next) => {
            this.metrics.requests++;
            if (req.path.includes('/api/')) {
                this.metrics.apiCalls++;
            }
            next();
        });

        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
            next();
        });
    }

    setupRoutes() {
        this.app.get('/health', (req, res) => {
            res.json({
                service: this.name,
                status: 'healthy',
                port: this.port,
                metrics: this.getMetrics()
            });
        });

        this.app.get('/metrics', (req, res) => {
            res.json(this.getMetrics());
        });

        this.app.get('/', (req, res) => {
            res.json({
                service: this.name,
                status: 'running',
                port: this.port,
                description: 'ASI API Producer - Real service proxy (legacy mode)',
                endpoints: {
                    '/health': 'Service health check',
                    '/metrics': 'Service metrics',
                    '/api/cultural': 'Requires real upstream service',
                    '/api/financial': 'Requires real upstream service',
                    '/api/news': 'Requires real upstream service',
                    '/api/blockchain': 'Requires real upstream service'
                },
                uptime: Date.now() - this.metrics.startTime
            });
        });

        this.app.get('/api/cultural', (req, res) => {
            this.metrics.errors++;
            res.status(503).json({
                error: 'Real-only mode: configure upstream cultural API and use non-legacy producer module'
            });
        });

        this.app.get('/api/financial', (req, res) => {
            this.metrics.errors++;
            res.status(503).json({
                error: 'Real-only mode: configure upstream financial API and use non-legacy producer module'
            });
        });
    }

    getMetrics() {
        return {
            ...this.metrics,
            uptime: Date.now() - this.metrics.startTime,
            memory: process.memoryUsage().heapUsed / 1024 / 1024,
            service: this.name,
            port: this.port
        };
    }

    log(message) {
        const timestamp = new Date().toISOString();
        process.stdout.write(`[API-PRODUCER] ${timestamp} - INFO: ${message}\n`);
    }

    async registerWithRegistry() {
        try {
            const response = await axios.post(`${this.registryUrl}/register`, {
                name: this.name,
                port: this.port,
                type: 'api-producer',
                health: `/health`,
                endpoints: ['/api/cultural', '/api/financial', '/api/news', '/api/blockchain']
            });
            this.log(`Successfully registered with registry: ${response.data.message}`);
            return true;
        } catch (error) {
            this.log(`Failed to register with registry: ${error.message}`);
            return false;
        }
    }

    async sendHeartbeat() {
        try {
            await axios.post(`${this.registryUrl}/heartbeat`, {
                name: this.name,
                port: this.port,
                metrics: this.getMetrics()
            });
        } catch (error) {
            this.log(`Heartbeat failed: ${error.message}`);
        }
    }

    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat();
        }, this.heartbeatInterval);
        this.log(`Heartbeat started (${this.heartbeatInterval}ms interval)`);
    }

    async allocatePort() {
        try {
            this.port = await findAvailablePort(3004);
            this.log(`Allocated port: ${this.port}`);
            return this.port;
        } catch (error) {
            this.log(`Port allocation failed: ${error.message}`);
            throw error;
        }
    }

    async start() {
        try {
            await this.allocatePort();
            
            this.app.listen(this.port, () => {
                this.log(`API Producer service running on port ${this.port}`);
                
                setTimeout(async () => {
                    const registered = await this.registerWithRegistry();
                    if (registered) {
                        this.startHeartbeat();
                    }
                }, 2000);
            });
        } catch (error) {
            this.log(`Failed to start: ${error.message}`);
            process.exit(1);
        }
    }

    async stop() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
        
        try {
            await axios.delete(`${this.registryUrl}/services/${this.name}`);
            this.log('Deregistered from service registry');
        } catch (error) {
            this.log(`Deregistration failed: ${error.message}`);
        }
        
        process.exit(0);
    }
}

if (require.main === module) {
    const apiProducer = new ApiProducerModule();
    
    process.on('SIGINT', () => {
        apiProducer.stop();
    });
    
    process.on('SIGTERM', () => {
        apiProducer.stop();
    });
    
    apiProducer.start();
}

module.exports = ApiProducerModule;
