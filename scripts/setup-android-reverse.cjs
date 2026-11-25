const { execSync } = require('child_process');

function setupAdbReverse() {
  try {
    const devicesOutput = execSync('adb devices', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const hasDevice = devicesOutput.split('\n').some((line) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('List of devices') && trimmed.includes('\tdevice');
    });

    if (!hasDevice) {
      return;
    }

    const ports = [5173, 5174, 3001];
    for (const port of ports) {
      try {
        execSync(`adb reverse tcp:${port} tcp:${port}`, { stdio: 'ignore' });
      } catch {
        // ignore per-port failure
      }
    }
    console.log('[Tauri Android] Configured adb reverse for ports 5173 (Vite), 5174 (HMR WS), and 3001 (Backend)');
  } catch {
    // ADB not installed or no daemon, ignore gracefully
  }
}

setupAdbReverse();

