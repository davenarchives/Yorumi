import { useState } from 'react';
import { Library, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { probeOnlineStatus } from '../../hooks/useOnlineStatus';

interface OfflineEmptyStateProps {
    title?: string;
    description?: string;
}

/** Sleepy Yorumi Moon Cat — curled up on a crescent moon with disconnected Wi-Fi */
function SleepyMoonCatIllustration() {
    return (
        <svg viewBox="0 0 220 185" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-48 h-40 sm:w-56 sm:h-48 select-none" aria-hidden="true">
            {/* Soft ground shadow */}
            <ellipse cx="110" cy="166" rx="58" ry="7" fill="white" fillOpacity="0.06" />
            <ellipse cx="110" cy="166" rx="34" ry="4" fill="white" fillOpacity="0.08" />

            {/* Subtle stars */}
            <circle cx="42" cy="54" r="2" fill="#A78BFA" fillOpacity="0.7" />
            <circle cx="176" cy="48" r="2.5" fill="#38BDF8" fillOpacity="0.7" />
            <path d="M184 82L186 87L191 89L186 91L184 96L182 91L177 89L182 87L184 82Z" fill="#A78BFA" fillOpacity="0.55" />

            {/* Disconnected Wi-Fi waves above cat */}
            <g stroke="#38BDF8" strokeWidth="2.6" strokeLinecap="round" opacity="0.85">
                <path d="M90 36C101 26 119 26 130 36" />
                <path d="M97 44C104 37.5 116 37.5 123 44" />
                <circle cx="110" cy="52" r="2.4" fill="#38BDF8" stroke="none" />
                <path d="M94 28L126 54" stroke="#F43F5E" strokeWidth="2.6" />
            </g>

            {/* Crescent Moon */}
            <path
                d="M150 116C141 140 115 153 89 147C63 141 47 117 51 91C54 73 66 59 81 53C70 67 68 88 78 104C90 124 116 131 137 121C142 119 146 117 150 116Z"
                fill="#1E1B3A"
                stroke="#E4E4E7"
                strokeWidth="2.8"
                strokeLinejoin="round"
            />

            {/* Sleeping Cat curled inside the moon */}
            <g stroke="#F4F4F5" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                {/* Cat body */}
                <path d="M79 114C78 96 91 84 109 84C126 84 139 95 139 112C139 124 128 131 112 131C93 131 79 125 79 114Z" fill="#13141C" />
                {/* Cat head */}
                <path d="M84 96L82 77L95 85C99 83.5 104 83.5 108 85L120 77L118 96" fill="#13141C" />
                {/* Closed sleepy eyes */}
                <path d="M92 98C94 101 97 101 99 98" strokeWidth="2.4" />
                <path d="M107 98C109 101 112 101 114 98" strokeWidth="2.4" />
                {/* Tiny sleepy mouth */}
                <path d="M101 104C102.5 105.5 104 105.5 105.5 104" strokeWidth="2.2" />
                {/* Blush cheeks */}
                <circle cx="88" cy="102" r="2.2" fill="#A78BFA" fillOpacity="0.45" stroke="none" />
                <circle cx="118" cy="102" r="2.2" fill="#A78BFA" fillOpacity="0.45" stroke="none" />
                {/* Curled tail */}
                <path d="M138 112C150 110 156 101 151 94" />
            </g>

            {/* Floating Zzz */}
            <text x="136" y="74" fill="#A78BFA" fontSize="13" fontWeight="800" fontFamily="sans-serif" opacity="0.9">z</text>
            <text x="148" y="63" fill="#A78BFA" fontSize="16" fontWeight="800" fontFamily="sans-serif" opacity="0.7">Z</text>
            <text x="162" y="51" fill="#38BDF8" fontSize="11" fontWeight="800" fontFamily="sans-serif" opacity="0.55">z</text>
        </svg>
    );
}

export default function OfflineEmptyState({
    title = 'No signal out here!',
    description = 'Your connection drifted off to sleep. Check your internet or open Library to enjoy your downloads.',
}: OfflineEmptyStateProps) {
    const navigate = useNavigate();
    const [checking, setChecking] = useState(false);

    const handleRetry = async () => {
        if (checking) return;
        setChecking(true);
        try {
            await probeOnlineStatus();
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-4rem)] w-full flex flex-col items-center justify-center px-6 text-center select-none">
            <div className="mb-3 animate-float">
                <SleepyMoonCatIllustration />
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {title}
            </h1>

            <p className="mt-2.5 max-w-sm text-sm text-white/60 leading-relaxed">
                {description}
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <button
                    type="button"
                    onClick={() => navigate('/library')}
                    className="inline-flex items-center gap-2 rounded-full bg-yorumi-accent hover:bg-yorumi-accent/90 active:scale-95 px-5 py-2.5 text-sm font-bold text-white transition-all cursor-pointer"
                >
                    <Library className="w-4 h-4" />
                    <span>Open Library</span>
                </button>

                <button
                    type="button"
                    onClick={handleRetry}
                    disabled={checking}
                    className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 active:scale-95 px-4 py-2.5 text-sm font-semibold text-white/90 transition-all cursor-pointer disabled:opacity-60"
                >
                    <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                    <span>{checking ? 'Checking…' : 'Retry'}</span>
                </button>
            </div>
        </div>
    );
}
