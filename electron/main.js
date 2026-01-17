import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// Polyfill for __dirname and require in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, '../public/Yorumi.png')
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

    // In ASAR, __dirname is .../resources/app.asar/electron
    // Backend is at .../resources/app.asar/backend/dist/index.js
    const backendPath = path.join(__dirname, '../backend/dist/index.js');

    console.log('Starting Backend form:', backendPath);

    try {
        process.env.PORT = 3001;
        process.env.IS_ELECTRON = true;
        // Use the polyfilled require to load the CJS backend
        require(backendPath);
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
