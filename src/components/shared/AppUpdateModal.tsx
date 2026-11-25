import { useEffect, useMemo, useState } from 'react';
import { BadgeAlert, ExternalLink, Sparkles, Settings2, TrendingUp, Wrench, Trash2, Cpu, FileText } from 'lucide-react';
import { useAppUpdater } from '../../hooks/useAppUpdater';
import { isTauri } from '../../platform/runtime';

interface ChangelogSection {
    title: string;
    kind: 'features' | 'changes' | 'improvements' | 'fixes' | 'removals' | 'hood' | 'other';
    items: string[];
}

const DISMISSED_SESSION_KEY = 'yorumi_update_modal_dismissed_v1';

const classifyHeading = (rawHeading: string): ChangelogSection['kind'] => {
    const lower = rawHeading.toLowerCase();
    if (lower.includes('feature') || lower.includes('what’s new') || lower.includes("what's new") || lower.includes('added')) {
        return 'features';
    }
    if (lower.includes('improvement') || lower.includes('enhance') || lower.includes('perf')) {
        return 'improvements';
    }
    if (lower.includes('change') || lower.includes('update')) {
        return 'changes';
    }
    if (lower.includes('fix') || lower.includes('bug')) {
        return 'fixes';
    }
    if (lower.includes('remov') || lower.includes('deprecat')) {
        return 'removals';
    }
    if (lower.includes('hood') || lower.includes('internal') || lower.includes('tech') || lower.includes('chore')) {
        return 'hood';
    }
    return 'other';
};

const stripLeadingEmoji = (text: string): string =>
    text.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '').trim();

const parseReleaseNotes = (notes: string): { intro: string[]; sections: ChangelogSection[] } => {
    const lines = notes.split(/\r?\n/);
    const intro: string[] = [];
    const sections: ChangelogSection[] = [];
    let current: ChangelogSection | null = null;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
        if (headingMatch) {
            const cleanTitle = stripLeadingEmoji(headingMatch[1].trim());
            if (!cleanTitle) continue;
            current = {
                title: cleanTitle,
                kind: classifyHeading(cleanTitle),
                items: [],
            };
            sections.push(current);
            continue;
        }

        const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
        if (bulletMatch) {
            if (!current) {
                current = { title: 'Changes', kind: 'changes', items: [] };
                sections.push(current);
            }
            current.items.push(bulletMatch[1].trim());
            continue;
        }

        if (!current) {
            intro.push(line);
        } else {
            current.items.push(line);
        }
    }

    // Only keep sections that actually have items
    return {
        intro,
        sections: sections.filter((section) => section.items.length > 0),
    };
};

const renderSectionIcon = (kind: ChangelogSection['kind']) => {
    switch (kind) {
        case 'features':
            return <Sparkles className="h-4 w-4 text-amber-300 shrink-0" />;
        case 'changes':
            return <Settings2 className="h-4 w-4 text-sky-300 shrink-0" />;
        case 'improvements':
            return <TrendingUp className="h-4 w-4 text-emerald-300 shrink-0" />;
        case 'fixes':
            return <Wrench className="h-4 w-4 text-green-400 shrink-0" />;
        case 'removals':
            return <Trash2 className="h-4 w-4 text-rose-400 shrink-0" />;
        case 'hood':
            return <Cpu className="h-4 w-4 text-zinc-400 shrink-0" />;
        default:
            return <FileText className="h-4 w-4 text-zinc-300 shrink-0" />;
    }
};

const renderFormattedText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|@[A-Za-z0-9_-]+)/g);
    return parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return (
                <strong key={idx} className="font-semibold text-white">
                    {part.slice(2, -2)}
                </strong>
            );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return (
                <code key={idx} className="rounded bg-white/10 px-1 py-0.5 text-[12px] text-zinc-100">
                    {part.slice(1, -1)}
                </code>
            );
        }
        if (part.startsWith('@') && part.length > 1) {
            return (
                <span key={idx} className="font-semibold text-white">
                    {part}
                </span>
            );
        }
        return <span key={idx}>{part}</span>;
    });
};

