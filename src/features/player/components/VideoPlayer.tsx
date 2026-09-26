import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import Hls from 'hls.js';
import { Maximize, X, Globe, CheckCircle2, Circle } from 'lucide-react';
import type { StreamLink, SubtitleTrack } from '../../../types/stream';
import { API_BASE, API_ORIGIN } from '../../../config/api';
import CustomVideoControls from './CustomVideoControls';
import type { StreamServerKey } from '../../../hooks/useStreams';
import { shouldSkipIntro, shouldSkipOutro, type SkipTimestamp } from '../../../services/skipTimestamps';
import sleepingGif from '../../../assets/sleeping.gif';
import discordRPCService from '../../../services/discordRPCService';
import { getRuntimePlatform } from '../../../platform/runtime';

const IFRAME_LOAD_TIMEOUT_MS = 18_000;
const NATIVE_LOAD_TIMEOUT_MS = 25_000;
const MEDIA_STALL_TIMEOUT_MS = 25_000;
const PLAYBACK_START_WATCHDOG_MS = 30_000;
const HAVE_FUTURE_DATA = 3;
const isElectron = typeof window !== 'undefined' && (window.location.protocol === 'file:' || Boolean((window as any).electron || (window as any).electronAPI));
const isNativeMobile = getRuntimePlatform() === 'android' || getRuntimePlatform() === 'ios';

const LATIN_LANGUAGE_WORDS: Record<string, string[]> = {
    en: ['the', 'you', 'and', 'that', 'this', 'what', 'are', 'have', 'not', 'with', 'your', 'for', 'but', 'was', 'will'],
    es: ['que', 'los', 'las', 'una', 'por', 'para', 'con', 'como', 'pero', 'está', 'esto', 'del', 'más', 'tienes', 'porque'],
    fr: ['que', 'les', 'des', 'une', 'pour', 'avec', 'pas', 'vous', 'nous', 'est', 'dans', 'mais', 'plus', 'tout', 'être'],
    de: ['und', 'der', 'die', 'das', 'nicht', 'ich', 'ist', 'mit', 'ein', 'eine', 'für', 'was', 'auf', 'den', 'wir'],
    it: ['che', 'non', 'una', 'per', 'con', 'sono', 'questo', 'come', 'del', 'della', 'hai', 'ma', 'più', 'tutto', 'essere'],
    pt: ['que', 'não', 'uma', 'para', 'com', 'você', 'por', 'isso', 'como', 'mas', 'está', 'mais', 'dos', 'das', 'tem'],
    id: ['yang', 'dan', 'tidak', 'ini', 'itu', 'dengan', 'untuk', 'aku', 'kamu', 'saya', 'dari', 'ada', 'apa', 'akan', 'bisa'],
    tr: ['bir', 've', 'bu', 'değil', 'için', 'ben', 'sen', 'ile', 'ne', 'ama', 'var', 'çok', 'gibi', 'daha', 'olan'],
    pl: ['nie', 'się', 'jest', 'jak', 'ale', 'dla', 'ten', 'tak', 'mam', 'czy', 'co', 'już', 'tylko', 'tego', 'będzie'],
    nl: ['niet', 'een', 'het', 'van', 'dat', 'voor', 'met', 'maar', 'wat', 'zijn', 'heb', 'deze', 'als', 'ook', 'kan'],
    ro: ['și', 'este', 'nu', 'pentru', 'din', 'sunt', 'asta', 'dar', 'mai', 'ce', 'cu', 'care', 'fost', 'poate', 'acum'],
    vi: ['không', 'một', 'của', 'và', 'tôi', 'bạn', 'cho', 'được', 'này', 'đó', 'nhưng', 'với', 'có', 'là', 'gì'],
};

const detectLatinSubtitleLanguage = (text: string): string | null => {
    const words = text
        .replace(/^WEBVTT.*$/gim, ' ')
        .replace(/\d{1,2}:\d{2}[^\n]*/g, ' ')
        .replace(/<[^>]+>|\{[^}]+\}/g, ' ')
        .toLocaleLowerCase()
        .match(/[\p{L}]+/gu) || [];
    if (words.length < 12) return null;

    const counts = new Map<string, number>();
    words.slice(0, 1500).forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
    const ranked = Object.entries(LATIN_LANGUAGE_WORDS)
        .map(([language, markers]) => ({
            language,
            score: markers.reduce((total, marker) => total + Math.min(counts.get(marker) || 0, 4), 0),
        }))
        .sort((left, right) => right.score - left.score);
    const best = ranked[0];
    const runnerUp = ranked[1];
    return best && best.score >= 4 && best.score >= runnerUp.score + 2 ? best.language : null;
};

const detectSubtitleLanguage = (text: string, url: string): string | null => {
    if (/[\u0600-\u06ff]/u.test(text)) return 'ar';
    if (/[\u0e00-\u0e7f]/u.test(text)) return 'th';
    if (/[\uac00-\ud7af]/u.test(text)) return 'ko';
    if (/[\u3040-\u30ff]/u.test(text)) return 'ja';
    if (/[\u0400-\u04ff]/u.test(text)) return 'ru';
    if (/[\u4e00-\u9fff]/u.test(text)) return 'zh';

    const detectedLatinLanguage = detectLatinSubtitleLanguage(text);
    if (detectedLatinLanguage) return detectedLatinLanguage;

    const hint = decodeURIComponent(url).match(/(?:^|[\/_?&=.-])(english|eng|en|arabic|ara|ar|spanish|spa|es|french|fra|fr|german|deu|de|italian|ita|it|indonesian|ind|id|portuguese|por|pt|vietnamese|vie|vi)(?:[\/_?&=.-]|$)/i)?.[1]?.toLowerCase();
    const aliases: Record<string, string> = {
        english: 'en', eng: 'en', arabic: 'ar', ara: 'ar', spanish: 'es', spa: 'es',
        french: 'fr', fra: 'fr', german: 'de', deu: 'de', italian: 'it', ita: 'it',
        indonesian: 'id', ind: 'id', portuguese: 'pt', por: 'pt', vietnamese: 'vi', vie: 'vi',
    };
    return hint ? (aliases[hint] || hint) : null;
};

class CustomHlsLoader extends (Hls.DefaultConfig.loader as any) {
    constructor(config: any) {
        super(config);
    }

    load(context: any, config: any, callbacks: any) {
        if (typeof context?.url === 'string' && (context.url.startsWith('blob:') || context.url.includes('/api/scraper/local-file'))) {
            const targetUrl = context.url.startsWith('/api/') ? `${API_ORIGIN}${context.url}` : context.url;
            const startTime = performance.now();
            fetch(targetUrl)
                .then(async (res) => {
                    if (!res.ok) {
                        throw new Error(`Failed to fetch media: ${res.status}`);
                    }
                    if (context.responseType === 'arraybuffer') {
                        const data = await res.arrayBuffer();
                        const now = performance.now();
                        callbacks.onSuccess(
                            {
                                url: context.url,
                                data,
                            },
                            {
                                trequest: startTime,
                                tfirst: now,
                                tload: now,
                                loaded: data.byteLength,
                                total: data.byteLength,
                            },
                            context,
                            null
                        );
                    } else {
                        const data = await res.text();
                        const now = performance.now();
                        callbacks.onSuccess(
                            {
                                url: context.url,
                                data,
                            },
                            {
                                trequest: startTime,
                                tfirst: now,
                                tload: now,
                                loaded: data.length,
                                total: data.length,
                            },
                            context,
                            null
                        );
                    }
                })
                .catch((err) => {
                    callbacks.onError(
                        { code: 404, text: err?.message || 'Blob fetch failed' },
                        context,
                        null
                    );
                });
            return;
        }
        super.load(context, config, callbacks);
    }
}

