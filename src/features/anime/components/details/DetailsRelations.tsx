import AnimeCard from '../AnimeCard';
import type { Anime } from '../../../../types/anime';

interface DetailsRelationsProps {
    relations: Anime['relations'];
    onAnimeClick: (id: number) => void;
}

export default function DetailsRelations({ relations, onAnimeClick }: DetailsRelationsProps) {
    // Only show anime-type relations (exclude manga, novels, music, etc.)
    const animeFormats = ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA'];
    const animeRelations = relations?.edges.filter(edge =>
        animeFormats.includes(edge.node.format)
    ) || [];

    if (animeRelations.length === 0) {
        return <div className="text-gray-500 py-4">No related anime found.</div>;
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {animeRelations.map(edge => (
                <AnimeCard
                    key={edge.node.id}
                    anime={{
                        mal_id: edge.node.id,
                        title: edge.node.title.english || edge.node.title.romaji,
                        images: { jpg: { large_image_url: edge.node.coverImage.large, image_url: edge.node.coverImage.large } },
                        score: 0,
                        type: edge.node.format, // Show MOVIE, ONA, SPECIAL, TV etc.
                        status: 'Unknown',
                        episodes: null
                    } as any}
                    onClick={() => onAnimeClick(edge.node.id)}
                />
            ))}
        </div>
    );
}