export default function AppUpdateModal() {
    const updater = useAppUpdater();
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!updater.updateAvailable || !updater.latestVersion) return;
        try {
            const dismissed = sessionStorage.getItem(DISMISSED_SESSION_KEY);
            if (dismissed === updater.latestVersion) return;
        } catch {
            // Ignore sessionStorage errors
        }
        setIsOpen(true);
    }, [updater.updateAvailable, updater.latestVersion]);

    useEffect(() => {
        const handleOpen = () => {
            if (updater.updateAvailable) setIsOpen(true);
        };
        window.addEventListener('yorumi-open-update-modal', handleOpen);
        return () => window.removeEventListener('yorumi-open-update-modal', handleOpen);
    }, [updater.updateAvailable]);

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && updater.status !== 'downloading' && updater.status !== 'installing') {
                handleDismiss();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    });

    const parsed = useMemo(() => parseReleaseNotes(updater.releaseNotes || ''), [updater.releaseNotes]);

    const handleDismiss = () => {
        if (updater.status === 'downloading' || updater.status === 'installing') return;
        try {
            if (updater.latestVersion) {
                sessionStorage.setItem(DISMISSED_SESSION_KEY, updater.latestVersion);
            }
        } catch {
            // Ignore sessionStorage errors
        }
        setIsOpen(false);
    };

    if (!isOpen || !updater.updateAvailable) return null;

    const isBusy = updater.status === 'downloading' || updater.status === 'installing';
    const primaryLabel =
        updater.status === 'downloading'
            ? `Downloading (${updater.progress}%)`
            : updater.status === 'installing'
            ? 'Installing…'
            : isTauri()
            ? 'Download & Install'
            : 'Download';

    return (
        <div
            className="fixed inset-0 z-[2147483630] flex items-stretch justify-center bg-black/75 backdrop-blur-md md:items-center md:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="yorumi-update-title"
        >
            <div
                className="flex h-full w-full flex-col bg-[#111216] text-white md:h-auto md:max-h-[84vh] md:max-w-[520px] md:rounded-2xl md:border md:border-white/10 md:bg-[#111216]/95 md:shadow-2xl md:shadow-black/80 overflow-hidden"
                style={{
                    paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)',
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                }}
            >
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pt-6 pb-6 md:px-7 md:pt-7">
                    <BadgeAlert className="h-9 w-9 text-zinc-200 stroke-[1.75]" />

                    <h1
                        id="yorumi-update-title"
                        className="mt-4 text-[26px] md:text-[28px] font-bold tracking-tight text-white leading-tight"
                    >
                        New version available!
                    </h1>

                    <div className="mt-1.5 flex items-center gap-2 text-sm font-medium text-zinc-400">
                        <span>v{updater.latestVersion}</span>
                        <span className="text-zinc-600">·</span>
                        <span className="text-zinc-500">Current v{updater.currentVersion}</span>
                    </div>

                    {parsed.intro.length > 0 && (
                        <div className="mt-4 space-y-2 text-[14px] leading-relaxed text-zinc-300">
                            {parsed.intro.map((paragraph, idx) => (
                                <p key={idx}>{renderFormattedText(paragraph)}</p>
                            ))}
                        </div>
                    )}

                    {/* Dynamic Categorized Changelog Sections (only renders sections present in release notes) */}
                    {parsed.sections.length > 0 && (
                        <div className="mt-6 space-y-5">
                            {parsed.sections.map((section, sIdx) => (
                                <div key={`${section.title}-${sIdx}`}>
                                    <div className="mb-2.5 flex items-center gap-2">
                                        {renderSectionIcon(section.kind)}
                                        <h2 className="text-[18px] font-bold tracking-tight text-white">
                                            {section.title}
                                        </h2>
                                    </div>
                                    <ul className="space-y-2 pl-1">
                                        {section.items.map((item, iIdx) => (
                                            <li
                                                key={iIdx}
                                                className="flex items-start gap-2.5 text-[14px] leading-[1.5] text-zinc-200"
                                            >
                                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                                                <span>{renderFormattedText(item)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => void updater.openReleasePage()}
                        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    >
                        <span>Open on GitHub</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                </div>

                {/* Sticky Footer Actions (matching Mihon Download / Not now pill stack) */}
                <div className="shrink-0 border-t border-white/[0.08] bg-[#111216] px-6 py-4 md:px-7">
                    {isBusy && (
                        <div className="mb-3">
                            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-zinc-300">
                                <span>
                                    {updater.status === 'installing' ? 'Installing update…' : 'Downloading update…'}
                                </span>
                                <span className="tabular-nums">{updater.progress}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                <div
                                    className="h-full rounded-full bg-white transition-all duration-200"
                                    style={{ width: `${updater.progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {updater.error && (
                        <p className="mb-3 text-xs text-red-400">{updater.error}</p>
                    )}

                    <div className="flex flex-col gap-2.5">
                        <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void updater.installUpdate()}
                            className="h-11 w-full rounded-full bg-zinc-200 hover:bg-white active:scale-[0.99] text-sm font-bold text-[#111216] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {primaryLabel}
                        </button>
                        <button
                            type="button"
                            disabled={isBusy}
                            onClick={handleDismiss}
                            className="h-11 w-full rounded-full border border-white/20 bg-transparent hover:bg-white/[0.06] active:scale-[0.99] text-sm font-semibold text-zinc-200 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Not now
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
