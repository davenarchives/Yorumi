import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { isNativeMobile, isTauri } from '../../platform/runtime';

const DISCORD_INVITE_URL = 'https://discord.gg/3xzCQvfanb';

export function DiscordBrandIcon({ className = 'w-4 h-4' }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={`${className} fill-current`} aria-hidden="true">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
        </svg>
    );
}

interface DiscordInviteModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function DiscordInviteModal({ isOpen, onClose }: DiscordInviteModalProps) {
    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || typeof document === 'undefined') return null;

    const handleJoinDiscord = async () => {
        onClose();
        try {
            if (isTauri()) {
                const { openUrl } = await import('@tauri-apps/plugin-opener');
                await openUrl(DISCORD_INVITE_URL);
                return;
            }
            if (isNativeMobile()) {
                const { Browser } = await import('@capacitor/browser');
                await Browser.open({ url: DISCORD_INVITE_URL });
                return;
            }
        } catch (err) {
            console.warn('[DiscordInviteModal] Native open failed, falling back to window.open:', err);
        }
        window.open(DISCORD_INVITE_URL, '_blank', 'noopener,noreferrer');
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[2147483630] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="discord-invite-title"
                onClick={(e) => e.stopPropagation()}
                className="w-[360px] max-w-[calc(100vw-32px)] rounded-[24px] overflow-hidden bg-[#141417] shadow-2xl shadow-black/75 border border-white/[0.08]"
            >
                {/* Top Anime Night Banner */}
                <div className="relative h-52 w-full overflow-hidden bg-[#141417]">
                    <img
                        src="/discord-invite-banner.gif"
                        alt="Yorumi Discord Community"
                        className="w-full h-full object-cover object-center"
                    />
                    <div
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
                        style={{
                            background:
                                'linear-gradient(to top, #141417 0%, #141417 16%, rgba(20,20,23,0.85) 38%, rgba(20,20,23,0.35) 68%, transparent 100%)',
                        }}
                    />
                </div>

                {/* Body */}
                <div className="relative z-10 px-6 pb-6 -mt-8">
                    <h2
                        id="discord-invite-title"
                        className="text-[22px] font-extrabold tracking-tight text-white"
                    >
                        Join us on Discord
                    </h2>
                    <p className="mt-2 text-[14px] leading-relaxed text-white/70">
                        Hang out, suggest things, tell us if something&apos;s broken. Or just to support us.
                    </p>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-11 rounded-full bg-white/[0.12] hover:bg-white/[0.18] active:scale-[0.98] text-white text-sm font-bold transition-all cursor-pointer"
                        >
                            Not now
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleJoinDiscord()}
                            className="h-11 rounded-full bg-white hover:bg-white/90 active:scale-[0.98] text-neutral-950 text-sm font-bold inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                            <DiscordBrandIcon className="w-4 h-4" />
                            <span>Join Discord</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
