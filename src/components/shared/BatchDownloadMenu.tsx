import { useEffect, useRef } from 'react';

export type BatchDownloadMode = 'next1' | 'next5' | 'next10' | 'next25' | 'unread';

interface BatchDownloadMenuProps {
    isOpen: boolean;
    onClose: () => void;
    unit: 'chapter' | 'episode';
    onSelect: (mode: BatchDownloadMode) => void;
    /** Placement relative to the anchor container */
    placement?: 'bottom-right' | 'top-right' | 'top-center' | 'bottom-left';
    className?: string;
}

export function selectItemsForBatchDownload<T>(unreadUndownloadedAscending: T[], mode: BatchDownloadMode): T[] {
    if (unreadUndownloadedAscending.length === 0) return [];
    switch (mode) {
        case 'next1':
            return unreadUndownloadedAscending.slice(0, 1);
        case 'next5':
            return unreadUndownloadedAscending.slice(0, 5);
        case 'next10':
            return unreadUndownloadedAscending.slice(0, 10);
        case 'next25':
            return unreadUndownloadedAscending.slice(0, 25);
        case 'unread':
        default:
            return unreadUndownloadedAscending;
    }
}

export default function BatchDownloadMenu({
    isOpen,
    onClose,
    unit,
    onSelect,
    placement = 'bottom-right',
    className = '',
}: BatchDownloadMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const onPointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null;
            if (menuRef.current && target && !menuRef.current.contains(target)) {
                onClose();
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('touchstart', onPointerDown, { passive: true });
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('touchstart', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const singular = unit === 'episode' ? 'episode' : 'chapter';
    const plural = unit === 'episode' ? 'episodes' : 'chapters';
    const unreadLabel = unit === 'episode' ? 'Unwatched' : 'Unread';

    const options: Array<{ mode: BatchDownloadMode; label: string }> = [
        { mode: 'next1', label: `Next ${singular}` },
        { mode: 'next5', label: `Next 5 ${plural}` },
        { mode: 'next10', label: `Next 10 ${plural}` },
        { mode: 'next25', label: `Next 25 ${plural}` },
        { mode: 'unread', label: unreadLabel },
    ];

    const placementClasses: Record<NonNullable<BatchDownloadMenuProps['placement']>, string> = {
        'bottom-right': 'right-0 top-0',
        'bottom-left': 'left-0 top-0',
        'top-right': 'right-0 bottom-full mb-1',
        'top-center': 'left-1/2 -translate-x-1/2 bottom-full mb-1',
    };

    return (
        <div
            ref={menuRef}
            role="menu"
            aria-label={`Download ${plural}`}
            onClick={(e) => e.stopPropagation()}
            className={`absolute ${placementClasses[placement]} z-[2147483620] min-w-[205px] overflow-hidden rounded-lg bg-[#161616] py-1 ${className}`}
        >
            {options.map((opt) => (
                <button
                    key={opt.mode}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                        onClose();
                        onSelect(opt.mode);
                    }}
                    className="flex w-full items-center px-4 py-3 text-left text-[15px] font-normal text-white transition-colors hover:bg-white/10 active:bg-white/15 cursor-pointer"
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}
