import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getAllCategories, getAvatarsByCategory, type AvatarCategory } from '../../utils/avatars';
import { X, Check } from 'lucide-react';

interface AvatarSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentAvatar: string | null;
    onSelectAvatar: (path: string) => void;
}

export default function AvatarSelectionModal({ isOpen, onClose, currentAvatar, onSelectAvatar }: AvatarSelectionModalProps) {
    const categories = getAllCategories();
    // Default to first category if available
    const [selectedCategory, setSelectedCategory] = useState<AvatarCategory>(categories[0] || 'DragonBall');

    // Ensure we have a valid initial selection
    useEffect(() => {
        if (categories.length > 0 && !categories.includes(selectedCategory)) {
            setSelectedCategory(categories[0]);
        }
    }, [categories, selectedCategory]);

    const avatars = getAvatarsByCategory(selectedCategory);

    if (!isOpen) return null;

    // Use Portal to render at document.body level to avoid z-index/stacking context issues with parent containers
    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-black/40 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/10 ring-1 ring-white/5 flex flex-col max-h-[80vh] m-4">
                {/* Header */}
                <div className="p-6 text-center border-b border-white/5 relative">
                    <h2 className="text-2xl font-bold text-white">Choose Avatar</h2>
                    <button
                        onClick={onClose}
                        className="absolute right-6 top-6 text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Categories */}
                <div className="p-6 pb-2">
                    <div className="flex flex-wrap justify-center gap-2">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3 py-1.5 rounded-full text-sm font-bold transition-colors ${selectedCategory === cat
                                    ? 'bg-[#d886ff] text-black'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                #{cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Avatar Grid */}
                <div className="flex-1 overflow-y-auto p-6 pt-4 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
                    <div className="flex flex-wrap justify-center gap-6">
                        {avatars.map((avatar) => {
                            const fullPath = `/avatars/${avatar.path}`;
                            const isSelected = currentAvatar === fullPath;

                            return (
                                <button
                                    key={avatar.id}
                                    onClick={() => onSelectAvatar(fullPath)}
                                    className={`relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden transition-all duration-200 group ${isSelected
                                        ? 'ring-4 ring-[#d886ff] scale-95'
                                        : 'hover:scale-105 hover:ring-2 hover:ring-white/20'
                                        }`}
                                >
                                    <img
                                        src={fullPath}
                                        alt={avatar.id}
                                        className="w-full h-full object-cover"
                                    />
                                    {isSelected && (
                                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                            <div className="bg-[#d886ff] rounded-full p-1">
                                                <Check className="w-4 h-4 text-black" />
                                            </div>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 flex justify-center">
                    <button
                        onClick={onClose}
                        className="px-8 py-2.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white font-bold rounded-lg transition-colors min-w-[120px]"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
