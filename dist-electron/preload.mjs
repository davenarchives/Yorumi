const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getEnv: () => ipcRenderer.invoke('get-env'),
    saveEnv: (content) => ipcRenderer.invoke('save-env', content),
    onM3u8Found: (cb) => {
        const handler = (_event, url) => cb(url);
        ipcRenderer.on('m3u8-found', handler);
        return handler;
    },
    offM3u8Found: (handler) => {
        if (handler) ipcRenderer.removeListener('m3u8-found', handler);
    },
    onSubtitleFound: (cb) => {
        const handler = (_event, data) => cb(data);
        ipcRenderer.on('subtitle-found', handler);
        return handler;
    },
    offSubtitleFound: (handler) => {
        if (handler) ipcRenderer.removeListener('subtitle-found', handler);
    },
    resolveAllManga: (args) => ipcRenderer.invoke('resolve-allmanga', args),
    setPlayerVideo: (args) => ipcRenderer.invoke('set-player-video', args),
    onWebviewEnterFullscreen: (cb) => {
        const handler = () => cb();
        ipcRenderer.on('webview-enter-fullscreen', handler);
        return handler;
    },
    offWebviewEnterFullscreen: (handler) => {
        if (handler) ipcRenderer.removeListener('webview-enter-fullscreen', handler);
    },
    onWebviewLeaveFullscreen: (cb) => {
        const handler = () => cb();
        ipcRenderer.on('webview-leave-fullscreen', handler);
        return handler;
    },
    offWebviewLeaveFullscreen: (handler) => {
        if (handler) ipcRenderer.removeListener('webview-leave-fullscreen', handler);
    },
    playerStopped: () => ipcRenderer.send('player-stopped'),
    queryVideoProgress: (webContentsId) => ipcRenderer.invoke('query-video-progress', webContentsId),
    downloadEpisodeChunked: (params) => ipcRenderer.invoke('download-episode-chunked', params),
    getLocalDownloads: () => ipcRenderer.invoke('get-local-downloads'),
    getLocalDownload: (args) => ipcRenderer.invoke('get-local-download', args),
    deleteLocalDownload: (args) => ipcRenderer.invoke('delete-local-download', args),
    openDownloadsFolder: (category) => ipcRenderer.invoke('open-downloads-folder', category),
    saveMangaDisk: (params) => ipcRenderer.invoke('save-manga-chapter-disk', params),
    saveLNDisk: (params) => ipcRenderer.invoke('save-ln-chapter-disk', params),
    deleteMangaDisk: (params) => ipcRenderer.invoke('delete-manga-chapter-disk', params),
    deleteLNDisk: (params) => ipcRenderer.invoke('delete-ln-chapter-disk', params),
    onDownloadProgress: (cb) => {
        const handler = (_event, progress) => cb(progress);
        ipcRenderer.on('download-progress', handler);
        return handler;
    },
    offDownloadProgress: (handler) => {
        if (handler) ipcRenderer.removeListener('download-progress', handler);
    },
    updateDiscordPresence: (presence) => ipcRenderer.invoke('update-discord-presence', presence),
    clearDiscordPresence: () => ipcRenderer.invoke('clear-discord-presence'),
    setDiscordClientId: (clientId) => ipcRenderer.invoke('set-discord-client-id', clientId),
});
