import type { CapacitorConfig } from '@capacitor/cli';

const liveReloadUrl = String(process.env.CAPACITOR_SERVER_URL || '').trim();

const config: CapacitorConfig = {
    appId: 'com.yorumi.app',
    appName: 'Yorumi',
    webDir: 'dist',
    backgroundColor: '#09090b',
    android: {
        allowMixedContent: true,
    },
    server: {
        androidScheme: 'http',
        cleartext: true,
        ...(liveReloadUrl ? {
            url: liveReloadUrl,
            cleartext: liveReloadUrl.startsWith('http://'),
        } : {}),
    },
    plugins: {
        CapacitorHttp: {
            enabled: true,
        },
    },
};

export default config;
