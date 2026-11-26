import { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import DownloadStateIcon from './DownloadStateIcon';

interface DownloadActionButtonProps {
    state: 'available' | 'queued' | 'downloading' | 'downloaded';
    progress?: number;
    error?: string;
    disabled?: boolean;
    onDownload: () => void;
    onDelete: () => void;
    onCancel?: () => void;
    buttonClassName?: string;
    iconClassName?: string;
    title?: string;
    ariaLabel?: string;
}

export default function DownloadActionButton({
    state,
    progress = 0,
    error,
    disabled = false,
    onDownload,
    onDelete,
    onCancel,
    buttonClassName = 'grid h-10 w-10 place-items-center rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer touch-manipulation',
    iconClassName = 'h-6 w-6',
    title,
    ariaLabel,
}: DownloadActionButtonProps) {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const isInProgress = state === 'downloading' || state === 'queued';
    const isEffectivelyDisabled = disabled && !(isInProgress && onCancel);

    useEffect(() => {
        if (!confirmOpen) return;
        const onPointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null;
            if (containerRef.current && target && !containerRef.current.contains(target)) {
                setConfirmOpen(false);
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setConfirmOpen(false);
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('touchstart', onPointerDown, { passive: true });
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('touchstart', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [confirmOpen]);

    return (
        <div
            ref={containerRef}
            className="relative inline-flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
        >
            <button
                type="button"
                disabled={isEffectivelyDisabled}
                onClick={(e) => {
                    e.stopPropagation();
                    if (isEffectivelyDisabled) return;
                    if (state === 'downloaded') {
                        setConfirmOpen((open) => !open);
                    } else if (isInProgress && onCancel) {
                        setConfirmOpen((open) => !open);
                    } else if (state === 'available') {
                        onDownload();
                    }
                }}
                className={buttonClassName}
                title={title}
                aria-label={ariaLabel || title}
            >
                {error ? (
                    <AlertCircle className={`${iconClassName} text-red-400`} />
                ) : (
                    <DownloadStateIcon state={state} progress={progress} className={iconClassName} />
                )}
            </button>

            {confirmOpen && (state === 'downloaded' || (isInProgress && onCancel)) && (
                <div
                    role="menu"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-0 z-[120] min-w-[140px] overflow-hidden rounded-lg bg-[#161616] py-1"
                >
                    <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                            e.stopPropagation();
                            setConfirmOpen(false);
                            if (state === 'downloaded') onDelete();
                            else onCancel?.();
                        }}
                        className="flex w-full items-center px-4 py-2.5 text-left text-[15px] font-normal text-white hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer"
                    >
                        {state === 'downloaded' ? 'Delete' : 'Cancel'}
                    </button>
                </div>
            )}
        </div>
    );
}
