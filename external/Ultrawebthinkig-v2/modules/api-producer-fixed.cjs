const express = require('express');
const axios = require('axios');

// Simple port finder function  
async function findAvailablePort(startPort = 3002) {
    const net = require('net');
    
    return new Promise((resolve) => {
        const server = net.createServer();
        server.on('error', () => {
            server.close();
            findAvailablePort(startPort + 1).then(resolve);
        });
        server.listen(startPort, () => {
            const port = server.address().port;
            server.close(() => {
                resolve(port);
            });
        });
    });
}

class ApiProducerModule {
    constructor() {
        this.name = 'asi-api-producer';
        this.port = null;
        this.app = express();
        this.registryUrl = 'http://localhost:2999';
        this.heartbeatInterval = 15000; // 15 seconds
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
        this.realEndpoints = {
            cultural: process.env.REAL_CULTURAL_API_URL || '',
            financial: process.env.REAL_FINANCIAL_API_URL || '',
            news: process.env.REAL_NEWS_API_URL || '',
            blockchain: process.env.REAL_BLOCKCHAIN_API_URL || ''
        };
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(express.json());
        
        // Request counter middleware
        this.app.use((req, res, next) => {
            this.metrics.requests++;
            if (req.path.includes('/api/')) {
                this.metrics.apiCalls++;
            }
            next();
        });

        // CORS middleware
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                service: this.name,
                status: 'healthy',
                port: this.port,
                metrics: this.getMetrics()
            });
        });

        // API Producer metrics
        this.app.get('/metrics', (req, res) => {
            res.json(this.getMetrics());
        });

        // Main API Producer route
        this.app.get('/', (req, res) => {
            res.json({
                service: this.name,
                status: 'running',
                port: this.port,
                description: 'ASI API Producer - Real service proxy',
                endpoints: {
                    '/health': 'Service health check',
                    '/metrics': 'Service metrics',
                    '/api/cultural': 'Cultural data proxy (real endpoint required)',
                    '/api/financial': 'Financial data proxy (real endpoint required)',
                    '/api/news': 'News data proxy (real endpoint required)',
                    '/api/blockchain': 'Blockchain data proxy (real endpoint required)'
                },
                realOnlyMode: this.realOnlyMode,
                uptime: Date.now() - this.metrics.startTime
            });
        });

        // Cultural API
        this.app.get('/api/cultural', async (req, res) => {
            await this.proxyRealData(req, res, 'cultural');
        });

        // Financial API
        this.app.get('/api/financial', async (req, res) => {
            await this.proxyRealData(req, res, 'financial');
        });

        // News API
        this.app.get('/api/news', async (req, res) => {
            await this.proxyRealData(req, res, 'news');
        });

        // Blockchain API
        this.app.get('/api/blockchain', async (req, res) => {
            await this.proxyRealData(req, res, 'blockchain');
        });
    }

    async proxyRealData(req, res, type) {
        const upstreamUrl = this.realEndpoints[type];

        if (!upstreamUrl) {
            this.metrics.errors++;
            return res.status(503).json({
                error: `Real-only mode: missing REAL_${type.toUpperCase()}_API_URL`,
                type,
                realOnlyMode: this.realOnlyMode
            });
        }

        try {
            const response = await axios.get(upstreamUrl, {
                params: req.query,
                timeout: 15000
            });

            this.metrics.dataGenerated++;
            return res.status(200).json({
                type,
                source: 'real-upstream',
                upstream: upstreamUrl,
                timestamp: new Date().toISOString(),
                data: response.data
            });
        } catch (error) {
            this.metrics.errors++;
            return res.status(502).json({
                error: `Real upstream failed for ${type}`,
                details: error.message,
                upstream: upstreamUrl
            });
        }
    }

    getMetrics() {
        return {
            ...this.metrics,
            uptime: Date.now() - this.metrics.startTime,
            memory: process.memoryUsage().heapUsed / 1024 / 1024, // MB
            service: this.name,
            port: this.port
        };
    }

    log(message) {
        const timestamp = new Date().toISOString();
        console.log(`[API-PRODUCER] ${timestamp} - INFO: ${message}`);
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
            this.port = await findAvailablePort(3002);
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
                
                // Register with service registry
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

// Create and start the API Producer
if (require.main === module) {
    const apiProducer = new ApiProducerModule();
    
    // Handle shutdown signals
    process.on('SIGINT', () => {
        console.log('\nReceived SIGINT, shutting down gracefully...');
        apiProducer.stop();
    });
    
    process.on('SIGTERM', () => {
        console.log('\nReceived SIGTERM, shutting down gracefully...');
        apiProducer.stop();
    });
    
    // Start the service
    apiProducer.start();
}

module.exports = ApiProducerModule;
