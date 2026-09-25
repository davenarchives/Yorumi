import type { LocalSourceAdapter, SourceKind } from './types';

const sources = new Map<string, LocalSourceAdapter>();

export const registerLocalSource = (source: LocalSourceAdapter) => {
    if (sources.has(source.id)) {
        throw new Error(`Local source already registered: ${source.id}`);
    }
    sources.set(source.id, source);
};

export const getLocalSource = (id: string) => sources.get(id);

export const getLocalSources = (kind?: SourceKind) => (
    [...sources.values()].filter((source) => !kind || source.kind === kind)
);

