const { execSync } = require('child_process');

const targetPorts = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['5173'];

const findListeningPidsWin32 = (port) => {
  try {
    const netstat = execSync('netstat -ano -p tcp', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const matches = netstat.split('\n').filter((line) => line.includes(`:${port}`) && line.includes('LISTENING'));
    const pids = new Set();
    for (const match of matches) {
      const parts = match.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0' && Number(pid) !== process.pid) {
        pids.add(pid);
      }
    }
    return Array.from(pids);
  } catch {
    return [];
  }
};

const sleepSync = (ms) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

try {
  for (const port of targetPorts) {
    if (process.platform === 'win32') {
      const pids = findListeningPidsWin32(port);
      for (const pid of pids) {
        console.log(`[Port Helper] Port ${port} is occupied by orphaned PID ${pid}. Freeing port...`);
        try {
          execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
        } catch {
          // ignore error if process already exited
        }
        for (let i = 0; i < 20; i += 1) {
          if (findListeningPidsWin32(port).length === 0) break;
          sleepSync(150);
        }
        console.log(`[Port Helper] PID ${pid} terminated. Port ${port} is now free.`);
      }
    } else {
      try {
        execSync(`lsof -ti tcp:${port} | xargs kill -9`, { stdio: 'ignore' });
      } catch {
        // ignore
      }
    }
  }
} catch {
  // Best effort, do not crash build
}
