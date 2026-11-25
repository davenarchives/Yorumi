import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import Hls from 'hls.js';
import { Maximize, X } from 'lucide-react';
import type { StreamLink, SubtitleTrack } from '../../../types/stream';
import type { Episode } from '../../../types/anime';
import { API_ORIGIN } from '../../../config/api';
import CustomVideoControls from './CustomVideoControls';
import type { StreamServerKey } from '../../../hooks/useStreams';
import { shouldSkipIntro, shouldSkipOutro, type SkipTimestamp } from '../../../services/skipTimestamps';
import sleepingGif from '../../../assets/sleeping.gif';
import discordRPCService from '../../../services/discordRPCService';
import { getRuntimePlatform } from '../../../platform/runtime';
import { fetchSubtitleText, normalizeSubtitleTracks, resolveSubtitleFetchUrl } from '../../../utils/subtitles';

const IFRAME_LOAD_TIMEOUT_MS = 18_000;
const NATIVE_LOAD_TIMEOUT_MS = 25_000;
const MEDIA_STALL_TIMEOUT_MS = 25_000;
const PLAYBACK_START_WATCHDOG_MS = 30_000;
const HAVE_FUTURE_DATA = 3;
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
        if (typeof context?.url === 'string' && context.url.startsWith('yorumi-media://')) {
            context.url = context.url.replace(/^yorumi-media:\/\//i, 'http://yorumi-media.localhost/');
        }
        if (typeof context?.url === 'string' && (
            context.url.startsWith('blob:')
            || context.url.includes('/api/scraper/local-file')
            || /^http:\/\/(?:127\.0\.0\.1|localhost):18765\/file\?/i.test(context.url)
        )) {
            const targetUrl = context.url.startsWith('/api/') ? `${API_ORIGIN}${context.url}` : context.url;
            const startTime = performance.now();
            const headers = new Headers();
            const hasValidByteRange = Number.isFinite(context.rangeStart) && Number.isFinite(context.rangeEnd) && (context.rangeEnd > (context.rangeStart ?? 0));
            if (!targetUrl.startsWith('blob:') && hasValidByteRange) {
                headers.set('Range', `bytes=${context.rangeStart}-${context.rangeEnd - 1}`);
            }
            fetch(targetUrl, { headers })
                .then(async (res) => {
                    if (!res.ok) {
                        throw new Error(`Failed to fetch media: ${res.status}`);
                    }
                    const now = performance.now();
                    const createStats = (len: number) => ({
                        loading: { start: startTime, first: now, end: now },
                        parsing: { start: now, end: now },
                        buffering: { start: now, first: now, end: now },
                        loaded: len,
                        total: len,
                        chunkCount: 1,
                        bwEstimate: (len * 8000) / Math.max(1, (now - startTime)),
                        retry: 0,
                        aborted: false,
                    });

                    if (context.responseType === 'arraybuffer') {
                        let data: ArrayBuffer;
                        if (targetUrl.startsWith('blob:')) {
                            const blob = await res.blob();
                            const slice = hasValidByteRange ? blob.slice(context.rangeStart, context.rangeEnd) : blob;
                            data = await slice.arrayBuffer();
                        } else {
                            data = await res.arrayBuffer();
                            if (res.status !== 206 && hasValidByteRange) {
                                data = data.slice(context.rangeStart, context.rangeEnd);
                            }
                        }
                        const stats = createStats(data.byteLength);
                        callbacks.onSuccess(
                            {
                                url: context.url,
                                data,
                                code: res.status,
                            },
                            stats,
                            context,
                            null
                        );
                    } else {
                        const data = await res.text();
                        const stats = createStats(data.length);
                        callbacks.onSuccess(
                            {
                                url: context.url,
                                data,
                                code: res.status,
                            },
                            stats,
                            context,
                            null
                        );
                    }
                })
                .catch((err) => {
                    const now = performance.now();
                    const stats = {
                        loading: { start: startTime, first: now, end: now },
                        parsing: { start: now, end: now },
                        buffering: { start: now, first: now, end: now },
                        loaded: 0,
                        total: 0,
                        chunkCount: 0,
                        bwEstimate: 0,
                        retry: 0,
                        aborted: false,
                    };
                    callbacks.onError(
                        { code: 404, text: err?.message || 'Media fetch failed' },
                        context,
                        null,
                        stats
                    );
                });
            return;
        }
        super.load(context, config, callbacks);
    }
}

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
    onClose?: () => void;
    onShowEpisodes?: () => void;
    seasonNumber?: number;
    episodes?: Episode[];
    onEpisodeSelect?: (episode: Episode) => void;
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
    const hlsRef = useRef<Hls | null>(null);
    const iframeLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const iframeReadyNotifiedRef = useRef(false);
    const nativeLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mediaStallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autoSkipPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const autoNextTriggerKeyRef = useRef('');
    const rejectedMediaUrlRef = useRef('');
    const lastTimeRef = useRef<{ session?: string; time: number }>({ time: 0 });
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
    const resolvedStreamUrl = useMemo(() => {
        if (!streamUrl) return streamUrl;
        let url = streamUrl;
        if (typeof url === 'string' && url.startsWith('yorumi-media://')) {
            url = url.replace(/^yorumi-media:\/\//i, 'http://yorumi-media.localhost/');
        }
        if (!streamUrl.includes('/api/scraper/embed') && /^https?:\/\/([^/]+\.)?kwik\./i.test(streamUrl)) {
            url = `${API_ORIGIN}/api/scraper/embed?url=${encodeURIComponent(streamUrl)}`;
        } else if (url.startsWith('/api/')) {
            url = `${API_ORIGIN}${url}`;
        }
        return url;
    }, [streamUrl]);

    const resolveSubtitleUrl = useCallback((url: string) => {
        return resolveSubtitleFetchUrl(url);
    }, []);

    const [detectedSubtitleLanguages, setDetectedSubtitleLanguages] = useState<Record<string, string>>({});
    const normalizedSubtitleCandidates = useMemo(
        () => normalizeSubtitleTracks(props.subtitles),
        [props.subtitles]
    );
    const subtitleTrackSignature = useMemo(() => normalizedSubtitleCandidates
        .map((track) => `${track.url}|${track.lang}`)
        .join('::'), [normalizedSubtitleCandidates]);

    useEffect(() => {
        // Only auto-detect language for tracks with missing/generic labels so we never
        // overwrite an explicit label (e.g. English track containing Japanese OP/ED lyrics).
        const unknownTracks = normalizedSubtitleCandidates.filter((track) => {
            const label = String(track.lang || '').trim().toLowerCase();
            return !label || label === 'unknown' || label === 'und' || label === 'default' || label === 'auto';
        });
        if (unknownTracks.length === 0) {
            setDetectedSubtitleLanguages({});
            return;
        }
        const controller = new AbortController();
        let active = true;

        Promise.all(unknownTracks.map(async (track) => {
            const url = String(track?.url || '').trim();
            if (!url) return null;
            try {
                const text = await fetchSubtitleText(resolveSubtitleUrl(url), controller.signal);
                if (!text) return null;
                const language = detectSubtitleLanguage(text.slice(0, 262144), url);
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
    }, [normalizedSubtitleCandidates, subtitleTrackSignature, resolveSubtitleUrl]);

    const subtitleTracks = useMemo(() => {
        const enriched = normalizedSubtitleCandidates.map((track) => {
            const url = String(track?.url || '').trim();
            const detected = detectedSubtitleLanguages[url];
            return {
                ...track,
                url: resolveSubtitleUrl(url),
                lang: detected || track.lang,
            };
        });
        return normalizeSubtitleTracks(enriched);
    }, [detectedSubtitleLanguages, normalizedSubtitleCandidates, resolveSubtitleUrl]);

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

        // Chromium/Electron and some Android WebViews can claim native HLS
        // support but then fail to parse an m3u8 as direct media. Prefer hls.js
        // whenever MediaSource is available; Safari remains on native HLS via
        // the unsupported fallback below.
        if (!Hls.isSupported()) {
            video.src = resolvedStreamUrl;
            return;
        }

        let hlsRecoveryAttempts = 0;
        const hls = new Hls({
            enableWorker: !isNativeMobile,
            lowLatencyMode: false,
            loader: CustomHlsLoader as any,
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
                console.warn('[HLS] Fatal error', { type: data.type, details: data.details, url: (data as { url?: string }).url, response: (data as { response?: unknown }).response });
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
        <div className={`watch-player-shell w-full max-w-full h-full max-h-full relative bg-black group transition-all duration-300 overflow-hidden rounded-none shadow-none outline-none ${displayMode === 'mini' ? 'rounded-xl shadow-2xl shadow-black/70' : (props.mobilePageLayout ? '' : 'md:rounded-2xl')}`}>

            {(resolvedStreamUrl || (props.mobilePageLayout && (isLoading || isServerSwitching) && !streamExhausted)) ? (
                <div className={`yorumi-player-surface relative z-10 flex h-full w-full max-w-full items-center justify-center overflow-hidden bg-black rounded-none ${props.mobilePageLayout ? '' : 'md:rounded-2xl'}`}>
                    <div className={`yorumi-player-surface flex h-full w-full max-h-full max-w-full items-center justify-center overflow-hidden bg-black rounded-none ${props.mobilePageLayout ? '' : 'md:rounded-2xl'}`}>
                        {(shouldUseNativeVideo || !resolvedStreamUrl) ? (
                            <>
                                <video
                                    ref={videoRef}
                                    src={!resolvedStreamUrl || isHls || /\.m3u8/i.test(resolvedStreamUrl) ? undefined : resolvedStreamUrl}
                                    className={`yorumi-player-video block w-full max-w-none bg-black cursor-pointer object-contain ${'h-full min-h-full'}`}
                                    style={{ clipPath: 'inset(0 0 3px 0)' }}
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
                                            resolvedStreamUrl
                                            && !isOfflineStream
                                            && expectedDuration >= 15 * 60
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
                                />
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
                                    onClose={props.onClose}
                                    onShowEpisodes={props.onShowEpisodes}
                                    seasonNumber={props.seasonNumber}
                                    episodes={props.episodes}
                                    onEpisodeSelect={props.onEpisodeSelect}
                                />
                            </>
                        ) : (
                            <>
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
                        <div className="absolute inset-0 bg-black/75 z-30 flex items-center justify-center pointer-events-none transition-opacity duration-200">
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

        </div>
    );
}

