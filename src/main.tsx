import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppProviders } from './app/AppProviders.tsx';
import { animeService } from './services/animeService';
import { hydrateOfflineHistoryFromIdb } from './services/offlineHistoryStore';

// Restore durable IndexedDB history backup if localStorage was evicted, or seed it on first boot
void hydrateOfflineHistoryFromIdb();

// Nuke ALL persisted stream cache on every boot — prevents stale wrong-episode streams
// from carrying over across sessions. Stream caching is handled server-side.
try {
  const keysToDelete: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith('yorumi_stream_cache_')) keysToDelete.push(key);
  }
  keysToDelete.forEach(k => sessionStorage.removeItem(k));
} catch { /* ignore if sessionStorage unavailable */ }

// Also wipe backend in-memory cache (fire and forget)
animeService.clearStreamCache().catch(() => undefined);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
)
