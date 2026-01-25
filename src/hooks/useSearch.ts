import { useState } from 'react';
import type { Anime } from '../types/anime';
import type { Manga } from '../types/manga';
import { animeService } from '../services/animeService';
import { mangaService } from '../services/mangaService';

export function useSearch(activeTab: 'anime' | 'manga', onSearchStart?: () => void, isAZList: boolean = false) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<(Anime | Manga)[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchPagination, setSearchPagination] = useState({
        last_visible_page: 1,
        current_page: 1,
        has_next_page: false
    });

    const performSearch = async (query: string, page: number, isLoadMore: boolean = false) => {
        setSearchLoading(true);
        if (!isLoadMore) setIsSearching(true);

        try {
            let newData: any;
            if (activeTab === 'anime') {
                if (isAZList) {
                    // Handle empty query as 'All' for AZ list
                    const target = query || 'All';
                    newData = await animeService.getAZList(target, page);
                } else {
                    newData = await animeService.searchAnime(query, page);
                }
            } else {
                if (isAZList) {
                    const target = query || 'All';
                    newData = await mangaService.getAZList(target, page);
                } else {
                    newData = await mangaService.searchManga(query, page);
                }
            }

            if (isLoadMore) {
                setSearchResults(prev => [...prev, ...(newData?.data || [])]);
            } else {
                setSearchResults(newData?.data || []);
            }

            if (newData?.pagination) setSearchPagination(newData.pagination);
        } catch (err) {
            console.error('Search failed:', err);
            if (!isLoadMore) setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        // Reset pagination before searching
        setSearchPagination({
            last_visible_page: 1,
            current_page: 1,
            has_next_page: false
        });

        performSearch(searchQuery, 1, false);
    };

    const loadMore = () => {
        if (!searchLoading && searchPagination.has_next_page) {
            const nextPage = searchPagination.current_page + 1;
            performSearch(searchQuery, nextPage, true);
        }
    };

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setIsSearching(false);
    };

    // Wrapper that clears search state when query becomes empty
    const handleSearchQueryChange = (query: string) => {
        // If we're starting a new search (going from no query to having one), notify to close modals
        if (query.trim() && !searchQuery.trim() && onSearchStart) {
            onSearchStart();
        }
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults([]);
            setIsSearching(false);
        }
    };

    return {
        searchQuery,
        searchResults,
        isSearching,
        searchLoading,
        setSearchQuery: handleSearchQueryChange,
        handleSearch,
        clearSearch,
        searchPagination,
        loadMore,
        executeSearch: performSearch
    };
}
