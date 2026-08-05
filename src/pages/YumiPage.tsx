import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Edit2, Eye, MessageSquare, PanelLeftClose, PanelLeftOpen, Play, Plus, Search, Send, Sparkles, Trash2, X } from 'lucide-react';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { m } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { askYumi, type YumiChatMessage } from '../services/yumiService';
import {
    cleanYumiReply,
    getIntroReply,
    resolveRecommendationCards,
    type YumiRecommendationCard,
} from '../services/yumiRecommendations';
import { db, isFirebaseEnabled } from '../services/firebase';
import type { Anime } from '../types/anime';
import { getAnimeDetailsRouteId, getAnimeWatchRouteId } from '../utils/animeNavigation';
import { cardItemVariants, pressMotion } from '../utils/motion';
import { storage } from '../utils/storage';
import { isAnimeAiring, getAiringLabel } from '../utils/animeAiring';

type RecommendationCard = YumiRecommendationCard;

const getAnimeCardItem = (card: RecommendationCard): Anime | null => {
    if (card.mediaType === 'manga') return null;
    return (card.item || null) as Anime | null;
};

type YumiConversationTurn = {
    id: string;
    user: string;
    assistant?: string;
    cards: RecommendationCard[];
};

type YumiSavedChat = {
    id: string;
    title: string;
    messages: YumiChatMessage[];
    turns: YumiConversationTurn[];
    createdAt: number;
    updatedAt: number;
};

type YumiChatListItem = {
    id: string;
    title: string;
    savedChat?: YumiSavedChat;
    isActive?: boolean;
};

const PROMPTS = [
    { label: 'Surprise me!', prompt: 'Surprise me with anime recommendations.' },
    { label: 'Trending anime', prompt: 'Recommend trending anime right now.' },
    { label: 'Top horror', prompt: 'Recommend horror anime with great atmosphere.' },
    { label: 'Hidden gems', prompt: 'Recommend hidden gem anime.' },
    { label: 'Feel-good', prompt: 'Recommend feel-good anime.' },
    { label: '90s classics', prompt: 'Recommend classic 90s anime.' },
    { label: 'Mind-benders', prompt: 'Recommend mind-bending anime.' },
    { label: 'Date night anime', prompt: 'Recommend anime that works well for date night.' },
];

const YUMI_TRANSFER_KEY = 'yorumi:yumi-transfer';

const sanitizeForFirestore = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const getChatTitle = (turns: YumiConversationTurn[]) => turns[0]?.user || 'New Yumi chat';

const getRecommendationWatchlistId = (card: RecommendationCard) => {
    const item = getAnimeCardItem(card);
    if (!item) return '';
    return String(item.id || item.mal_id || item.scraperId || card.title);
};

