import { useEffect, useRef, useState } from 'react';
import { Play, ExternalLink, KeyRound } from 'lucide-react';
import { tmdbService } from '../../services/tmdbService';

type SetupError = {
    title: string;
    body: string;
};

const getErrorMessage = (reason: string, status?: number): SetupError => {
    switch (reason) {
        case 'invalid_token':
            return {
                title: 'Invalid token',
                body: 'TMDB rejected the token. Copy the long API Read Access Token that starts with eyJ, not the shorter API key.',
            };
        case 'forbidden':
            return {
                title: 'Access denied',
                body: 'TMDB returned 403 Forbidden. The token may have been revoked or the account may not have API access.',
            };
        case 'timeout':
            return {
                title: 'Request timed out',
                body: 'TMDB took too long to respond. Check your internet connection and try again.',
            };
        case 'unreachable':
            return {
                title: 'Cannot reach TMDB',
                body: 'No connection to api.themoviedb.org. Check your internet connection.',
            };
        default:
            return {
                title: 'TMDB error',
                body: `TMDB returned an unexpected error${status ? ` (${status})` : ''}. Try again in a moment.`,
            };
    }
};

const openExternal = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
};

export default function TmdbSetupScreen({ onReady }: { onReady: () => void }) {
    const [token, setToken] = useState('');
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState<SetupError | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        const timeout = window.setTimeout(() => inputRef.current?.focus(), 50);
        return () => window.clearTimeout(timeout);
    }, []);

    const handleSubmit = async () => {
        const value = token.trim();
        if (!value || checking) return;

        setChecking(true);
        setError(null);
        const result = await tmdbService.validateToken(value);
        setChecking(false);

        if (result.ok) {
            tmdbService.saveToken(value);
            onReady();
            return;
        }

        setError(getErrorMessage(result.reason, result.status));
    };


    return (
        <div className="relative flex min-h-[100dvh] items-start justify-center overflow-x-hidden overflow-y-auto bg-[#07090d] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] text-white sm:items-center sm:px-6 sm:py-8">
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-yorumi-accent/15 blur-[120px]" />
                <div className="absolute -bottom-36 -right-28 h-[28rem] w-[28rem] rounded-full bg-yorumi-main/10 blur-[140px]" />
            </div>

            <div className="relative my-auto w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#0e1117]/95 p-5 shadow-2xl shadow-black/50 sm:max-w-xl sm:p-7">
                <div className="mb-5 flex items-center gap-3.5 sm:mb-6 sm:gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-yorumi-accent/15 text-yorumi-accent sm:h-12 sm:w-12">
                        <KeyRound className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-[1.65rem] font-black leading-tight tracking-tight sm:text-3xl">Set Up TMDB</h1>
                        <p className="mt-0.5 text-[13px] leading-5 text-gray-400 sm:text-sm">Better seasons, episode artwork, and metadata.</p>
                    </div>
                </div>

                <div className="space-y-4 text-[15px] leading-6 text-gray-300 sm:text-sm">
                    <p>
                        Paste your free TMDB API Read Access Token. Use the long token beginning with
                        <span className="mx-1 rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-white">eyJ</span>
                        — not the shorter API key.
                    </p>
                    <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={() => openExternal('https://www.themoviedb.org/settings/api')}
                            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-left text-sm font-bold text-white transition-colors active:bg-white/10 sm:justify-center sm:rounded-full sm:hover:border-yorumi-accent/60 sm:hover:text-yorumi-accent"
                        >
                            TMDB API Settings
                            <ExternalLink className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => openExternal('https://yorumi.vercel.app/#docs-tmdb')}
                            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-yorumi-accent/25 bg-yorumi-accent/10 px-4 py-2.5 text-left text-sm font-bold text-yorumi-accent transition-colors active:bg-yorumi-accent/20 sm:justify-center sm:rounded-full sm:hover:border-yorumi-accent/60"
                        >
                            Step-by-step guide
                            <ExternalLink className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="mt-5 space-y-3 sm:mt-6">
                    <input
                        ref={inputRef}
                        type="password"
                        value={token}
                        onChange={(event) => {
                            setToken(event.target.value);
                            setError(null);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') handleSubmit();
                        }}
                        placeholder="Paste your TMDB Read Access Token"
                        disabled={checking}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        className={`h-12 min-w-0 w-full rounded-xl border bg-black/30 px-4 text-[13px] text-white outline-none transition-colors placeholder:text-gray-600 focus:border-yorumi-accent sm:text-sm ${
                            error ? 'border-red-500/70' : 'border-white/10'
                        }`}
                    />

                    {error && (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                            <div className="font-black text-red-200">{error.title}</div>
                            <div className="mt-1 text-sm text-red-100/80">{error.body}</div>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!token.trim() || checking}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-yorumi-accent px-5 font-black text-black transition-colors active:scale-[0.99] sm:hover:bg-[#62c5f6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {checking ? (
                            <>
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                                Checking
                            </>
                        ) : (
                            <>
                                <Play className="h-4 w-4 fill-current" />
                                Continue
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
