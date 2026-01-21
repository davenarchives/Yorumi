import AnimeCard from '../AnimeCard';
import type { Anime } from '../../../../types/anime';

interface DetailsRelationsProps {
    relations: Anime['relations'];
    onAnimeClick: (id: number) => void;
}

export default function DetailsRelations({ relations, onAnimeClick }: DetailsRelationsProps) {
    if (!relations || relations.edges.length === 0) {
        return <div className="text-gray-500 py-4">No related anime found.</div>;
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {relations.edges.map(edge => (
                <AnimeCard
                    key={edge.node.id}
                    anime={{
                        mal_id: edge.node.id,
                        title: edge.node.title.romaji,
                        images: { jpg: { large_image_url: edge.node.coverImage.large, image_url: edge.node.coverImage.large } },
                        score: 0
                    } as any}
                    onClick={() => onAnimeClick(edge.node.id)}
                />
            ))}
        </div>
    );
}
