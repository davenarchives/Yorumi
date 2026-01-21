import { useState, useEffect } from 'react';
import { animeService } from '../../../services/animeService';

interface Genre {
    name: string;
    color: string;
}

interface GenresProps {
    onGenreClick?: (genre: string) => void;
}

export default function Genres({ onGenreClick }: GenresProps) {
    const [genres, setGenres] = useState<Genre[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchGenres = async () => {
            try {
                const data = await animeService.getGenres();
                setGenres(data);
            } catch (error) {
                console.error('Failed to fetch genres:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchGenres();
    }, []);

    if (loading) {
        return (
            <div className="bg-[#1a1a2e] rounded-xl p-6">
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#ff6b9d]"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#1a1a2e] rounded-xl p-6">
            {/* Header */}
            <h2 className="text-xl font-bold text-[#ff6b9d] mb-6">Genres</h2>

            {/* Genre Tags */}
            <div className="grid grid-cols-3 gap-3">
                {genres.map((genre) => (
                    <button
                        key={genre.name}
                        onClick={() => onGenreClick?.(genre.name)}
                        style={{ color: genre.color }}
                        className="text-left text-sm font-medium hover:opacity-80 transition-opacity truncate"
                    >
                        {genre.name}
                    </button>
                ))}
            </div>
        </div>
    );
}

