import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, X, Smile, Play, LogOut } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { isNativeMobile, isTauri } from '../../platform/runtime';

export interface NowWatchingRef {
    label: string;
    route?: string;
}

export interface GlobalChatMessage {
    id: string;
    author: string;
    avatar?: string;
    color?: string;
    content: string;
    nowWatching?: string | NowWatchingRef;
    timestamp: number;
    fromDiscord?: boolean;
}

interface DiscordChatSession {
    token: string;
    user: {
        id: string;
        username: string;
        handle?: string;
        avatar?: string;
    };
}

interface GlobalChatDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

const DEFAULT_BRIDGE_URL = 'https://yorumibot-1.onrender.com';
const DISCORD_SESSION_KEY = 'yorumi_discord_chat_session_v1';

const USERNAME_PALETTE = [
    '#86efac', // mint green
    '#a5b4fc', // soft indigo
    '#f9a8d4', // pastel pink
    '#fdba74', // warm peach
    '#c4b5fd', // lavender
    '#7dd3fc', // sky blue
    '#fca5a5', // coral
    '#fde047', // soft yellow
];

const QUICK_EMOJIS = ['😂', '🔥', '😭', '💀', '❤️', '👀', '✨', '🍿', '👏', '😮', '🫡', '💯'];

const getAuthorColor = (author: string, roleColor?: string): string => {
    if (roleColor && roleColor !== '#000000') return roleColor;
    let hash = 0;
    for (let i = 0; i < author.length; i += 1) {
        hash = (hash * 31 + author.charCodeAt(i)) | 0;
    }
    return USERNAME_PALETTE[Math.abs(hash) % USERNAME_PALETTE.length];
};

const getBridgeUrl = () => {
    const envUrl = (import.meta.env.VITE_DISCORD_CHAT_BRIDGE_URL as string | undefined)?.trim();
    return (envUrl || DEFAULT_BRIDGE_URL).replace(/\/+$/, '');
};

