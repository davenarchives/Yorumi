import { useEffect, useRef, useState } from 'react';
import type { TitleLanguage } from '../../../context/TitleLanguageContext';
import { useDebounce } from '../../../hooks/useDebounce';
import { searchApi, type SearchPreviewItem } from '../api';

interface UseNavbarSearchOptions {
    activeTab: 'anime' | 'manga' | 'ln';
    language: TitleLanguage;
}

export function useNavbarSearch({ activeTab, language }: UseNavbarSearchOptions) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchPreviewItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchRequestIdRef = useRef(0);
    const searchCacheRef = useRef(new Map<string, { data: SearchPreviewItem[]; timestamp: number }>());
    const debouncedSearchQuery = useDebounce(searchQuery, 280);
    const SEARCH_CACHE_TTL_MS = 3 * 60 * 1000;

    useEffect(() => {
        const performSearch = async () => {
            const term = debouncedSearchQuery.trim();
            if (term.length < 2) {
                setSearchResults([]);
                setIsSearching(false);
                return;
            }

            const cacheKey = `${activeTab}:${language}:${term.toLowerCase()}`;
            const cached = searchCacheRef.current.get(cacheKey);
            const now = Date.now();

            if (cached && now - cached.timestamp < SEARCH_CACHE_TTL_MS) {
                setSearchResults(cached.data);
                setIsSearching(false);
                return;
            }

            const requestId = ++searchRequestIdRef.current;
            setIsSearching(true);

            try {
                const results = activeTab === 'anime'
                    ? await searchApi.getAnimePreview(term, language)
                    : activeTab === 'manga'
                    ? await searchApi.getMangaPreview(term, language)
                    : await searchApi.getLNPreview(term, language);

                if (requestId !== searchRequestIdRef.current) return;

                setSearchResults(results);
                searchCacheRef.current.set(cacheKey, {
                    data: results,
                    timestamp: Date.now(),
                });
            } catch {
                if (requestId === searchRequestIdRef.current) {
                    setSearchResults([]);
                }
            } finally {
                if (requestId === searchRequestIdRef.current) {
                    setIsSearching(false);
                }
            }
        };

        performSearch();
    }, [activeTab, debouncedSearchQuery, language]);

    return {
        searchQuery,
        setSearchQuery,
        searchResults,
        setSearchResults,
        isSearching,
    };
}
