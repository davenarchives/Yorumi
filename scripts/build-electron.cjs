const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const root = process.cwd();
const electronBuilderCli = require.resolve('electron-builder/cli.js');
const electronDist = path.relative(root, path.join(root, 'node_modules', 'electron', 'dist'));

const userArgs = process.argv.slice(2);

// Check if any platform-specific build flags were provided
const platformFlags = ['--win', '-w', '--mac', '-m', '--linux', '-l', '-wml', '--all', '-c.targets'];
const hasPlatformArg = userArgs.some((arg) =>
  platformFlags.some((flag) => arg.toLowerCase().startsWith(flag.toLowerCase()))
);

const builderArgs = [electronBuilderCli, '--publish', 'never'];

// Use local electronDist if available to prevent Windows zip unpack EPERM locks
if (fs.existsSync(path.join(root, electronDist)) && !builderArgs.some((arg) => arg.includes('electronDist'))) {
  builderArgs.push(`--config.electronDist=${electronDist}`);
}

builderArgs.push(...userArgs);

console.log(`[Yorumi Desktop Build] Running electron-builder with args:`, userArgs.join(' ') || '(default platform)');

console.log('[Yorumi Desktop Build] Bundling dist-electron/main.js with esbuild...');
try {
  const entryFile = fs.existsSync(path.join(root, 'dist-electron', 'main.bundle.js'))
    ? path.join(root, 'dist-electron', 'main.bundle.js')
    : path.join(root, 'dist-electron', 'main.js');

  esbuild.buildSync({
    entryPoints: [entryFile],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    external: ['electron'],
    outfile: path.join(root, 'dist-electron', 'main.cjs'),
    allowOverwrite: true,
  });
  fs.copyFileSync(path.join(root, 'dist-electron', 'main.cjs'), path.join(root, 'dist-electron', 'main.js'));
  console.log('[Yorumi Desktop Build] Successfully bundled dist-electron/main.cjs!');
} catch (err) {
  console.error('[Yorumi Desktop Build] Failed to bundle dist-electron/main.js:', err);
  process.exit(1);
}

const distAppDir = path.join(root, 'dist-app');
if (fs.existsSync(distAppDir)) {
  try {
    fs.rmSync(distAppDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  } catch (e) {
    console.warn('[Yorumi Desktop Build] Could not clean dist-app directory:', e.message);
  }
}

const result = spawnSync(
  process.execPath,
  builderArgs,
  {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  }
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log('[Yorumi Desktop Build] Packaging complete!');
