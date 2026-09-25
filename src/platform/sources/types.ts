export type SourceKind = 'anime' | 'manga' | 'novel';

export type SourceSearchResult = {
    id: string;
    title: string;
    image?: string;
    url?: string;
};

export interface LocalSourceAdapter<TDetails = unknown, TChapter = unknown> {
    readonly id: string;
    readonly kind: SourceKind;
    readonly name: string;
    search(query: string, page?: number): Promise<SourceSearchResult[]>;
    getDetails(id: string): Promise<TDetails>;
    getContent(id: string): Promise<TChapter>;
}

