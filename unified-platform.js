#!/usr/bin/env node

/**
 * 🚀 Ultra Platform Unified - Directory Integration
 * No CD required - Direct path execution
 * Main: Port 3000 | Frontend: Port 3111
 */

const path = require('path');
const { spawn } = require('child_process');

console.log('🚀 Ultra Platform Unified - Directory Integration');

// Define exact paths
const mainDir = __dirname;
const frontendDir = path.join(__dirname, 'asi-saas-frontend');

console.log(`📁 Main: ${mainDir}`);
console.log(`📁 Frontend: ${frontendDir}`);

// Process management
const processes = [];

function cleanup() {
    console.log('\n🧹 Cleanup in progress...');
    processes.forEach((proc, i) => {
        if (proc && !proc.killed) {
            console.log(`   Terminating process ${i + 1}`);
            proc.kill('SIGTERM');
        }
    });
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Launch Main App with yarn (Port 3000)
console.log('\n🔥 Launching Main App...');
const main = spawn('yarn', ['dev'], {
    cwd: mainDir,
    stdio: ['inherit', 'pipe', 'inherit'],
    shell: true
});

main.stdout.on('data', (data) => {
    console.log(`[MAIN] ${data.toString().trim()}`);
});

processes.push(main);

// Launch Frontend with npm (Port 3111)
console.log('🎨 Launching Frontend App...');
const frontend = spawn('npm', ['run', 'dev', '--', '--port', '3111'], {
    cwd: frontendDir,
    stdio: ['inherit', 'pipe', 'inherit'],
    shell: true
});

frontend.stdout.on('data', (data) => {
    console.log(`[FRONTEND] ${data.toString().trim()}`);
});

processes.push(frontend);

console.log('\n✅ Platform Unified Launched Successfully!');
console.log('🌐 Access URLs:');
console.log('   → Main App: http://localhost:23000');
console.log('   → Frontend: http://localhost:23111');
console.log('\n🚀 Both apps running as integrated directories!');
