const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

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

// Only use local electronDist if building for current local platform without explicit target overrides
if (!hasPlatformArg && fs.existsSync(path.join(root, electronDist))) {
  builderArgs.push(`--config.electronDist=${electronDist}`);
}

builderArgs.push(...userArgs);

console.log(`[Yorumi Desktop Build] Running electron-builder with args:`, userArgs.join(' ') || '(default platform)');

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

