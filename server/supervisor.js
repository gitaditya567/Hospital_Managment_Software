import { fork } from 'child_process';
import filepath from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = filepath.dirname(__filename);

let restartCount = 0;
let isStopping = false;

function startServer() {
  if (isStopping) return;

  const scriptPath = filepath.join(__dirname, 'index.js');
  console.log(`\n🛡️ [PROCESS SUPERVISOR] Launching MediSaaS Express REST Server (Attempt #${restartCount + 1})...`);

  const child = fork(scriptPath, [], {
    stdio: 'inherit',
    env: process.env
  });

  child.on('exit', (code, signal) => {
    if (isStopping) return;

    restartCount++;
    console.error(`\n🚨 [PROCESS SUPERVISOR ALERT] Express server process stopped unexpectedly!`);
    console.error(`   Exit Code: ${code} | Signal: ${signal}`);
    console.log(`🔄 Auto-restarting server instance in 1000ms... (Total Restarts: ${restartCount})\n`);

    setTimeout(startServer, 1000);
  });
}

// Handle graceful shutdown signals
process.on('SIGINT', () => {
  isStopping = true;
  console.log('\n👋 [PROCESS SUPERVISOR] Stopping server supervisor cleanly.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  isStopping = true;
  console.log('\n👋 [PROCESS SUPERVISOR] Stopping server supervisor cleanly.');
  process.exit(0);
});

// Start the supervisor loop
startServer();