export default function YumiPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const inputRef = useRef<HTMLInputElement>(null);
    const [messages, setMessages] = useState<YumiChatMessage[]>([]);
    const [turns, setTurns] = useState<YumiConversationTurn[]>([]);
    const [savedChats, setSavedChats] = useState<YumiSavedChat[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [editingChatId, setEditingChatId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [sidebarPanel, setSidebarPanel] = useState<'recents' | 'search' | null>(null);
    const [chatSearch, setChatSearch] = useState('');
    const [addedWatchlistIds, setAddedWatchlistIds] = useState<Set<string>>(
        () => new Set(storage.getWatchList().map((item) => item.id))
    );

    const hasMessages = turns.length > 0;
    const recentChats = useMemo<YumiChatListItem[]>(() => {
        const chats: YumiChatListItem[] = [];
        const seen = new Set<string>();
        const addChat = (chat: YumiChatListItem) => {
            const key = chat.id;
            if (!key || seen.has(key)) return;
            seen.add(key);
            chats.push(chat);
        };

        if (turns.length > 0) {
            const savedChat = savedChats.find((chat) => chat.id === activeChatId);
            addChat({
                id: activeChatId || turns[0].id,
                title: savedChat?.title || getChatTitle(turns),
                savedChat,
                isActive: true,
            });
        }

        if (user && isFirebaseEnabled) {
            savedChats.forEach((chat) => addChat({ id: chat.id, title: chat.title, savedChat: chat }));
        }

        return chats.slice(0, 10);
    }, [activeChatId, savedChats, turns, user]);
    const filteredChats = recentChats.filter((item) =>
        item.title.toLowerCase().includes(chatSearch.trim().toLowerCase())
    );

    useEffect(() => {
        if (!user || !isFirebaseEnabled || !db) {
            setSavedChats([]);
            return;
        }

        const chatsQuery = query(
            collection(db, 'users', user.uid, 'yumiChats'),
            orderBy('updatedAt', 'desc')
        );

        const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
            setSavedChats(snapshot.docs.map((entry) => ({
                id: entry.id,
                ...(entry.data() as Omit<YumiSavedChat, 'id'>),
            })));
        });

        return () => unsubscribe();
    }, [user]);

    const persistChat = useCallback(async (
        chatId: string,
        nextMessages: YumiChatMessage[],
        nextTurns: YumiConversationTurn[]
    ) => {
        if (nextTurns.length === 0) return;

        const now = Date.now();
        const existingChat = savedChats.find((chat) => chat.id === chatId);
        const nextChat: YumiSavedChat = {
            id: chatId,
            title: existingChat?.title || getChatTitle(nextTurns),
            messages: sanitizeForFirestore(nextMessages),
            turns: sanitizeForFirestore(nextTurns),
            createdAt: existingChat?.createdAt || now,
            updatedAt: now,
        };

        setSavedChats((current) => [nextChat, ...current.filter((chat) => chat.id !== chatId)]);

        if (!user || !isFirebaseEnabled || !db) return;

        const payload: Omit<YumiSavedChat, 'id'> = {
            title: nextChat.title,
            messages: nextChat.messages,
            turns: nextChat.turns,
            createdAt: nextChat.createdAt,
            updatedAt: nextChat.updatedAt,
        };
        await setDoc(doc(db, 'users', user.uid, 'yumiChats', chatId), payload, { merge: true });
    }, [savedChats, user]);

    const persistChatSafely = useCallback(async (
        chatId: string,
        nextMessages: YumiChatMessage[],
        nextTurns: YumiConversationTurn[]
    ) => {
        try {
            await persistChat(chatId, nextMessages, nextTurns);
        } catch (error) {
            console.warn('Yumi chat could not be saved.', error);
        }
    }, [persistChat]);

    const startNewChat = useCallback(() => {
        if (activeChatId && turns.length > 0) {
            void persistChatSafely(activeChatId, messages, turns);
        }

        setMessages([]);
        setTurns([]);
        setActiveChatId(null);
        setInput('');
        inputRef.current?.focus();
    }, [activeChatId, messages, persistChatSafely, turns]);

    const loadChat = useCallback((chat: YumiSavedChat) => {
        setMessages(chat.messages || []);
        setTurns(chat.turns || []);
        setActiveChatId(chat.id);
        setInput('');
        setSidebarPanel(null);
    }, []);

    const loadChatItem = useCallback((item: YumiChatListItem) => {
        if (item.isActive || item.id === activeChatId) {
            setSidebarPanel(null);
            return;
        }

        const chat = item.savedChat;
        if (chat) loadChat(chat);
    }, [activeChatId, loadChat]);

    const deleteChat = useCallback(async (chat: YumiSavedChat) => {
        setSavedChats((current) => current.filter((item) => item.id !== chat.id));
        if (user && db) {
            await deleteDoc(doc(db, 'users', user.uid, 'yumiChats', chat.id)).catch((error) => {
                console.warn('Yumi chat could not be deleted from Firestore.', error);
            });
        }
        if (activeChatId === chat.id) {
            startNewChat();
        }
    }, [activeChatId, startNewChat, user]);

    const deleteChatItem = useCallback(async (item: YumiChatListItem) => {
        const chat = item.savedChat;
        if (!chat) return;
        await deleteChat(chat);
    }, [deleteChat]);

    const startEditingChat = useCallback((item: YumiChatListItem) => {
        setEditingChatId(item.id);
        setEditingTitle(item.title);
    }, []);

    const saveChatTitle = useCallback(async () => {
        if (!editingChatId) return;

        const title = editingTitle.trim();
        if (!title) {
            setEditingChatId(null);
            setEditingTitle('');
            return;
        }

        setSavedChats((current) => current.map((chat) => (
            chat.id === editingChatId ? { ...chat, title, updatedAt: Date.now() } : chat
        )));

        if (user && db) {
            await setDoc(doc(db, 'users', user.uid, 'yumiChats', editingChatId), { title, updatedAt: Date.now() }, { merge: true }).catch((error) => {
                console.warn('Yumi chat title could not be saved to Firestore.', error);
            });
        }

        setEditingChatId(null);
        setEditingTitle('');
    }, [editingChatId, editingTitle, user]);

    useEffect(() => {
        const rawTransfer = sessionStorage.getItem(YUMI_TRANSFER_KEY);
        if (!rawTransfer) return;

        try {
            const transfer = JSON.parse(rawTransfer) as Partial<{
                messages: YumiChatMessage[];
                turns: YumiConversationTurn[];
            }>;

            if (Array.isArray(transfer.messages)) {
                setMessages(transfer.messages);
            }
            if (Array.isArray(transfer.turns)) {
                const chatId = transfer.turns[0]?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                setTurns(transfer.turns);
                setActiveChatId(chatId);
                void persistChatSafely(chatId, Array.isArray(transfer.messages) ? transfer.messages : [], transfer.turns);
            }
        } catch {
            // Ignore stale or malformed widget handoff state.
        } finally {
            sessionStorage.removeItem(YUMI_TRANSFER_KEY);
        }
    }, [persistChatSafely]);

    const submitMessage = async (rawMessage: string, displayMessage = rawMessage) => {
        const userMessage = rawMessage.trim();
        const visibleUserMessage = displayMessage.trim();
        if (!userMessage || isLoading) return;

        const turnId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const chatId = activeChatId || turnId;
        const requestMessages: YumiChatMessage[] = [...messages, { role: 'user', content: userMessage }];
        const nextTurn: YumiConversationTurn = { id: turnId, user: visibleUserMessage || userMessage, cards: [] };
        const pendingTurns = [...turns, nextTurn];
        if (!activeChatId) setActiveChatId(chatId);
        setMessages(requestMessages);
        setTurns(pendingTurns);
        void persistChatSafely(chatId, requestMessages, pendingTurns);
        setInput('');
        setIsLoading(true);

        try {
            const fullReply = cleanYumiReply(await askYumi(requestMessages));
            const assistantReply = getIntroReply(fullReply);
            const finalMessages: YumiChatMessage[] = [...requestMessages, { role: 'assistant', content: fullReply }];
            const repliedTurns = pendingTurns.map((turn) =>
                turn.id === turnId ? { ...turn, assistant: assistantReply } : turn
            );
            setMessages(finalMessages);
            setTurns(repliedTurns);
            void persistChatSafely(chatId, finalMessages, repliedTurns);

            const cards = await resolveRecommendationCards(fullReply, 6);
            const finalTurns = repliedTurns.map((turn) =>
                turn.id === turnId ? { ...turn, cards } : turn
            );
            setTurns(finalTurns);
            await persistChatSafely(chatId, finalMessages, finalTurns);
        } catch (error) {
            const fallback = error instanceof Error ? error.message : 'Yumi could not respond right now.';
            const finalMessages: YumiChatMessage[] = [...requestMessages, { role: 'assistant', content: fallback }];
            const finalTurns = pendingTurns.map((turn) =>
                turn.id === turnId ? { ...turn, assistant: fallback, cards: [] } : turn
            );
            setMessages(finalMessages);
            setTurns(finalTurns);
            await persistChatSafely(chatId, finalMessages, finalTurns);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        void submitMessage(input);
    };

    const handleDetailsClick = (card: RecommendationCard) => {
        const item = getAnimeCardItem(card);
        if (!item) return;
        const id = getAnimeDetailsRouteId(item);
        if (id) navigate(`/anime/details/${id}`, { state: { anime: item } });
    };

    const handlePrimaryClick = (card: RecommendationCard) => {
        const item = getAnimeCardItem(card);
        if (!item) return;
        const id = getAnimeWatchRouteId(item) || getAnimeDetailsRouteId(item);
        if (id) navigate(`/anime/details/${id}?ep=1`, { state: { anime: item } });
    };

    const handleAddToLibrary = (card: RecommendationCard) => {
        const item = getAnimeCardItem(card);
        if (!item) return;
        const id = getRecommendationWatchlistId(card);
        if (!id) return;

        setAddedWatchlistIds((current) => {
            if (current.has(id)) return current;
            const next = new Set(current);
            next.add(id);
            return next;
        });

        storage.addToWatchList({
            id,
            anilistId: item.id ? String(item.id) : undefined,
            malId: item.mal_id ? String(item.mal_id) : undefined,
            scraperId: item.scraperId,
            title: card.title,
            image: card.image,
            score: card.score,
            totalCount: item.episodes || undefined,
            type: item.type,
            genres: item.genres?.map((genre) => genre.name).filter(Boolean),
            mediaStatus: item.status,
            synopsis: card.synopsis,
        }, 'plan_to_watch');
    };

    const renderChatRow = (item: YumiChatListItem) => {
        const isEditing = editingChatId === item.id;
        const isActive = item.isActive || item.id === activeChatId;
        const canManage = Boolean(item.savedChat);

        return (
            <div
                key={item.id}
                className={`group flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${isActive ? 'bg-[#132a4c] text-white ring-1 ring-yorumi-accent/25' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
            >
                <MessageSquare className="h-4 w-4 shrink-0 text-slate-500" />
                {isEditing ? (
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            void saveChatTitle();
                        }}
                        className="flex min-w-0 flex-1 items-center gap-1"
                    >
                        <input
                            value={editingTitle}
                            onChange={(event) => setEditingTitle(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                    setEditingChatId(null);
                                    setEditingTitle('');
                                }
                            }}
                            className="h-7 min-w-0 flex-1 rounded-md bg-[#07111f] px-2 text-sm text-white outline-none ring-1 ring-yorumi-accent/40 focus:ring-yorumi-accent"
                            autoFocus
                        />
                        <button type="submit" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300" aria-label={`Save ${item.title}`} title="Save">
                            <Check className="h-4 w-4" />
                        </button>
                    </form>
                ) : (
                    <button
                        onClick={() => loadChatItem(item)}
                        className="min-w-0 flex-1 truncate text-left"
                        title={item.title}
                    >
                        {item.title}
                    </button>
                )}
                {canManage && !isEditing && (
                    <div className="ml-auto hidden shrink-0 items-center gap-1 group-hover:flex">
                        <button
                            onClick={(event) => {
                                event.stopPropagation();
                                startEditingChat(item);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/10 hover:text-white"
                            aria-label={`Rename ${item.title}`}
                            title="Rename"
                        >
                            <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                            onClick={(event) => {
                                event.stopPropagation();
                                void deleteChatItem(item);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-300"
                            aria-label={`Delete ${item.title}`}
                            title="Delete"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="h-screen overflow-hidden bg-[#030913] pt-[74px] text-white">
            <div className={`grid h-[calc(100vh-74px)] grid-cols-1 overflow-hidden transition-[grid-template-columns] duration-300 ${isSidebarCollapsed ? 'md:grid-cols-[64px_1fr]' : 'md:grid-cols-[280px_1fr]'}`}>
                <aside className="sticky top-[74px] hidden h-[calc(100vh-74px)] border-r border-white/5 bg-[#07111f] md:flex md:flex-col">
                    <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-2 py-4' : 'justify-between p-4'}`}>
                        {!isSidebarCollapsed && (
                            <button
                                onClick={startNewChat}
                                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-[#10213d] text-sm font-black text-white transition-colors hover:bg-[#163158]"
                            >
                                <Plus className="h-4 w-4" />
                                New Chat
                            </button>
                        )}
                        <button
                            onClick={() => setIsSidebarCollapsed((value) => !value)}
                            className={`${isSidebarCollapsed ? 'h-10 w-10' : 'ml-3 h-10 w-10'} flex shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white`}
                            aria-label={isSidebarCollapsed ? 'Expand Yumi sidebar' : 'Collapse Yumi sidebar'}
                            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            {isSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                        </button>
                    </div>

                    {isSidebarCollapsed ? (
                        <div className="flex flex-1 flex-col items-center gap-3 px-2 py-2">
                            <button
                                onClick={startNewChat}
                                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                                title="New Chat"
                                aria-label="New Chat"
                            >
                                <Plus className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setSidebarPanel('search')}
                                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                                title="Search chats"
                                aria-label="Search chats"
                            >
                                <Search className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setSidebarPanel('recents')}
                                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                                title="Recent chats"
                                aria-label="Recent chats"
                            >
                                <MessageSquare className="h-5 w-5" />
                            </button>
                        </div>
                    ) : (
                        <div className="border-t border-white/5 px-4 py-5">
                            <p className="mb-4 text-xs font-black uppercase tracking-wide text-slate-500">Today</p>
                            <div className="space-y-2">
                                {recentChats.length === 0 ? (
                                    <p className="text-sm text-slate-500">Your Yumi chats will appear here.</p>
                                ) : recentChats.map(renderChatRow)}
                            </div>
                        </div>
                    )}
                </aside>

                <main className="relative flex h-[calc(100vh-74px)] min-h-0 flex-col overflow-hidden">
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 md:px-10">
                        {!hasMessages ? (
                            <div className="flex min-h-[calc(100vh-260px)] flex-col items-center justify-center text-center">
                                <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-yorumi-accent text-[#06101e]">
                                    <Sparkles className="h-12 w-12" />
                                </div>
                                <h1 className="text-3xl font-black">What would you like to watch?</h1>
                                <p className="mt-6 max-w-xl text-base font-semibold leading-relaxed text-slate-500">
                                    Ask Yumi for anime recommendations, hidden gems, or something that matches your mood.
                                </p>
                                <div className="mt-9 flex max-w-3xl flex-wrap justify-center gap-3">
                                    {PROMPTS.map((prompt) => (
                                        <button
                                            key={prompt.label}
                                            onClick={() => void submitMessage(prompt.prompt, prompt.label)}
                                            className="rounded-full bg-[#132744] px-5 py-3 text-sm font-bold text-slate-300 transition-colors hover:bg-[#1b375f] hover:text-white"
                                        >
                                            {prompt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="mx-auto flex max-w-4xl flex-col gap-8 pb-8">
                                {turns.map((turn) => (
                                    <div key={turn.id} className="flex flex-col gap-4">
                                        <m.div
                                            variants={cardItemVariants}
                                            initial="initial"
                                            animate="animate"
                                            className="flex justify-end pl-10 md:pl-24"
                                        >
                                            <div className="relative max-w-[min(78%,560px)] rounded-2xl rounded-br-md bg-yorumi-accent px-5 py-3 text-sm font-semibold leading-relaxed text-[#06101e] shadow-lg after:absolute after:bottom-0 after:right-[-7px] after:h-3.5 after:w-3.5 after:bg-yorumi-accent after:[clip-path:polygon(0_0,100%_100%,0_100%)]">
                                                {turn.user}
                                            </div>
                                        </m.div>
                                        {turn.assistant && (
                                            <m.div
                                                variants={cardItemVariants}
                                                initial="initial"
                                                animate="animate"
                                                className="flex items-start gap-4 pr-10 md:pr-24"
                                            >
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yorumi-accent text-[#06101e] shadow-lg">
                                                    <Sparkles className="h-5 w-5" />
                                                </div>
                                                <div className="relative min-w-0 max-w-[min(86%,680px)] rounded-2xl rounded-bl-md bg-[#132441] px-5 py-3 text-sm font-semibold leading-relaxed text-slate-100 shadow-lg before:absolute before:bottom-0 before:left-[-7px] before:h-3.5 before:w-3.5 before:bg-[#132441] before:[clip-path:polygon(100%_0,100%_100%,0_100%)]">
                                                    {turn.assistant}
                                                </div>
                                            </m.div>
                                        )}
                                        {turn.cards.map((card) => {
                                            const watchlistId = getRecommendationWatchlistId(card);
                                            const isAddedToWatchlist = Boolean(watchlistId && addedWatchlistIds.has(watchlistId));

                                            return (
                                            <m.div
                                                key={`${turn.id}-${card.title}`}
                                                variants={cardItemVariants}
                                                initial="initial"
                                                animate="animate"
                                                whileHover={{ y: -2, scale: 1.01 }}
                                                transition={{ duration: 0.18, ease: 'easeOut' }}
                                                className="pl-[52px] pr-0 md:pr-24"
                                            >
                                                <div className="group flex w-full gap-3 rounded-lg border border-white/0 bg-[#10213d] p-2 shadow-lg transition-all duration-300 ease-out hover:border-yorumi-accent/30 hover:bg-[#132946] hover:shadow-yorumi-accent/10">
                                                    <div className="h-[82px] w-[58px] shrink-0 overflow-hidden rounded-md bg-black/30">
                                                        {card.image && <img src={card.image} alt={card.title} className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105" />}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="truncate text-base font-black leading-tight text-white transition-colors duration-300 group-hover:text-yorumi-accent">{card.title}</h3>
                                                        <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-400">
                                                            {typeof card.score === 'number' && card.score > 0 && <span className="text-[#facc15]">★ {card.score.toFixed(1)}</span>}
                                                            {card.item && 'status' in card.item && isAnimeAiring((card.item as Anime).status) ? (
                                                                <span className="text-yorumi-accent font-bold">{getAiringLabel(card.item as Anime)}</span>
                                                            ) : (
                                                                card.year && <span>{card.year}</span>
                                                            )}
                                                        </div>
                                                        {card.synopsis && (
                                                            <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-relaxed text-slate-400">
                                                                {card.synopsis}
                                                            </p>
                                                        )}
                                                        <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                                                            <m.button whileTap={pressMotion} disabled={!card.item} onClick={() => handlePrimaryClick(card)} className="inline-flex items-center gap-1.5 rounded-md bg-yorumi-accent px-3 py-1.5 text-xs font-black text-[#06101e] transition-all duration-300 ease-out hover:bg-yorumi-accent/90 hover:shadow-lg hover:shadow-yorumi-accent/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none">
                                                                <Play className="h-3.5 w-3.5" />
                                                                Watch
                                                            </m.button>
                                                            <m.button whileTap={pressMotion} disabled={!card.item} onClick={() => handleDetailsClick(card)} className="inline-flex items-center gap-1.5 rounded-md bg-[#253a63] px-3 py-1.5 text-xs font-bold text-slate-300 transition-all duration-300 ease-out hover:bg-[#2d4776] hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
                                                                <Eye className="h-3.5 w-3.5" />
                                                                Details
                                                            </m.button>
                                                            <m.button
                                                                whileTap={pressMotion}
                                                                disabled={!card.item || isAddedToWatchlist}
                                                                onClick={() => handleAddToLibrary(card)}
                                                                className={`ml-auto flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-300 ease-out disabled:cursor-not-allowed ${isAddedToWatchlist ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300' : 'border-white/20 text-white hover:scale-105 hover:border-yorumi-accent/40 hover:bg-white/10 disabled:opacity-50 disabled:hover:scale-100'}`}
                                                                title={isAddedToWatchlist ? 'Added to watchlist' : 'Add to watchlist'}
                                                                aria-label={isAddedToWatchlist ? `${card.title} is in your watchlist` : `Add ${card.title} to watchlist`}
                                                            >
                                                                {isAddedToWatchlist ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                                                            </m.button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </m.div>
                                            );
                                        })}
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yorumi-accent text-[#06101e] shadow-lg">
                                            <Sparkles className="h-5 w-5" />
                                        </div>
                                        <div className="relative flex h-11 items-center gap-1.5 rounded-2xl rounded-bl-md bg-[#132441] px-5 shadow-lg before:absolute before:bottom-0 before:left-[-7px] before:h-3.5 before:w-3.5 before:bg-[#132441] before:[clip-path:polygon(100%_0,100%_100%,0_100%)]">
                                            {[0, 1, 2].map((dot) => (
                                                <span
                                                    key={dot}
                                                    className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-500"
                                                    style={{ animationDelay: `${dot * 120}ms`, animationDuration: '720ms' }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="shrink-0 border-t border-white/5 bg-[#030913]/95 px-4 py-5 backdrop-blur-xl">
                        <form onSubmit={handleSubmit} className="mx-auto flex max-w-4xl items-center gap-3 rounded-2xl bg-[#10213d] p-2">
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={(event) => setInput(event.target.value)}
                                placeholder="Ask Yumi anything about anime..."
                                className="h-12 min-w-0 flex-1 bg-transparent px-4 text-sm text-white outline-none placeholder:text-slate-500"
                                maxLength={500}
                            />
                            <button disabled={!input.trim() || isLoading} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yorumi-accent text-[#06101e] disabled:opacity-50">
                                <Send className="h-5 w-5" />
                            </button>
                        </form>
                        <p className="mt-3 text-center text-xs font-semibold text-slate-600">Yumi can make mistakes. Verify details before watching.</p>
                    </div>
                </main>
            </div>

            {sidebarPanel && (
                <div className="fixed inset-0 z-[160] hidden bg-black/45 md:block" onClick={() => setSidebarPanel(null)}>
                    <div
                        className="absolute left-[72px] top-[92px] max-h-[70vh] w-[360px] overflow-hidden rounded-2xl bg-[#0f1d34] shadow-2xl ring-1 ring-yorumi-accent/25"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {sidebarPanel === 'search' ? (
                            <>
                                <div className="flex h-20 items-center gap-3 border-b border-yorumi-accent/15 px-5">
                                    <Search className="h-5 w-5 text-yorumi-accent" />
                                    <input
                                        value={chatSearch}
                                        onChange={(event) => setChatSearch(event.target.value)}
                                        placeholder="Search chats..."
                                        className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-slate-500"
                                        autoFocus
                                    />
                                    <button onClick={() => setSidebarPanel(null)} className="text-slate-400 transition-colors hover:text-yorumi-accent">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                                <div className="max-h-[52vh] overflow-y-auto p-4">
                                    <button
                                        onClick={() => {
                                            startNewChat();
                                            setSidebarPanel(null);
                                        }}
                                        className="mb-4 flex w-full items-center gap-3 rounded-lg bg-[#162a4b] px-4 py-3 text-left font-semibold text-white transition-colors hover:bg-[#1d3762]"
                                    >
                                        <Plus className="h-5 w-5 text-yorumi-accent" />
                                        New chat
                                    </button>
                                    <p className="mb-3 px-2 text-sm font-black uppercase tracking-wide text-slate-500">Today</p>
                                    {(chatSearch ? filteredChats : recentChats).map(renderChatRow)}
                                </div>
                            </>
                        ) : (
                            <div className="p-5">
                                <p className="mb-4 font-black text-white">Recents</p>
                                <div className="space-y-1">
                                {recentChats.length === 0 ? (
                                    <p className="text-sm text-slate-400">No recent Yumi chats yet.</p>
                                ) : recentChats.map(renderChatRow)}
                            </div>
                        </div>
                    )}
                    </div>
                </div>
            )}
        </div>
    );
}
