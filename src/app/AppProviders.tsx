import type { ReactNode } from 'react';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { AnimeProvider } from '../context/AnimeContext';
import { AuthProvider } from '../context/AuthContext';
import { TitleLanguageProvider } from '../context/TitleLanguageContext';
import { isNativeMobile, isTauri } from '../platform/runtime';


export function AppProviders({ children }: { children: ReactNode }) {
    const Router = isNativeMobile() || isTauri() ? HashRouter : BrowserRouter;

    return (
        <Router>
            <AuthProvider>
                <TitleLanguageProvider>
                    <AnimeProvider>{children}</AnimeProvider>
                </TitleLanguageProvider>
            </AuthProvider>
        </Router>
    );
}
