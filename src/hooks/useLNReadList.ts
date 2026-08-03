import { useState, useEffect } from 'react';
import type { LNReadListItem } from '../types/ln';

const STORAGE_KEY = 'yorumi_ln_read_list_v1';

export function useLNReadList() {
    const [readList, setReadList] = useState<LNReadListItem[]>(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    });

    const toggleLNReadList = (item: Omit<LNReadListItem, 'addedAt'>) => {
        try {
            setReadList((prev) => {
                const exists = prev.some((p) => String(p.id) === String(item.id));
                let updated: LNReadListItem[];
                if (exists) {
                    updated = prev.filter((p) => String(p.id) !== String(item.id));
                } else {
                    updated = [{ ...item, addedAt: new Date().toISOString() }, ...prev];
                }
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                return updated;
            });
        } catch (e) {
            console.error('Failed to toggle LN read list item:', e);
        }
    };

    const isInLNReadList = (id: string | number) => {
        return readList.some((p) => String(p.id) === String(id));
    };

    return {
        readList,
        toggleLNReadList,
        isInLNReadList,
    };
}
