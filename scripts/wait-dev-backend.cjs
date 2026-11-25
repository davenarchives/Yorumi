const { checkBackend } = require('./check-dev-backend.cjs');

(async () => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const status = await checkBackend();
    if (status === 'ready') return;
    if (status === 'occupied') {
      console.error('[Tauri dev] Port 3001 is occupied by another service.');
      process.exitCode = 1;
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.error('[Tauri dev] The Yorumi backend did not become ready within 60 seconds.');
  process.exitCode = 1;
})();
