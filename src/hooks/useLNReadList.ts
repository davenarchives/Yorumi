import { useState, useEffect } from 'react';
import type { LNReadListItem } from '../types/ln';

const STORAGE_KEY = 'yorumi_ln_read_list_v1';
const STORAGE_EVENT = 'yorumi-storage-updated';

const readLNReadList = (): LNReadListItem[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((p): p is LNReadListItem => Boolean(p && p.id)) : [];
    } catch {
        return [];
    }
};

export function useLNReadList() {
    const [readList, setReadList] = useState<LNReadListItem[]>(readLNReadList);

    useEffect(() => {
        const reload = () => setReadList(readLNReadList());
        window.addEventListener(STORAGE_EVENT, reload);
        return () => window.removeEventListener(STORAGE_EVENT, reload);
    }, []);

    const toggleLNReadList = (item: Omit<LNReadListItem, 'addedAt'>) => {
        if (!item || !item.id) return;
        try {
            setReadList((prev) => {
                const safePrev = Array.isArray(prev) ? prev.filter((p) => Boolean(p && p.id)) : [];
                const exists = safePrev.some((p) => String(p.id) === String(item.id));
                let updated: LNReadListItem[];
                if (exists) {
                    updated = safePrev.filter((p) => String(p.id) !== String(item.id));
                } else {
                    updated = [{ ...item, addedAt: new Date().toISOString() }, ...safePrev];
                }
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                window.dispatchEvent(new CustomEvent(STORAGE_EVENT));
                return updated;
            });
        } catch (e) {
            console.error('Failed to toggle LN read list item:', e);
        }
    };

    const isInLNReadList = (id: string | number) => {
        if (!id || !Array.isArray(readList)) return false;
        return readList.some((p) => Boolean(p && String(p.id) === String(id)));
    };

    return {
        readList,
        toggleLNReadList,
        isInLNReadList,
    };
}
