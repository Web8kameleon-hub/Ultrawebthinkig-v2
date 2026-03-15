#!/usr/bin/env node

/**
 * NEUROSONIX REAL API DEPLOYMENT
 * ==============================
 * Deploy and run the complete real API system
 * NO FAKE DATA - Only real system metrics
 */

import { spawn } from "child_process";
import * as path from "path";
import * as os from "os";

console.log("NeuroSonix Real API Deployment");
console.log("===============================");

const systemInfo = {
  platform: os.platform(),
  arch: os.arch(),
  node_version: process.version,
  cpu_count: os.cpus().length,
  total_memory: Math.round(os.totalmem() / (1024**3)),
  hostname: os.hostname()
};

console.log("System Information:");
console.log(`   Platform: ${systemInfo.platform} ${systemInfo.arch}`);
console.log(`   Node.js: ${systemInfo.node_version}`);
console.log(`   CPUs: ${systemInfo.cpu_count}`);
console.log(`   Memory: ${systemInfo.total_memory} GB`);
console.log(`   Host: ${systemInfo.hostname}`);
console.log("");

console.log("Building TypeScript...");
const buildProcess = spawn("npm", ["run", "build"], {
  cwd: process.cwd(),
  stdio: "inherit",
  shell: true
});

buildProcess.on("close", (code) => {
  if (code === 0) {
    console.log("Build complete!");
    console.log("");
    console.log("Starting NeuroSonix Real API Server...");
    console.log("   Server URL: http://localhost:8088");
    console.log("   Health Check: http://localhost:8088/health");
    console.log("   ALBI API: http://localhost:8088/api/albi/info");
    console.log("   ALBA API: http://localhost:8088/api/alba/info");
    console.log("   JONA API: http://localhost:8088/api/jona/info");
    console.log("   Ecosystem: http://localhost:8088/api/ecosystem/status");
    console.log("");
    console.log("Real data sources active:");
    console.log("   - System CPU/Memory monitoring");
    console.log("   - File system scanning");
    console.log("   - Process metrics collection");
    console.log("   - Real-time harmony calculation");
    console.log("");
    
    // Start the server
    const serverProcess = spawn("npm", ["start"], {
      cwd: process.cwd(),
      stdio: "inherit", 
      shell: true
    });
    
    serverProcess.on("error", (error) => {
      console.error("Server error:", error);
    });
    
  } else {
    console.error("Build failed with code:", code);
    process.exit(1);
  }
});

buildProcess.on("error", (error) => {
  console.error("Build error:", error);
  process.exit(1);
});