type ThemedWebViewElement = HTMLWebViewElement & {
    insertCSS: (css: string) => Promise<string>;
    executeJavaScript: <T = unknown>(code: string) => Promise<T>;
};

export interface VideoPlayerProps {
    streamUrl?: string;
    episodeSession?: string;
    isHls?: boolean;
    isEmbed?: boolean;
    subtitles?: SubtitleTrack[];
    isLoading: boolean;
    isServerSwitching?: boolean;
    hasPlayableSource?: boolean;
    streamExhausted?: boolean;
    skipTimestampsLoading?: boolean;
    onLoad?: () => void;
    onError?: () => void;
    onProgress?: (progress: { currentTime: number; duration: number; ended?: boolean }) => void;
    startAtSeconds?: number;
    onNextEpisode?: () => void;
    onPrevEpisode?: () => void;
    hasNextEpisode?: boolean;
    autoNextEnabled?: boolean;
    onAutoNextChange?: (enabled: boolean) => void;
    autoSkipEnabled?: boolean;
    onAutoSkipChange?: (enabled: boolean) => void;
    skipTimestamps?: SkipTimestamp[];
    selectedAudio: 'sub' | 'dub';
    availableAudios: Array<'sub' | 'dub'>;
    onAudioChange: (audio: 'sub' | 'dub') => void;
    streams: StreamLink[];
    selectedStreamIndex: number;
    isAutoQuality: boolean;
    onQualityChange: (index: number) => void;
    onSetAutoQuality: () => void;
    selectedServer: StreamServerKey;
    serverOptions: Array<{ key: StreamServerKey; label: string }>;
    onServerChange: (server: StreamServerKey) => void;
    displayMode?: 'full' | 'mini';
    onMiniClose?: () => void;
    onMiniExpand?: () => void;
    onPlaybackStateChange?: (state: { isPlaying: boolean }) => void;
    isWide?: boolean;
    onToggleWide?: () => void;
    animeId?: string;
    animeTitle?: string;
    animeImage?: string;
    episodeNumber?: number;
    episodeTitle?: string;
    expectedDurationSeconds?: number | null;
    mobilePageLayout?: boolean;
}

