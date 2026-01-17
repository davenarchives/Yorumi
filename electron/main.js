const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, '../public/Yorumi.png') // Ensure you have an icon
    });

    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        // In production, load the index.html from the dist folder
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

function startBackend() {
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
        console.log('In Dev mode, assuming backend is running separately or via concurrently');
        return;
    }

    // Path to the compiled backend entry point in the build resources
    // When packaged, we need to make sure backend/dist is included
    const backendPath = path.join(process.resourcesPath, 'backend/dist/index.js');

    // We need node executable. In production electron, we might not have 'node' in path if user doesn't have it.
    // Actually, usually we bundle a node runtime or compiled binary.
    // EASIEST WAY: Bundle the backend as a standard node script and assume user has node? NO.
    // CORRECT WAY: Use 'fork' if enabled, or bundle node. 
    // However, simple approach for now:
    // We will assume 'node' is available or we bundle the backend into a binary (pkg) OR we rely on the fact that we are distributing to users who might not have node.
    // FOR NOW: Let's attempt to run it using the electron provided node context or just spawn 'node' assuming it's in env (risky).

    // OPTION B: Run backend INSIDE Electron main process? 
    // Express works inside Electron main process! 
    // BUT Puppeteer might be heavy.

    // Let's try spawning 'node'. If that fails, we might need to bundle node. 
    // For a "personal project" usually having Node installed is fine. 
    // But let's look at `fork`. 
    // const { fork } = require('child_process');
    // backendProcess = fork(backendPath, [], { env: { ...process.env, PORT: 3001, IS_ELECTRON: true } });

    // Let's assume we copy the backend build to the resources folder.

    console.log('Starting Backend form:', backendPath);

    // Note: This requires the machine to have Node.js installed.
    // To make it fully standalone, we'd need to bundle the backend into an executable or run it in-process. 
    // Given Puppeteer needs a browser, Electron has a browser... but the backend logic is separate.

    // Let's try running in-process (importing the app) if possible?
    // No, `backend/dist/index.js` exports `app`.
    // We can just require it and pass `process.env.IS_ELECTRON = true`.

    try {
        process.env.PORT = 3001;
        process.env.IS_ELECTRON = true;
        // In production, the path will need to be correct. 
        // We will configure electron-builder to put backend/dist in 'resources/backend/dist'
        const productionBackendPath = path.join(process.resourcesPath, 'backend/dist/index.js');
        require(productionBackendPath);
        console.log("Backend started in-process");
    } catch (e) {
        console.error("Failed to start backend in-process", e);
    }
}

app.on('ready', () => {
    startBackend();
    createWindow();
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
    if (mainWindow === null) createWindow();
});
