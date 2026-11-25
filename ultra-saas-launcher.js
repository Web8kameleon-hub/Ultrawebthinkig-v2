/**
 * 🚀 Ultra SaaS Launcher - Integrated ASI Platform
 * Unified launcher for main app + asi-saas-frontend without cd navigation
 * Port 3111: ASI SaaS Frontend
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class UltraSaasLauncher {
    constructor() {
        this.mainDir = __dirname;
        this.frontendDir = path.join(__dirname, 'asi-saas-frontend');
        this.processes = new Map();
        
        console.log('🚀 Ultra SaaS Launcher Starting...');
        console.log(`📁 Main Directory: ${this.mainDir}`);
        console.log(`📁 Frontend Directory: ${this.frontendDir}`);
    }

    checkDirectories() {
        const mainExists = fs.existsSync(this.mainDir);
        const frontendExists = fs.existsSync(this.frontendDir);
        
        console.log(`✅ Main Dir exists: ${mainExists}`);
        console.log(`✅ Frontend Dir exists: ${frontendExists}`);
        
        return mainExists && frontendExists;
    }

    async startMainApp() {
        return new Promise((resolve, reject) => {
            console.log('🔥 Starting Main App on port 3000...');
            
            const mainProcess = spawn('yarn', ['dev'], {
                cwd: this.mainDir,
                stdio: ['inherit', 'pipe', 'pipe'],
                shell: true
            });

            mainProcess.stdout.on('data', (data) => {
                const output = data.toString();
                console.log(`[MAIN] ${output}`);
                
                if (output.includes('Ready on') || output.includes('localhost:23000')) {
                    console.log('✅ Main App Ready on http://localhost:23000');
                    resolve(mainProcess);
                }
            });

            mainProcess.stderr.on('data', (data) => {
                console.log(`[MAIN ERROR] ${data}`);
            });

            mainProcess.on('exit', (code) => {
                console.log(`❌ Main App exited with code ${code}`);
                this.processes.delete('main');
            });

            this.processes.set('main', mainProcess);
        });
    }

    async startFrontendApp() {
        return new Promise((resolve, reject) => {
            console.log('🎨 Starting ASI SaaS Frontend on port 3111...');
            
            const frontendProcess = spawn('yarn', ['dev', '-p', '3111'], {
                cwd: this.frontendDir,
                stdio: ['inherit', 'pipe', 'pipe'],
                shell: true
            });

            frontendProcess.stdout.on('data', (data) => {
                const output = data.toString();
                console.log(`[FRONTEND] ${output}`);
                
                if (output.includes('Ready on') || output.includes('localhost:23111')) {
                    console.log('✅ Frontend App Ready on http://localhost:23111');
                    resolve(frontendProcess);
                }
            });

            frontendProcess.stderr.on('data', (data) => {
                console.log(`[FRONTEND ERROR] ${data}`);
            });

            frontendProcess.on('exit', (code) => {
                console.log(`❌ Frontend App exited with code ${code}`);
                this.processes.delete('frontend');
            });

            this.processes.set('frontend', frontendProcess);
        });
    }

    async launch() {
        try {
            if (!this.checkDirectories()) {
                throw new Error('Required directories not found');
            }

            console.log('\n🚀 Launching Integrated Ultra SaaS Platform...\n');

            // Start both apps concurrently
            await Promise.all([
                this.startMainApp(),
                this.startFrontendApp()
            ]);

            console.log('\n🎉 Ultra SaaS Platform Successfully Launched!');
            console.log('📋 Access Points:');
            console.log('   🔹 Main App: http://localhost:23000');
            console.log('   🔹 ASI SaaS Frontend: http://localhost:23111');
            console.log('\n💡 Press Ctrl+C to stop all services\n');

        } catch (error) {
            console.error('❌ Launch failed:', error.message);
            this.cleanup();
        }
    }

    cleanup() {
        console.log('\n🧹 Cleaning up processes...');
        
        this.processes.forEach((process, name) => {
            console.log(`Terminating ${name}...`);
            process.kill('SIGTERM');
        });
        
        this.processes.clear();
        console.log('✅ Cleanup complete');
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down...');
    launcher.cleanup();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    launcher.cleanup();
    process.exit(0);
});

// Launch the platform
const launcher = new UltraSaasLauncher();
launcher.launch().catch(console.error);

module.exports = UltraSaasLauncher;
