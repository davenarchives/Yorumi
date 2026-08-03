const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const packageJson = require(path.join(root, 'package.json'));
const outputDir = packageJson.build?.directories?.output || 'dist-app';
const electronBuilderCli = require.resolve('electron-builder/cli.js');
const electronDist = path.relative(root, path.join(root, 'node_modules', 'electron', 'dist'));
const appOutDir = path.join(root, outputDir, 'win-unpacked');
const packagedExe = path.join(appOutDir, `${packageJson.build?.productName || packageJson.name}.exe`);
const rawElectronExe = path.join(appOutDir, 'electron.exe');

const result = spawnSync(
  process.execPath,
  [electronBuilderCli, `--config.electronDist=${electronDist}`],
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

const standaloneExe = path.join(root, outputDir, `${packageJson.build?.productName || packageJson.name}.exe`);

if (!fs.existsSync(standaloneExe) && !fs.existsSync(packagedExe)) {
  throw new Error(`Electron build finished, but packaged app is missing: ${standaloneExe}`);
}
