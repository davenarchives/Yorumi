const path = require('node:path');
const { spawn } = require('node:child_process');
const { checkBackend } = require('./check-dev-backend.cjs');

(async () => {
  const status = await checkBackend();
  if (status === 'ready') {
    console.log('[Tauri dev] Reusing the Yorumi backend on port 3001.');
    setInterval(() => {}, 60_000);
    return;
  }
  if (status === 'occupied') {
    console.error('[Tauri dev] Port 3001 is occupied by another service. Stop it before starting Yorumi.');
    process.exitCode = 1;
    return;
  }
  const backendDir = path.resolve(__dirname, '..', 'backend');
  let tsx;
  try { tsx = require.resolve('tsx/cli', { paths: [backendDir] }); }
  catch {
    console.error('[Tauri dev] Backend dependencies are missing. Run npm ci --prefix backend first.');
    process.exitCode = 1;
    return;
  }
  const child = spawn(process.execPath, [tsx, 'watch', 'src/index.ts'], {
    cwd: backendDir, stdio: 'inherit', windowsHide: true,
  });
  child.on('error', (error) => { console.error('[Tauri dev] Backend failed to start:', error.message); process.exitCode = 1; });
  child.on('exit', (code) => { process.exitCode = code || 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => { if (!child.killed) child.kill(signal); });
  }
})();
