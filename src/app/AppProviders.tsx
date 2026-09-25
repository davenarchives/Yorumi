import type { ReactNode } from 'react';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { AnimeProvider } from '../context/AnimeContext';
import { AuthProvider } from '../context/AuthContext';
import { TitleLanguageProvider } from '../context/TitleLanguageContext';
import { isElectron, isNativeMobile } from '../platform/runtime';


export function AppProviders({ children }: { children: ReactNode }) {
    const Router = isElectron() || isNativeMobile() ? HashRouter : BrowserRouter;

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