const readDiscordSession = (): DiscordChatSession | null => {
    try {
        const raw = localStorage.getItem(DISCORD_SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as DiscordChatSession;
        return parsed?.token && parsed?.user?.username ? parsed : null;
    } catch {
        return null;
    }
};

const formatTimestamp = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const openExternalUrl = async (url: string) => {
    if (isTauri()) {
        try {
            const { openUrl } = await import('@tauri-apps/plugin-opener');
            await openUrl(url);
            return;
        } catch (err) {
            console.warn('[GlobalChat] Tauri openUrl failed:', err);
        }
    }
    if (isNativeMobile()) {
        try {
            await Browser.open({ url });
            return;
        } catch (err) {
            console.warn('[GlobalChat] Capacitor Browser.open failed:', err);
        }
    }
    window.open(url, '_blank', 'noopener,noreferrer');
};

const formatPlaybackTime = (seconds: number): string => {
    const total = Math.max(0, Math.floor(seconds));
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const secStr = String(secs).padStart(2, '0');
    if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${secStr}`;
    return `${mins}:${secStr}`;
};

const getLiveNowWatching = (): NowWatchingRef | undefined => {
    const win = window as Window & {
        __yorumiNowWatching?: {
            title: string;
            seasonNumber?: number;
            episodeNumber: string;
            routeBase: string;
        } | null;
    };
    const active = win.__yorumiNowWatching;
    if (!active?.title || !active.episodeNumber) return undefined;
    const video = document.querySelector('video');
    const currentSeconds = video && Number.isFinite(video.currentTime) && video.currentTime >= 0
        ? Math.floor(video.currentTime)
        : 0;
    const hasSeasonInTitle = /\bseason\s+\d+\b|\bS\d+\b/i.test(active.title);
    const seasonPart = !hasSeasonInTitle && active.seasonNumber && active.seasonNumber > 0
        ? ` S${active.seasonNumber}`
        : '';
    const timePart = video ? ` ${formatPlaybackTime(currentSeconds)}` : '';
    const label = `${active.title}${seasonPart} E${active.episodeNumber}${timePart}`.trim();
    const route = currentSeconds > 0
        ? `${active.routeBase}&t=${currentSeconds}`
        : active.routeBase;
    return { label, route };
};

export default function GlobalChatDrawer({ isOpen, onClose }: GlobalChatDrawerProps) {
    const navigate = useNavigate();
    const bridgeUrl = getBridgeUrl();
    const [session, setSession] = useState<DiscordChatSession | null>(readDiscordSession);
    const [signingIn, setSigningIn] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [messages, setMessages] = useState<GlobalChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const authPollRef = useRef<number | null>(null);

    const fetchHistory = useCallback(async (url: string) => {
        if (!url) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${url}/chat/history`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = (await res.json()) as { messages?: GlobalChatMessage[] } | GlobalChatMessage[];
            const list = Array.isArray(data) ? data : (data.messages || []);
            setMessages(list);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to connect to Discord chat bridge');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen || !bridgeUrl) return;
        void fetchHistory(bridgeUrl);

        let eventSource: EventSource | null = null;
        let pollTimer: number | null = null;

        try {
            eventSource = new EventSource(`${bridgeUrl}/chat/stream`);
            eventSource.onopen = () => {
                setError(null);
            };
            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data) as
                        | GlobalChatMessage
                        | { type: 'delete'; id: string }
                        | { type: 'deleteBulk'; ids: string[] }
                        | { type: 'update'; message: GlobalChatMessage }
                        | { type: 'presence'; onlineCount: number };
                    if ('type' in data) {
                        if (data.type === 'delete' && data.id) {
                            setMessages((prev) => prev.filter((m) => m.id !== data.id));
                            return;
                        }
                        if (data.type === 'deleteBulk' && Array.isArray(data.ids)) {
                            const removed = new Set(data.ids);
                            setMessages((prev) => prev.filter((m) => !removed.has(m.id)));
                            return;
                        }
                        if (data.type === 'update' && data.message?.id) {
                            setMessages((prev) => prev.map((m) => (m.id === data.message.id ? data.message : m)));
                            return;
                        }
                        return;
                    }
                    if (!data?.id || !data?.content) return;
                    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev.slice(-99), data]));
                } catch {
                    // Ignore malformed events
                }
            };
            eventSource.onerror = () => {
                if (!pollTimer) {
                    pollTimer = window.setInterval(() => {
                        void fetchHistory(bridgeUrl);
                    }, 8000);
                }
            };
        } catch {
            pollTimer = window.setInterval(() => {
                void fetchHistory(bridgeUrl);
            }, 8000);
        }

        return () => {
            eventSource?.close();
            if (pollTimer) window.clearInterval(pollTimer);
        };
    }, [isOpen, bridgeUrl, fetchHistory]);

    useEffect(() => {
        return () => {
            if (authPollRef.current) window.clearInterval(authPollRef.current);
        };
    }, []);

    useEffect(() => {
        if (isOpen) {
            bottomRef.current?.scrollIntoView({ behavior: 'auto' });
        }
    }, [messages, isOpen]);

    const handleDiscordSignIn = async () => {
        if (signingIn) {
            if (authPollRef.current) window.clearInterval(authPollRef.current);
            authPollRef.current = null;
            setSigningIn(false);
            return;
        }
        setSigningIn(true);
        setError(null);
        const state = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
        await openExternalUrl(`${bridgeUrl}/auth/discord/login?state=${encodeURIComponent(state)}`);

        if (authPollRef.current) window.clearInterval(authPollRef.current);
        let attempts = 0;
        authPollRef.current = window.setInterval(async () => {
            attempts += 1;
            if (attempts > 80) {
                if (authPollRef.current) window.clearInterval(authPollRef.current);
                authPollRef.current = null;
                setSigningIn(false);
                return;
            }
            try {
                const res = await fetch(`${bridgeUrl}/auth/discord/poll?state=${encodeURIComponent(state)}`);
                if (!res.ok) return;
                const data = (await res.json()) as { ready?: boolean; token?: string; user?: DiscordChatSession['user'] };
                if (data.ready && data.token && data.user) {
                    if (authPollRef.current) window.clearInterval(authPollRef.current);
                    authPollRef.current = null;
                    const nextSession: DiscordChatSession = { token: data.token, user: data.user };
                    setSession(nextSession);
                    try {
                        localStorage.setItem(DISCORD_SESSION_KEY, JSON.stringify(nextSession));
                        window.dispatchEvent(new CustomEvent('yorumi-discord-session-updated'));
                    } catch {
                        // Best effort
                    }
                    setSigningIn(false);
                }
            } catch {
                // Keep polling until timeout
            }
        }, 1500);
    };

    const handleSignOut = () => {
        setSession(null);
        try {
            localStorage.removeItem(DISCORD_SESSION_KEY);
            window.dispatchEvent(new CustomEvent('yorumi-discord-session-updated'));
        } catch {
            // Best effort
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const text = input.trim();
        if (!text || !bridgeUrl || !session || sending) return;
        setSending(true);
        setShowEmojiPicker(false);
        setError(null);
        try {
            const res = await fetch(`${bridgeUrl}/chat/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: session.token,
                    username: session.user.username,
                    content: text,
                    nowWatching: getLiveNowWatching(),
                }),
            });
            if (res.status === 401) {
                handleSignOut();
                throw new Error('Session expired. Please sign in with Discord again.');
            }
            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                throw new Error(errText || `HTTP ${res.status}`);
            }
            setInput('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send message');
        } finally {
            setSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            data-tauri-drag-region="false"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="fixed right-3 top-[calc(max(env(safe-area-inset-top,0px),16px)+3.5rem)] md:top-10 z-[2147483610] flex h-[56vh] md:h-[52vh] min-h-[340px] max-h-[520px] w-[360px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d0e12]/85 md:bg-[#0d0e12]/80 backdrop-blur-2xl shadow-2xl shadow-black/80"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                <span className="text-[14px] font-bold text-white tracking-tight">
                    Global Chat
                </span>
                <div className="flex items-center gap-1">
                    {session && (
                        <button
                            type="button"
                            onClick={handleSignOut}
                            title={`Signed in as ${session.user.username} (Sign out)`}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                        >
                            <LogOut className="h-3.5 w-3.5" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        title="Close chat"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-white/75 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Messages with subtle top fade */}
            <div
                className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-3 pb-2 space-y-3.5"
                style={{
                    maskImage: 'linear-gradient(to bottom, transparent 0%, black 22px, black 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 22px, black 100%)',
                }}
            >
                {error && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                        {error}
                    </div>
                )}
                {messages.length === 0 && !loading && !error && (
                    <div className="py-12 text-center text-xs text-white/50">
                        No messages yet. Say hi!
                    </div>
                )}
                {messages.map((msg) => {
                    const authorColor = getAuthorColor(msg.author, msg.color);
                    return (
                        <div key={msg.id} className="flex items-start gap-2.5">
                            {msg.avatar ? (
                                <img
                                    src={msg.avatar}
                                    alt=""
                                    className="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover bg-white/10"
                                />
                            ) : (
                                <div
                                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                    style={{ backgroundColor: `${authorColor}33`, color: authorColor }}
                                >
                                    {(msg.author || '?').slice(0, 1).toUpperCase()}
                                </div>
                            )}
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                    <span
                                        className="truncate text-[13px] font-bold"
                                        style={{ color: authorColor }}
                                    >
                                        {msg.author}
                                    </span>
                                    <span className="shrink-0 text-[11px] font-medium text-white/45">
                                        {formatTimestamp(msg.timestamp)}
                                    </span>
                                </div>
                                <p className="mt-0.5 break-words text-[13.5px] font-semibold leading-snug text-white">
                                    {msg.content}
                                </p>
                                {msg.nowWatching && (() => {
                                    const nw = typeof msg.nowWatching === 'string'
                                        ? { label: msg.nowWatching, route: undefined }
                                        : msg.nowWatching;
                                    if (!nw?.label) return null;
                                    return nw.route ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onClose();
                                                navigate(nw.route!);
                                            }}
                                            title="Click to watch at this timestamp"
                                            className="mt-1 flex max-w-full items-center gap-1 text-[11.5px] font-medium text-white/60 hover:text-white transition-colors cursor-pointer text-left"
                                        >
                                            <Play className="h-2.5 w-2.5 fill-current shrink-0" />
                                            <span className="truncate">{nw.label}</span>
                                        </button>
                                    ) : (
                                        <div className="mt-1 flex items-center gap-1 text-[11.5px] font-medium text-white/60">
                                            <Play className="h-2.5 w-2.5 fill-current shrink-0" />
                                            <span className="truncate">{nw.label}</span>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {/* Quick Emoji Popover */}
            {session && showEmojiPicker && (
                <div className="mx-3 mb-1.5 flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-black/80 p-2 backdrop-blur-xl">
                    {QUICK_EMOJIS.map((emoji) => (
                        <button
                            key={emoji}
                            type="button"
                            onClick={() => setInput((prev) => `${prev}${emoji}`)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-base hover:bg-white/10 transition-colors cursor-pointer"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}

            {/* Bottom Composer or Discord Sign In CTA */}
            {session ? (
                <form onSubmit={handleSend} className="flex items-center gap-2 px-3 pb-3 pt-1.5">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        maxLength={500}
                        placeholder="Message"
                        className="flex-1 rounded-xl bg-white/[0.08] px-3.5 py-2.5 text-[13.5px] text-white placeholder:text-white/45 outline-none focus:bg-white/[0.12] transition-colors"
                    />
                    <button
                        type="button"
                        onClick={() => setShowEmojiPicker((v) => !v)}
                        aria-label="Insert emoji"
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors cursor-pointer ${
                            showEmojiPicker ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                    >
                        <Smile className="h-5 w-5" />
                    </button>
                    <button
                        type="submit"
                        disabled={!input.trim() || sending}
                        aria-label="Send message"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.16] text-white disabled:opacity-40 hover:bg-white/[0.26] transition-colors cursor-pointer"
                    >
                        <Send className="h-4 w-4" />
                    </button>
                </form>
            ) : (
                <div className="px-3 pb-3 pt-1.5">
                    <button
                        type="button"
                        disabled={signingIn}
                        onClick={() => void handleDiscordSignIn()}
                        className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-white/[0.1] hover:bg-white/[0.16] py-2.5 text-[14px] font-bold text-white transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-white/[0.1]"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028ZM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
                        </svg>
                        <span>Sign in</span>
                    </button>
                </div>
            )}
        </div>
    );
}