export default function VideoPlayer(props: VideoPlayerProps) {
    const {
        streamUrl,
        episodeSession,
        isLoading,
        isServerSwitching,
        hasPlayableSource = true,
        streamExhausted = false,
        skipTimestampsLoading = false,
        onLoad,
        onError,
        onProgress,
        startAtSeconds,
        isHls,
        isEmbed,
        onNextEpisode,
        onPrevEpisode,
        hasNextEpisode,
        autoNextEnabled = true,
        onAutoNextChange,
        autoSkipEnabled = true,
        onAutoSkipChange,
        skipTimestamps = [],
        selectedAudio,
        availableAudios,
        onAudioChange,
        streams,
        selectedStreamIndex,
        isAutoQuality,
        onQualityChange,
        onSetAutoQuality,
        selectedServer,
        serverOptions,
        onServerChange,
        displayMode = 'full',
        onMiniClose,
        onMiniExpand,
        onPlaybackStateChange,
        isWide,
        onToggleWide,
    } = props;

    const onLoadRef = useRef(onLoad);
    const onErrorRef = useRef(onError);
    const onProgressRef = useRef(onProgress);
    const startAtRef = useRef(startAtSeconds);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const webviewRef = useRef<ThemedWebViewElement | null>(null);
    const hlsRef = useRef<Hls | null>(null);
    const iframeLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const iframeReadyNotifiedRef = useRef(false);
    const nativeLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mediaStallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autoSkipPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const autoNextTriggerKeyRef = useRef('');
    const rejectedMediaUrlRef = useRef('');
    const lastTimeRef = useRef<{ session?: string; time: number }>({ time: 0 });
    const [showServerMenu, setShowServerMenu] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [hlsLevels, setHlsLevels] = useState<number[]>([]);

    useEffect(() => {
        if (props.animeTitle && props.episodeNumber) {
            discordRPCService.setWatchingAnime(
                props.animeTitle,
                props.episodeNumber,
                props.episodeTitle,
                props.animeImage
            );
        }
        return () => {
            discordRPCService.setBrowsing('Anime');
        };
    }, [props.animeTitle, props.episodeNumber, props.episodeTitle, props.animeImage]);

    const handleHlsQualitySelect = useCallback((quality: string) => {
        if (!hlsRef.current) return false;
        const hls = hlsRef.current;
        if (!hls.levels || hls.levels.length === 0) return false;

        if (quality === 'Auto') {
            hls.currentLevel = -1;
            return true;
        }

        const targetHeight = parseInt(quality, 10);
        if (isNaN(targetHeight)) return false;

        let bestIndex = -1;
        let minDiff = Infinity;
        hls.levels.forEach((lvl: any, idx: number) => {
            const h = lvl.height || 0;
            const diff = Math.abs(h - targetHeight);
            if (diff < minDiff) {
                minDiff = diff;
                bestIndex = idx;
            }
        });

        if (bestIndex >= 0 && minDiff <= 150) {
            hls.currentLevel = bestIndex;
            return true;
        }
        return false;
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);
    const getServerDisplayName = (key: string) => {
        const option = serverOptions?.find((s) => s.key === key);
        if (option?.label) return option.label;
        if (key === 'frieren' || key === 'hianime' || key === 'auto') return 'Frieren';
        if (key === 'stark' || key === 'start' || key === 'anikoto') return 'Stark';
        if (key === 'fern' || key === 'animegg') return 'Fern';
        if (key === 'himmel' || key === 'reanime') return 'Himmel';
        return key.replace(/[-_]+/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
    };

    const resolvedStreamUrl = useMemo(() => {
        if (!streamUrl) return streamUrl;
        let url = streamUrl;
        if (!streamUrl.includes('/api/scraper/embed') && /^https?:\/\/([^/]+\.)?kwik\./i.test(streamUrl)) {
            url = `${API_ORIGIN}/api/scraper/embed?url=${encodeURIComponent(streamUrl)}`;
        } else if (url.startsWith('/api/')) {
            url = `${API_ORIGIN}${url}`;
        }
        return url;
    }, [streamUrl]);

    const resolveSubtitleUrl = useCallback((url: string) => {
        if (!url) return url;
        if (url.startsWith('/api/')) return `${API_ORIGIN}${url}`;
        return url;
    }, []);

    const [detectedSubtitleLanguages, setDetectedSubtitleLanguages] = useState<Record<string, string>>({});
    const subtitleTrackSignature = useMemo(() => (Array.isArray(props.subtitles) ? props.subtitles : [])
        .map((track) => `${track.url}|${track.lang}`)
        .join('::'), [props.subtitles]);

    useEffect(() => {
        const tracks = Array.isArray(props.subtitles) ? props.subtitles : [];
        const controller = new AbortController();
        let active = true;

        Promise.all(tracks.map(async (track) => {
            const url = String(track?.url || '').trim();
            if (!url) return null;
            try {
                const response = await fetch(resolveSubtitleUrl(url), { signal: controller.signal });
                if (!response.ok) return null;
                const language = detectSubtitleLanguage((await response.text()).slice(0, 262144), url);
                return language ? [url, language] as const : null;
            } catch {
                return null;
            }
        })).then((results) => {
            if (!active) return;
            const detected = Object.fromEntries(results.filter((result): result is readonly [string, string] => Boolean(result)));
            setDetectedSubtitleLanguages(detected);
        });

        return () => {
            active = false;
            controller.abort();
        };
    }, [subtitleTrackSignature, resolveSubtitleUrl]);

    const subtitleTracks = useMemo(() => {
        const tracks = Array.isArray(props.subtitles) ? props.subtitles : [];
        const subtitleLanguageRank = (language: string) => {
            const normalized = language.trim().toLowerCase().replace(/_/g, '-');
            const isEnglish = /(^|\b)(en|eng|english)(-|\b)/.test(normalized);
            if (!isEnglish) return 2;

            // Prefer full English dialogue over signs/songs-only tracks.
            return /sign|song|forced/.test(normalized) ? 1 : 0;
        };

        const uniqueTracks = new Map<string, SubtitleTrack>();
        tracks.forEach((track) => {
            const url = String(track?.url || '').trim();
            if (url && !uniqueTracks.has(url)) {
                uniqueTracks.set(url, detectedSubtitleLanguages[url]
                    ? { ...track, lang: detectedSubtitleLanguages[url] }
                    : track);
            }
        });

        return Array.from(uniqueTracks.values())
            .sort((left, right) => (
                subtitleLanguageRank(String(left.lang || '')) - subtitleLanguageRank(String(right.lang || ''))
            ));
    }, [detectedSubtitleLanguages, props.subtitles]);

    const isOfflineStream = useMemo(() => {
        return Boolean(
            streamUrl?.startsWith('blob:') ||
            streamUrl?.startsWith('atom://') ||
            streamUrl?.startsWith('file://') ||
            streamUrl?.includes('/api/scraper/local-file') ||
            streams[selectedStreamIndex]?.provider === 'Offline Storage'
        );
    }, [streamUrl, streams, selectedStreamIndex]);

    const shouldUseNativeVideo = useMemo(() => {
        if (!resolvedStreamUrl) return false;
        if (isOfflineStream) return true;
        if (isEmbed) return false;
        if (selectedServer === 'frieren' || (selectedServer as string) === 'hianime') return true;
        if (isHls || /\.m3u8/i.test(resolvedStreamUrl)) return true;
        if (/\/api\/scraper\/embed\?/i.test(resolvedStreamUrl)) return false;
        if (/\/api\/scraper\/proxy\?/i.test(resolvedStreamUrl)) return true;
        if (/\.(mp4|webm|mkv)(?:[?#]|$)/i.test(resolvedStreamUrl)) return true;
        return /fast4speed\.rsvp|googlevideo\.com|okcdn\.ru|ok\.ru/i.test(resolvedStreamUrl);
    }, [isHls, isEmbed, isOfflineStream, resolvedStreamUrl, selectedServer]);

    useEffect(() => {
        onLoadRef.current = onLoad;
    }, [onLoad]);

    useEffect(() => {
        onErrorRef.current = onError;
    }, [onError]);

    useEffect(() => {
        onProgressRef.current = onProgress;
    }, [onProgress]);

    useEffect(() => {
        startAtRef.current = startAtSeconds;
    }, [startAtSeconds]);

    const clearIframeLoadTimeout = useCallback(() => {
        if (iframeLoadTimeoutRef.current) {
            clearTimeout(iframeLoadTimeoutRef.current);
            iframeLoadTimeoutRef.current = null;
        }
    }, []);

    const notifyIframeReady = useCallback(() => {
        if (iframeReadyNotifiedRef.current) return;
        iframeReadyNotifiedRef.current = true;
        onLoadRef.current?.();
        onPlaybackStateChange?.({ isPlaying: true });
    }, [onPlaybackStateChange]);

    const clearMediaStallTimeout = useCallback(() => {
        if (mediaStallTimeoutRef.current) {
            clearTimeout(mediaStallTimeoutRef.current);
            mediaStallTimeoutRef.current = null;
        }
    }, []);

    const clearAutoSkipPoll = useCallback(() => {
        if (autoSkipPollRef.current) {
            clearInterval(autoSkipPollRef.current);
            autoSkipPollRef.current = null;
        }
    }, []);

    const clearNativeLoadTimeout = useCallback(() => {
        if (nativeLoadTimeoutRef.current) {
            clearTimeout(nativeLoadTimeoutRef.current);
            nativeLoadTimeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        clearIframeLoadTimeout();
        if (!resolvedStreamUrl || shouldUseNativeVideo) return;

        iframeLoadTimeoutRef.current = setTimeout(() => {
            iframeLoadTimeoutRef.current = null;
            onErrorRef.current?.();
        }, IFRAME_LOAD_TIMEOUT_MS);

        return clearIframeLoadTimeout;
    }, [clearIframeLoadTimeout, resolvedStreamUrl, shouldUseNativeVideo]);

    useEffect(() => {
        iframeReadyNotifiedRef.current = false;
        rejectedMediaUrlRef.current = '';
    }, [resolvedStreamUrl]);

    useEffect(() => {
        clearNativeLoadTimeout();
        const video = videoRef.current;
        if (!video || !shouldUseNativeVideo || !resolvedStreamUrl) return;

        const clearIfReady = () => {
            if (video.readyState >= HAVE_FUTURE_DATA) {
                clearNativeLoadTimeout();
            }
        };

        nativeLoadTimeoutRef.current = setTimeout(() => {
            nativeLoadTimeoutRef.current = null;
            if (!video.ended && video.readyState < HAVE_FUTURE_DATA) {
                onErrorRef.current?.();
            }
        }, NATIVE_LOAD_TIMEOUT_MS);

        video.addEventListener('canplay', clearIfReady);
        video.addEventListener('canplaythrough', clearIfReady);
        video.addEventListener('playing', clearIfReady);
        video.addEventListener('timeupdate', clearIfReady);
        clearIfReady();

        return () => {
            video.removeEventListener('canplay', clearIfReady);
            video.removeEventListener('canplaythrough', clearIfReady);
            video.removeEventListener('playing', clearIfReady);
            video.removeEventListener('timeupdate', clearIfReady);
            clearNativeLoadTimeout();
        };
    }, [clearNativeLoadTimeout, resolvedStreamUrl, shouldUseNativeVideo]);

    useEffect(() => {
        const webview = webviewRef.current;
        if (!webview || shouldUseNativeVideo) return;

        const handleLoad = () => {
            clearIframeLoadTimeout();
            notifyIframeReady();

            try {
                // Advanced CSS overrides for modern Tailwind players
                webview.insertCSS(`
                        :root {
                            --primary: #3DB4F2 !important;
                        --primary-color: #3DB4F2 !important;
                        --theme-color: #3DB4F2 !important;
                        --accent: #3DB4F2 !important;
                        --accent-color: #3DB4F2 !important;
                        --red: #3DB4F2 !important;
                        --destructive: #3DB4F2 !important;
                        --plyr-color-main: #3DB4F2 !important;
                    }
                    /* Override Tailwind arbitrary color classes preserving opacity */
                    [class*="bg-\\[\\#e50914\\]"], [class*="bg-\\[\\#E50914\\]"], [class*="bg-\\[\\#ef4444\\]"], [class*="bg-\\[\\#dc2626\\]"], [class*="bg-\\[\\#b91c1c\\]"], [class*="bg-\\[\\#ff0000\\]"], [class*="bg-red-"] {
                        background-color: rgb(61 180 242 / var(--tw-bg-opacity, 1)) !important;
                    }
                    [class*="text-\\[\\#e50914\\]"], [class*="text-\\[\\#E50914\\]"], [class*="text-\\[\\#ef4444\\]"], [class*="text-\\[\\#dc2626\\]"], [class*="text-\\[\\#b91c1c\\]"], [class*="text-\\[\\#ff0000\\]"], [class*="text-red-"] {
                        color: rgb(61 180 242 / var(--tw-text-opacity, 1)) !important;
                    }
                    [class*="border-\\[\\#e50914\\]"], [class*="border-\\[\\#E50914\\]"], [class*="border-\\[\\#ef4444\\]"], [class*="border-\\[\\#dc2626\\]"], [class*="border-\\[\\#b91c1c\\]"], [class*="border-\\[\\#ff0000\\]"], [class*="border-red-"] {
                        border-color: rgb(61 180 242 / var(--tw-border-opacity, 1)) !important;
                    }
                    [class*="ring-\\[\\#e50914\\]"], [class*="ring-\\[\\#E50914\\]"], [class*="ring-\\[\\#ef4444\\]"], [class*="ring-\\[\\#dc2626\\]"], [class*="ring-red-"] {
                        --tw-ring-color: rgb(61 180 242 / var(--tw-ring-opacity, 1)) !important;
                    }
                    /* Also handle SVG strokes and fills */
                    [class*="stroke-\\[\\#e50914\\]"], [class*="stroke-\\[\\#ef4444\\]"], [class*="stroke-red-"] { stroke: #3DB4F2 !important; }
                    [class*="fill-\\[\\#e50914\\]"], [class*="fill-\\[\\#ef4444\\]"], [class*="fill-red-"] { fill: #3DB4F2 !important; }
                    /* Pseudo-element tab active indicators (::before / ::after underlines) */
                    [class*="red-"]::before, [class*="red-"]::after,
                    [class*="rose-"]::before, [class*="rose-"]::after,
                    [class*="primary"]::before, [class*="primary"]::after {
                        background-color: #3DB4F2 !important;
                        border-color: #3DB4F2 !important;
                        color: #3DB4F2 !important;
                    }
                    /* Catch active/selected tab bottom border lines */
                    [class*="border-b"][class*="red-"],
                    [class*="border-b"][class*="rose-"],
                    [class*="border-b"][class*="primary"] {
                        border-bottom-color: #3DB4F2 !important;
                    }
                `);

                // Deep JS mutation observer to forcefully recolor any dynamic or inline styles that are Netflix Red
                webview.executeJavaScript(`
                    (function() {
                        const style = document.createElement('style');
                        style.textContent = \`
                            :root {
                                --primary: #3DB4F2 !important;
                                --primary-color: #3DB4F2 !important;
                                --theme-color: #3DB4F2 !important;
                                --accent: #3DB4F2 !important;
                                --accent-color: #3DB4F2 !important;
                                --red: #3DB4F2 !important;
                                --destructive: #3DB4F2 !important;
                                --plyr-color-main: #3DB4F2 !important;
                            }
                            .text-\\\\[\\\\#e50914\\\\], .text-\\\\[\\\\#E50914\\\\], .text-\\\\[\\\\#ff0000\\\\], .text-primary {
                                color: rgb(61 180 242 / var(--tw-text-opacity, 1)) !important;
                            }
                            .bg-\\\\[\\\\#e50914\\\\], .bg-\\\\[\\\\#E50914\\\\], .bg-\\\\[\\\\#ff0000\\\\], .bg-primary, .plyr__progress__buffer, .vjs-play-progress {
                                background-color: rgb(61 180 242 / var(--tw-bg-opacity, 1)) !important;
                            }
                            .border-\\\\[\\\\#e50914\\\\], .border-\\\\[\\\\#E50914\\\\], .border-\\\\[\\\\#ff0000\\\\], .border-primary {
                                border-color: rgb(61 180 242 / var(--tw-border-opacity, 1)) !important;
                            }
                            [class*="text-red-"], [class*="text-rose-"] {
                                color: rgb(61 180 242 / var(--tw-text-opacity, 1)) !important;
                            }
                            [class*="bg-red-"], [class*="bg-rose-"] {
                                background-color: rgb(61 180 242 / var(--tw-bg-opacity, 1)) !important;
                            }
                            [class*="border-red-"], [class*="border-rose-"] {
                                border-color: rgb(61 180 242 / var(--tw-border-opacity, 1)) !important;
                            }
                            [class*="ring-red-"], [class*="ring-rose-"] {
                                --tw-ring-color: rgb(61 180 242 / var(--tw-ring-opacity, 1)) !important;
                            }
                            /* Hardcoded CSS rule overrides */
                            [style*="color: rgb(229, 9, 20)"], [style*="color: rgb(239, 68, 68)"], [style*="color: rgb(220, 38, 38)"], [style*="color: #e50914"], [style*="color: #E50914"], [style*="color: #ef4444"], [style*="color: #dc2626"], [style*="color: #ff0000"] {
                                color: #3DB4F2 !important;
                            }
                            [style*="background-color: rgb(229, 9, 20)"], [style*="background-color: rgb(239, 68, 68)"], [style*="background-color: rgb(220, 38, 38)"], [style*="background-color: #e50914"], [style*="background-color: #E50914"], [style*="background-color: #ef4444"], [style*="background-color: #dc2626"], [style*="background-color: #ff0000"] {
                                background-color: #3DB4F2 !important;
                            }
                            [style*="border-color: rgb(229, 9, 20)"], [style*="border-color: rgb(239, 68, 68)"], [style*="border-color: rgb(220, 38, 38)"], [style*="border-color: #e50914"], [style*="border-color: #E50914"], [style*="border-color: #ef4444"], [style*="border-color: #dc2626"], [style*="border-color: #ff0000"] {
                                border-color: #3DB4F2 !important;
                            }
                        \`;
                        document.head.appendChild(style);
                        
                        const isRed = (str) => {
                            if (!str) return false;
                            const redRegex = /229,\\s*9,\\s*20|229\\s+9\\s+20|239,\\s*68,\\s*68|239\\s+68\\s+68|220,\\s*38,\\s*38|220\\s+38\\s+38|185,\\s*28,\\s*28|185\\s+28\\s+28|244,\\s*63,\\s*94|244\\s+63\\s+94|225,\\s*29,\\s*72|225\\s+29\\s+72|#e50914|#ef4444|#dc2626|#b91c1c|#f43f5e|#e11d48/gi;
                            return !!str.match(redRegex);
                        };
                        const toBlue = (str) => {
                            if (!str) return str;
                            return str.replace(/229,\\s*9,\\s*20|239,\\s*68,\\s*68|220,\\s*38,\\s*38|185,\\s*28,\\s*28|244,\\s*63,\\s*94|225,\\s*29,\\s*72/g, '61, 180, 242')
                                      .replace(/229\\s+9\\s+20|239\\s+68\\s+68|220\\s+38\\s+38|185\\s+28\\s+28|244\\s+63\\s+94|225\\s+29\\s+72/g, '61 180 242')
                                      .replace(/#e50914|#ef4444|#dc2626|#b91c1c|#f43f5e|#e11d48/gi, '#3DB4F2');
                        };

                        // Bulletproof Computed Style Overrides
                        let isWalkingComputed = false;
                        const walkComputed = () => {
                            if (isWalkingComputed) return;
                            isWalkingComputed = true;
                            
                            const nodes = document.querySelectorAll('*');
                            for (let i = 0; i < nodes.length; i++) {
                                const node = nodes[i];
                                const comp = window.getComputedStyle(node);
                                
                                const checkAndFix = (prop, cssProp) => {
                                    const val = comp[prop];
                                    if (val && val !== 'rgba(0, 0, 0, 0)' && val !== 'transparent' && val.includes('rgb')) {
                                        const match = val.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
                                        if (match) {
                                            const r = parseInt(match[1]); const g = parseInt(match[2]); const b = parseInt(match[3]);
                                            // Red detection: High red value, significantly higher than Green and Blue.
                                            // r > g * 2 prevents orange. r > b * 1.5 includes rose.
                                            if (r > 130 && r > g * 2 && r > b * 1.5) {
                                                node.style.setProperty(cssProp, match[4] ? \`rgba(61, 180, 242, \${match[4]})\` : 'rgb(61, 180, 242)', 'important');
                                            }
                                        }
                                    }
                                };
                                checkAndFix('backgroundColor', 'background-color');
                                checkAndFix('color', 'color');
                                checkAndFix('borderColor', 'border-color');
                                checkAndFix('outlineColor', 'outline-color');
                                checkAndFix('fill', 'fill');
                                checkAndFix('stroke', 'stroke');
                            }
                            isWalkingComputed = false;
                        };

                        const performPass = () => {
                            // 1. Forcefully rewrite dynamically added style tags to prevent flashing
                            document.querySelectorAll('style').forEach(style => {
                                if (style.textContent && isRed(style.textContent)) {
                                    style.textContent = toBlue(style.textContent);
                                }
                            });
                            // 2. Walk computed styles for bulletproof override
                            walkComputed();
                        };
                        performPass();
                        
                        // Use mutation observer for high performance instead of setInterval if possible
                        const observer = new MutationObserver((mutations) => {
                            let shouldWalk = false;
                            for (const m of mutations) {
                                if (m.addedNodes.length > 0 || m.attributeName === 'style' || m.attributeName === 'class' || m.target.nodeName.toLowerCase() === 'style') {
                                    shouldWalk = true;
                                    break;
                                }
                            }
                            if (shouldWalk) performPass();
                        });
                        observer.observe(document.head, { childList: true, subtree: true, characterData: true });
                        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
                        
                        // Failsafe
                        setInterval(performPass, 1000);
                    })();
                `);
            } catch (e) {
                console.error("Failed to inject theme CSS into webview", e);
            }
        };

        const handleEnterFullscreen = () => {
            const shell = webview.closest('.watch-player-shell');
            if (shell) shell.requestFullscreen().catch(console.error);
        };

        const handleLeaveFullscreen = () => {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(console.error);
            }
        };

        webview.addEventListener('dom-ready', handleLoad);
        webview.addEventListener('enter-html-full-screen', handleEnterFullscreen);
        webview.addEventListener('leave-html-full-screen', handleLeaveFullscreen);

        return () => {
            webview.removeEventListener('dom-ready', handleLoad);
            webview.removeEventListener('enter-html-full-screen', handleEnterFullscreen);
            webview.removeEventListener('leave-html-full-screen', handleLeaveFullscreen);
        };
    }, [clearIframeLoadTimeout, notifyIframeReady, resolvedStreamUrl, shouldUseNativeVideo]);

    useEffect(() => {
        clearMediaStallTimeout();
        const video = videoRef.current;
        if (!video || !shouldUseNativeVideo || !resolvedStreamUrl) return;

        let lastAdvancedAt = Date.now();
        let lastTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;

        const markAdvanced = () => {
            const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
            if (currentTime > 0) {
                lastTimeRef.current = { session: episodeSession, time: currentTime };
            }
            if (currentTime > lastTime + 0.2 || video.readyState >= HAVE_FUTURE_DATA) {
                lastTime = Math.max(lastTime, currentTime);
                lastAdvancedAt = Date.now();
            }
            if (video.readyState >= HAVE_FUTURE_DATA || video.paused || video.ended) {
                clearMediaStallTimeout();
            }
        };

        const scheduleStallRetry = () => {
            clearMediaStallTimeout();
            if (video.paused || video.ended) return;

            const stalledUrl = resolvedStreamUrl;
            mediaStallTimeoutRef.current = setTimeout(() => {
                mediaStallTimeoutRef.current = null;
                if (resolvedStreamUrl !== stalledUrl || video.paused || video.ended) return;

                const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
                const playbackStagnant = Math.abs(currentTime - lastTime) < 0.25;
                const stillWaitingForData = video.readyState < HAVE_FUTURE_DATA;
                const advancedRecently = Date.now() - lastAdvancedAt < MEDIA_STALL_TIMEOUT_MS - 1000;

                if (playbackStagnant && stillWaitingForData && !advancedRecently) {
                    onErrorRef.current?.();
                    return;
                }

                lastTime = currentTime;
                scheduleStallRetry();
            }, MEDIA_STALL_TIMEOUT_MS);
        };

        const handlePotentialStall = () => {
            lastTime = Number.isFinite(video.currentTime) ? video.currentTime : lastTime;
            scheduleStallRetry();
        };

        video.addEventListener('waiting', handlePotentialStall);
        video.addEventListener('stalled', handlePotentialStall);
        video.addEventListener('seeking', handlePotentialStall);
        video.addEventListener('playing', markAdvanced);
        video.addEventListener('canplay', markAdvanced);
        video.addEventListener('canplaythrough', markAdvanced);
        video.addEventListener('timeupdate', markAdvanced);
        video.addEventListener('seeked', markAdvanced);

        if (video.autoplay && video.readyState < HAVE_FUTURE_DATA) {
            scheduleStallRetry();
        }

        return () => {
            video.removeEventListener('waiting', handlePotentialStall);
            video.removeEventListener('stalled', handlePotentialStall);
            video.removeEventListener('seeking', handlePotentialStall);
            video.removeEventListener('playing', markAdvanced);
            video.removeEventListener('canplay', markAdvanced);
            video.removeEventListener('canplaythrough', markAdvanced);
            video.removeEventListener('timeupdate', markAdvanced);
            video.removeEventListener('seeked', markAdvanced);
            clearMediaStallTimeout();
        };
    }, [clearMediaStallTimeout, resolvedStreamUrl, shouldUseNativeVideo]);

    useEffect(() => {
        autoNextTriggerKeyRef.current = '';
    }, [episodeSession, resolvedStreamUrl]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !shouldUseNativeVideo || !resolvedStreamUrl) return;

        const isHlsStream = Boolean(isHls) || /\.m3u8/i.test(resolvedStreamUrl);
        if (!isHlsStream) {
            // Destroy any lingering HLS instance before assigning a direct src.
            // Without this, switching from AniNeko (HLS) to AnimeGG (MP4) leaves
            // hls.js attached, which intercepts video.src and prevents MP4 playback.
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
            if (video.src !== resolvedStreamUrl) {
                video.src = resolvedStreamUrl;
            }
            
            const isSameEpisode = lastTimeRef.current.session === episodeSession;
            const start = isSameEpisode && lastTimeRef.current.time > 0 
                ? lastTimeRef.current.time 
                : Number(startAtRef.current || 0);

            const applyStart = () => {
                let validStart = start;
                if (Number.isFinite(video.duration) && video.duration > 0 && validStart >= video.duration - 5) {
                    validStart = 0;
                }
                if (validStart > 0) {
                    try {
                        video.currentTime = validStart;
                    } catch (e) {
                        console.warn('Failed setting currentTime:', e);
                    }
                } else {
                    try {
                        video.currentTime = 0;
                    } catch (e) {
                        console.warn('Failed resetting currentTime to 0:', e);
                    }
                }
                video.play().catch(e => console.warn('Native video autoplay blocked:', e));
            };

            const handleStartSync = () => {
                let validStart = start;
                if (Number.isFinite(video.duration) && video.duration > 0 && validStart >= video.duration - 5) {
                    validStart = 0;
                }
                if (validStart > 0 && Math.abs(video.currentTime - validStart) > 1.5) {
                    try {
                        video.currentTime = validStart;
                    } catch (e) {
                        console.warn('Failed syncing currentTime:', e);
                    }
                }
            };

            if (video.readyState >= 1) {
                applyStart();
            } else {
                video.addEventListener('loadedmetadata', applyStart, { once: true });
            }
            video.addEventListener('canplay', handleStartSync, { once: true });
            video.addEventListener('durationchange', handleStartSync, { once: true });

            return () => {
                video.removeEventListener('loadedmetadata', applyStart);
                video.removeEventListener('canplay', handleStartSync);
                video.removeEventListener('durationchange', handleStartSync);
            };
        }

        hlsRef.current?.destroy();
        hlsRef.current = null;

        // Android WebView may report native HLS support even though proxied HLS
        // never loads metadata or media frames. Always use hls.js on native
        // mobile so playlists and segments flow through the local proxy.
        if (!isNativeMobile && !resolvedStreamUrl.startsWith('blob:') && video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = resolvedStreamUrl;
            return;
        }

        if (!Hls.isSupported()) {
            video.src = resolvedStreamUrl;
            return;
        }

        let hlsRecoveryAttempts = 0;
        const hls = new Hls({
            enableWorker: !isNativeMobile,
            lowLatencyMode: false,
            fLoader: CustomHlsLoader as any,
            pLoader: CustomHlsLoader as any,
            startLevel: 0,
            abrEwmaDefaultEstimate: 5_000_000,
            manifestLoadingTimeOut: 25_000,
            manifestLoadingMaxRetry: 4,
            levelLoadingTimeOut: 25_000,
            levelLoadingMaxRetry: 4,
            fragLoadingTimeOut: 30_000,
            fragLoadingMaxRetry: 4,
            // Set correct Referer for direct CDN streams.
            // Electron's onBeforeSendHeaders overrides Referer to allmanga.to for .m3u8/.ts URLs,
            // which breaks flixcloud.cc (ReAnime) and vivibebe.site (AniNeko direct) access.
            xhrSetup: (xhr: XMLHttpRequest, url: string) => {
                try {
                    const host = new URL(url).hostname;
                    if (host.includes('flixcloud') || host.includes('slopnet')) {
                        xhr.setRequestHeader('Referer', 'https://flixcloud.cc/');
                    } else if (host.includes('vivibebe')) {
                        xhr.setRequestHeader('Referer', 'https://anineko.to/');
                    }
                } catch { /* ignore invalid URLs */ }
            },
        });
        hlsRef.current = hls;
        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            hls.loadSource(resolvedStreamUrl);
        });
        hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
            const parsed = (data?.levels || hls.levels || []).map((lvl: any) => lvl.height).filter(Boolean);
            setHlsLevels(parsed);

            const getValidHlsStart = () => {
                const isSameEpisode = lastTimeRef.current.session === episodeSession;
                const requestedStart = isSameEpisode && lastTimeRef.current.time > 0
                    ? lastTimeRef.current.time
                    : Number(startAtRef.current || 0);
                const duration = Number(video.duration);

                // Completed episodes must restart instead of restoring a
                // timestamp that immediately fires `ended`/auto-next.
                if (Number.isFinite(duration) && duration > 0 && requestedStart >= duration - 10) {
                    lastTimeRef.current = { session: episodeSession, time: 0 };
                    return 0;
                }
                return requestedStart;
            };

            const applyStartAndPlay = () => {
                const start = getValidHlsStart();

                try {
                    video.currentTime = start;
                } catch (e) {
                    console.warn('Failed setting currentTime:', e);
                }

                video.play().catch((err) => {
                    console.warn('HLS autoplay failed or was blocked, trying muted play:', err);
                    video.muted = true;
                    video.play().catch((e) => {
                        console.warn('Muted autoplay also blocked:', e);
                    });
                });
            };

            const handleHlsStartSync = () => {
                const start = getValidHlsStart();
                if (Math.abs(video.currentTime - start) > 1.5) {
                    try {
                        video.currentTime = start;
                    } catch (e) {
                        console.warn('Failed syncing HLS currentTime:', e);
                    }
                }
            };

            if (video.readyState >= 1) {
                applyStartAndPlay();
            } else {
                video.addEventListener('loadedmetadata', applyStartAndPlay, { once: true });
            }
            video.addEventListener('canplay', handleHlsStartSync, { once: true });
            video.addEventListener('durationchange', handleHlsStartSync, { once: true });
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
                if (hlsRecoveryAttempts < 2 && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                    hlsRecoveryAttempts += 1;
                    hls.startLoad();
                    return;
                }
                if (hlsRecoveryAttempts < 2 && data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                    hlsRecoveryAttempts += 1;
                    hls.recoverMediaError();
                    return;
                }
                onErrorRef.current?.();
            }
        });

        return () => {
            hls.destroy();
            if (hlsRef.current === hls) {
                hlsRef.current = null;
            }
        };
    }, [episodeSession, isHls, resolvedStreamUrl, shouldUseNativeVideo]);

    const handleNativeEnded = useCallback((event: SyntheticEvent<HTMLVideoElement>) => {
        const video = event.currentTarget;
        if (Number.isFinite(video.duration) && video.duration > 0 && video.currentTime < video.duration - 5) {
            return;
        }

        onProgressRef.current?.({
            currentTime: video.currentTime,
            duration: video.duration,
            ended: true,
        });

        if (!autoNextEnabled || !hasNextEpisode || !onNextEpisode) return;

        const triggerKey = `${episodeSession ?? ''}::${resolvedStreamUrl ?? ''}`;
        if (autoNextTriggerKeyRef.current === triggerKey) return;
        autoNextTriggerKeyRef.current = triggerKey;

        window.setTimeout(() => {
            onNextEpisode();
        }, 650);
    }, [autoNextEnabled, episodeSession, hasNextEpisode, onNextEpisode, resolvedStreamUrl]);

    const runAutoSkipCheck = useCallback((video: HTMLVideoElement) => {
        if (!autoSkipEnabled || skipTimestamps.length === 0) return;
        if (video.paused || video.ended) return;

        const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const skipBuffer = 0.1;

        const introTarget = shouldSkipIntro(currentTime, skipTimestamps);
        if (introTarget !== null) {
            const nextTime = Math.min(duration || introTarget, introTarget + skipBuffer);
            if (Number.isFinite(nextTime) && nextTime > currentTime + 0.01) {
                video.currentTime = nextTime;
            }
            return;
        }

        const outroTarget = shouldSkipOutro(currentTime, skipTimestamps, duration);
        if (outroTarget !== null) {
            const nextTime = Math.min(duration || outroTarget, outroTarget + skipBuffer);
            if (Number.isFinite(nextTime) && nextTime > currentTime + 0.01) {
                video.currentTime = nextTime;
            }
        }
    }, [autoSkipEnabled, skipTimestamps]);

    useEffect(() => {
        clearAutoSkipPoll();
        const video = videoRef.current;
        if (!video || !shouldUseNativeVideo || !resolvedStreamUrl) return;

        const startAutoSkipPoll = () => {
            runAutoSkipCheck(video);
            if (autoSkipEnabled && skipTimestamps.length > 0 && !video.paused && !video.ended && !autoSkipPollRef.current) {
                autoSkipPollRef.current = setInterval(() => {
                    runAutoSkipCheck(video);
                }, 250);
            }
        };

        const stopAutoSkipPoll = () => {
            clearAutoSkipPoll();
        };

        video.addEventListener('loadedmetadata', startAutoSkipPoll);
        video.addEventListener('playing', startAutoSkipPoll);
        video.addEventListener('seeked', startAutoSkipPoll);
        video.addEventListener('timeupdate', startAutoSkipPoll);
        video.addEventListener('pause', stopAutoSkipPoll);
        video.addEventListener('ended', stopAutoSkipPoll);

        startAutoSkipPoll();

        return () => {
            video.removeEventListener('loadedmetadata', startAutoSkipPoll);
            video.removeEventListener('playing', startAutoSkipPoll);
            video.removeEventListener('seeked', startAutoSkipPoll);
            video.removeEventListener('timeupdate', startAutoSkipPoll);
            video.removeEventListener('pause', stopAutoSkipPoll);
            video.removeEventListener('ended', stopAutoSkipPoll);
            clearAutoSkipPoll();
        };
    }, [autoSkipEnabled, clearAutoSkipPoll, resolvedStreamUrl, runAutoSkipCheck, shouldUseNativeVideo, skipTimestamps.length, videoRef]);

    return (
        <div className={`watch-player-shell w-full max-w-full h-full max-h-full relative bg-[#0b0c0f] group transition-all duration-300 overflow-hidden rounded-none shadow-none outline-none ${displayMode === 'mini' ? 'rounded-xl shadow-2xl shadow-black/70' : (props.mobilePageLayout ? '' : 'md:rounded-2xl md:shadow-2xl md:shadow-black/80')}`}>

            {resolvedStreamUrl ? (
                <div className={`relative w-full max-w-full h-full bg-black flex items-center justify-center z-10 overflow-hidden rounded-none ${props.mobilePageLayout ? '' : 'md:rounded-2xl'}`}>
                    <div className={`w-full h-full max-w-full max-h-full flex items-center justify-center bg-black overflow-hidden rounded-none ${props.mobilePageLayout ? '' : 'md:rounded-2xl'}`}>
                        {shouldUseNativeVideo ? (
                            <>
                                <video
                                    ref={videoRef}
                                    src={isHls || /\.m3u8/i.test(resolvedStreamUrl) ? undefined : resolvedStreamUrl}
                                    className={`block w-full max-w-none bg-black cursor-pointer object-contain ${props.mobilePageLayout ? 'h-[calc(100%_-_104px)] self-start' : 'h-full min-h-full'}`}
                                    onClick={() => {
                                        if (!videoRef.current || !resolvedStreamUrl) return;
                                        if (videoRef.current.paused) videoRef.current.play().catch(() => {});
                                        else videoRef.current.pause();
                                    }}
                                    onPlay={() => onPlaybackStateChange?.({ isPlaying: true })}
                                    onPause={() => onPlaybackStateChange?.({ isPlaying: false })}
                                    playsInline
                                    autoPlay
                                    preload="auto"
                                    crossOrigin="anonymous"
                                    disableRemotePlayback={false}
                                    onLoadedMetadata={(event) => {
                                        const actualDuration = event.currentTarget.duration;
                                        const expectedDuration = Number(props.expectedDurationSeconds || 0);
                                        if (
                                            expectedDuration >= 15 * 60
                                            && Number.isFinite(actualDuration)
                                            && actualDuration > 0
                                            && (actualDuration < expectedDuration * 0.65 || actualDuration > expectedDuration * 1.6)
                                        ) {
                                            rejectedMediaUrlRef.current = resolvedStreamUrl;
                                            event.currentTarget.pause();
                                            console.warn(
                                                `[Yorumi] Rejected mismatched episode duration from ${selectedServer}: expected about ${expectedDuration}s, received ${Math.round(actualDuration)}s.`
                                            );
                                            onErrorRef.current?.();
                                        }
                                    }}
                                    onCanPlay={() => {
                                        if (rejectedMediaUrlRef.current !== resolvedStreamUrl) {
                                            onLoadRef.current?.();
                                        }
                                    }}
                                    onError={() => onErrorRef.current?.()}
                                    onTimeUpdate={(event) => {
                                        const video = event.currentTarget;
                                        lastTimeRef.current = { session: episodeSession, time: video.currentTime };
                                        onProgressRef.current?.({
                                            currentTime: video.currentTime,
                                            duration: video.duration,
                                            ended: video.ended,
                                        });
                                        runAutoSkipCheck(video);
                                    }}
                                    onEnded={handleNativeEnded}
                                >
                                    {(selectedAudio === 'dub' ? [] : subtitleTracks).map((track, index) => {
                                        const lang = String(track.lang || '').trim() || 'und';
                                        return (
                                            <track
                                                key={`${track.url}:${index}`}
                                                kind="subtitles"
                                                src={resolveSubtitleUrl(track.url)}
                                                srcLang={lang}
                                                label={lang.toUpperCase()}
                                                default={index === 0}
                                            />
                                        );
                                    })}
                                </video>
                                <CustomVideoControls
                                    streamKey={`${episodeSession ?? ''}::${resolvedStreamUrl ?? ''}`}
                                    videoRef={videoRef}
                                    initialDuration={Number(streams?.[selectedStreamIndex]?.duration || 0)}
                                    onNextEpisode={onNextEpisode}
                                    onPrevEpisode={onPrevEpisode}
                                    hasNextEpisode={hasNextEpisode}
                                    autoNextEnabled={autoNextEnabled}
                                    onAutoNextChange={onAutoNextChange}
                                    autoSkipEnabled={autoSkipEnabled}
                                    onAutoSkipChange={onAutoSkipChange}
                                    skipTimestamps={skipTimestamps}
                                    skipTimestampsLoading={skipTimestampsLoading}
                                    selectedAudio={selectedAudio}
                                    availableAudios={availableAudios}
                                    onAudioChange={onAudioChange}
                                    streams={streams}
                                    selectedStreamIndex={selectedStreamIndex}
                                    isAutoQuality={isAutoQuality}
                                    onQualityChange={onQualityChange}
                                    onSetAutoQuality={onSetAutoQuality}
                                    selectedServer={selectedServer}
                                    serverOptions={serverOptions}
                                    onServerChange={onServerChange}
                                    mode={displayMode}
                                    onMiniClose={onMiniClose}
                                    onMiniExpand={onMiniExpand}
                                    isWide={isWide}
                                    onToggleWide={onToggleWide}
                                    hlsLevels={hlsLevels}
                                    onHlsQualitySelect={handleHlsQualitySelect}
                                    animeId={props.animeId}
                                    animeTitle={props.animeTitle}
                                    animeImage={props.animeImage}
                                    episodeNumber={props.episodeNumber}
                                    episodeTitle={props.episodeTitle}
                                    hasSubtitles={selectedAudio !== 'dub' && subtitleTracks.length > 0}
                                    subtitleTracks={selectedAudio === 'dub' ? [] : subtitleTracks}
                                    pageLayout={props.mobilePageLayout}
                                />
                            </>
                        ) : (
                            <>
                                {isElectron ? (
                                    <webview
                                        ref={webviewRef as any}
                                        src={resolvedStreamUrl}
                                        partition="persist:player"
                                        className="w-full h-full border-0 bg-black"
                                        allowpopups
                                        allowFullScreen
                                        httpreferrer={streams?.[selectedStreamIndex]?.referer || (resolvedStreamUrl?.includes('allmanga') ? 'https://allmanga.to/' : '')}
                                        useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                                        webpreferences="webSecurity=no"
                                    />
                                ) : (
                                    <iframe
                                        src={resolvedStreamUrl}
                                        className="w-full h-full border-0 bg-black"
                                        allowFullScreen
                                        allow="autoplay; fullscreen; picture-in-picture"
                                        referrerPolicy="no-referrer"
                                        onLoad={() => {
                                            clearIframeLoadTimeout();
                                            notifyIframeReady();
                                        }}
                                    />
                                )}
                                {displayMode === 'mini' && (
                                    <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-2 bg-gradient-to-b from-black/55 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                        <button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onMiniExpand?.();
                                            }}
                                            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/20"
                                            title="Back to player"
                                        >
                                            <Maximize className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onMiniClose?.();
                                            }}
                                            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/20"
                                            title="Close"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Non-destructive loading overlay: keep video mounted underneath so buffering/playback is not aborted */}
                    {(isLoading || isServerSwitching) && !streamExhausted && (
                        <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px] z-30 flex items-center justify-center pointer-events-none transition-opacity duration-200">
                            <style>{`
                                @keyframes animeSubtleFloat {
                                    0%, 100% { transform: translateY(0); }
                                    50% { transform: translateY(-8px); }
                                }
                            `}</style>
                            <div className="flex flex-col items-center" style={{ animation: 'animeSubtleFloat 2s ease-in-out infinite' }}>
                                <img src={sleepingGif} alt="fetching player..." className="w-24 h-24 object-contain opacity-90" />
                                <p className="mt-3 text-white/70 text-xs font-medium tracking-wide">
                                    {isServerSwitching ? 'switching server...' : 'buffering stream...'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            ) : (!resolvedStreamUrl || isLoading || isServerSwitching) && !streamExhausted ? (
                <div className="absolute inset-0 bg-black z-20 flex items-center justify-center">
                    <style>{`
                        @keyframes animeSubtleFloat {
                            0%, 100% { transform: translateY(0); }
                            50% { transform: translateY(-8px); }
                        }
                    `}</style>
                    <div className="flex flex-col items-center" style={{ animation: 'animeSubtleFloat 2s ease-in-out infinite' }}>
                        <img src={sleepingGif} alt="fetching player..." className="w-28 h-28 object-contain opacity-90" />
                        <p className="mt-4 text-white/70 text-sm font-medium tracking-wide">fetching anime player...</p>
                    </div>
                </div>
            ) : !hasPlayableSource || streamExhausted ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20">
                    <div className="mb-4 text-white/50">
                        <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <p className="mt-4 text-gray-400 font-medium tracking-wide text-sm uppercase text-center px-6">
                        NO STREAM AVAILABLE TRY ANOTHER SERVER
                    </p>
                </div>
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                    <span className="mb-2 text-6xl opacity-20">▶</span>
                    <p>Episode not found</p>
                </div>
            )}

            {/* Header Controls — ALWAYS visible regardless of loading/stream state */}
            {displayMode !== 'mini' && !isFullscreen && (
                <div 
                    className={`watch-player-top-controls absolute top-0 left-0 right-0 p-4 sm:p-6 transition-opacity duration-300 z-[2147483647] flex items-center justify-between pointer-events-none ${showServerMenu || !resolvedStreamUrl || !shouldUseNativeVideo || isLoading || isServerSwitching ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                >
                    {/* Left: Server Menu or Offline Badge */}
                    <div className={`pointer-events-auto relative ${props.mobilePageLayout ? 'hidden' : ''}`}>
                        {isOfflineStream ? (
                            <div className="flex items-center gap-2 rounded-full watch-control-glass px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-green-400 shadow-[0_8px_28px_rgba(0,0,0,0.28)]">
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                                <span>Downloaded (Offline)</span>
                            </div>
                        ) : (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowServerMenu(!showServerMenu);
                                }}
                                className="flex items-center gap-2 rounded-full watch-control-glass px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white shadow-[0_8px_28px_rgba(0,0,0,0.28)] transition-all hover:bg-white/20 active:scale-95"
                            >
                                {isServerSwitching || (isLoading && !resolvedStreamUrl) ? (
                                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                ) : (
                                    <Globe className="h-3.5 w-3.5 text-white/90" />
                                )}
                                <span>{getServerDisplayName(selectedServer)}</span>
                            </button>
                        )}
                        
                        {!isOfflineStream && showServerMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowServerMenu(false)} />
                                <div className="absolute left-0 mt-2 w-36 rounded-xl bg-[#1A1A1A]/95 p-1.5 shadow-2xl backdrop-blur-xl flex flex-col gap-0.5 z-50">
                                    {serverOptions.map((server) => {
                                        const isSelected = selectedServer === server.key;
                                        const name = getServerDisplayName(server.key);
                                        return (
                                            <button
                                                key={server.key}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onServerChange(server.key);
                                                    onSetAutoQuality();
                                                    setShowServerMenu(false);
                                                }}
                                                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors ${isSelected ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10'}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs ${isSelected ? 'font-semibold' : 'font-medium'}`}>{name}</span>
                                                </div>
                                                {isSelected ? <CheckCircle2 className="h-3.5 w-3.5 text-white" /> : <Circle className="h-3.5 w-3.5 text-white/35" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

