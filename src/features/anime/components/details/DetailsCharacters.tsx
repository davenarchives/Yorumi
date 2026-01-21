import type { Anime } from '../../../../types/anime';

interface DetailsCharactersProps {
    characters: Anime['characters'];
}

export default function DetailsCharacters({ characters }: DetailsCharactersProps) {
    if (!characters || characters.edges.length === 0) return null;

    return (
        <div className="py-6 border-t border-white/10 mt-6">
            <h3 className="text-xl font-bold text-white mb-4">Characters & Voice Actors</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {characters.edges.slice(0, 9).map((char, idx) => {
                    const va = char.voiceActors.find(v => v.languageV2 === 'Japanese') || char.voiceActors[0];
                    return (
                        <div key={idx} className="flex bg-[#1a1a1a] rounded-lg overflow-hidden border border-white/5 hover:bg-[#252525] transition-colors">
                            {/* Character */}
                            <div className="flex flex-1">
                                <img
                                    src={char.node.image.large}
                                    alt={char.node.name.full}
                                    className="w-16 h-24 object-cover"
                                />
                                <div className="p-2 flex flex-col justify-center min-w-0">
                                    <p className="text-sm font-bold text-gray-200 line-clamp-2">{char.node.name.full}</p>
                                    <p className="text-xs text-gray-500 uppercase">{char.role}</p>
                                </div>
                            </div>

                            {/* Voice Actor */}
                            {va && (
                                <div className="flex flex-1 flex-row-reverse text-right">
                                    <img
                                        src={va.image.large}
                                        alt={va.name.full}
                                        className="w-16 h-24 object-cover"
                                    />
                                    <div className="p-2 flex flex-col justify-center min-w-0">
                                        <p className="text-sm font-bold text-gray-200 line-clamp-2">{va.name.full}</p>
                                        <p className="text-xs text-gray-500 uppercase">{va.languageV2 || 'Japanese'}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
