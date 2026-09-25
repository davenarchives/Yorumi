const { spawnSync } = require('node:child_process');
const path = require('node:path');

const tasks = process.argv.slice(2);
if (tasks.length === 0) {
    console.error('Provide at least one Gradle task.');
    process.exit(1);
}

const androidDirectory = path.resolve(__dirname, '..', 'android');
const wrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const result = spawnSync(wrapper, tasks, {
    cwd: androidDirectory,
    stdio: 'inherit',
    shell: process.platform === 'win32',
});

if (result.error) {
    console.error(result.error.message);
    process.exit(1);
}

process.exit(result.status ?? 1);
