import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { animeService } from '../../../services/animeService';

interface ScheduleItem {
    id: number;
    airingAt: number;
    episode: number;
    media: {
        id: number;
        idMal: number;
        title: { romaji: string; english: string | null };
        coverImage: { large: string };
        format: string;
    };
}

interface EstimatedScheduleProps {
    onAnimeClick?: (animeId: number) => void;
}

export default function EstimatedSchedule({ onAnimeClick }: EstimatedScheduleProps) {
    const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDayOffset, setSelectedDayOffset] = useState(0);
    const [showAll, setShowAll] = useState(false);

    // Get days of the week starting from today
    const getDays = () => {
        const days = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            days.push({
                name: dayNames[date.getDay()],
                date: `${monthNames[date.getMonth()]} ${date.getDate()}`,
                offset: i
            });
        }
        return days;
    };

    const days = getDays();

    useEffect(() => {
        const fetchSchedule = async () => {
            setLoading(true);
            try {
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                now.setDate(now.getDate() + selectedDayOffset);

                const startTime = Math.floor(now.getTime() / 1000);
                const endTime = startTime + 86400; // 24 hours

                const data = await animeService.getAiringSchedule(startTime, endTime);
                setSchedule(data);
            } catch (error) {
                console.error('Failed to fetch schedule:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchSchedule();
    }, [selectedDayOffset]);

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    const displayedSchedule = showAll ? schedule : schedule.slice(0, 7);
    const currentTime = new Date().toLocaleString('en-US', {
        timeZoneName: 'short',
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });

    return (
        <div className="bg-[#1a1a2e] rounded-xl p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#ff6b9d]">Estimated Schedule</h2>
                <span className="text-xs text-gray-400 bg-[#0a0a0a] px-3 py-1.5 rounded-lg">
                    {currentTime}
                </span>
            </div>

            {/* Day Tabs */}
            <div className="flex items-center gap-2 mb-6">
                <button
                    onClick={() => setSelectedDayOffset(Math.max(0, selectedDayOffset - 1))}
                    className="p-1.5 rounded-full bg-[#2a2a4a] hover:bg-[#3a3a5a] text-white transition-colors"
                    disabled={selectedDayOffset === 0}
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex gap-1 flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                    {days.map((day) => (
                        <button
                            key={day.offset}
                            onClick={() => setSelectedDayOffset(day.offset)}
                            className={`flex-1 min-w-[70px] py-2 px-3 rounded-lg text-center transition-all ${selectedDayOffset === day.offset
                                ? 'bg-[#ff6b9d] text-white'
                                : 'bg-[#2a2a4a] text-gray-400 hover:bg-[#3a3a5a]'
                                }`}
                        >
                            <div className="text-sm font-bold">{day.name}</div>
                            <div className="text-xs opacity-80">{day.date}</div>
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => setSelectedDayOffset(Math.min(6, selectedDayOffset + 1))}
                    className="p-1.5 rounded-full bg-[#2a2a4a] hover:bg-[#3a3a5a] text-white transition-colors"
                    disabled={selectedDayOffset === 6}
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Schedule List */}
            <div className="space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#ff6b9d]"></div>
                    </div>
                ) : displayedSchedule.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                        No anime scheduled for this day
                    </div>
                ) : (
                    displayedSchedule.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => onAnimeClick?.(item.media.id)}
                            className="flex items-center gap-4 py-3 border-b border-white/5 hover:bg-white/5 rounded-lg px-2 cursor-pointer transition-colors"
                        >
                            <span className="text-gray-500 text-sm font-mono w-12">
                                {formatTime(item.airingAt)}
                            </span>
                            <span className="flex-1 text-white font-medium truncate hover:text-[#ff6b9d] transition-colors">
                                {item.media.title.english || item.media.title.romaji}
                            </span>
                            <span className="text-gray-400 text-sm flex items-center gap-1">
                                <Play className="w-3 h-3" />
                                Episode {item.episode}
                            </span>
                        </div>
                    ))
                )}
            </div>

            {/* Show More */}
            {schedule.length > 7 && (
                <button
                    onClick={() => setShowAll(!showAll)}
                    className="w-full mt-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                    {showAll ? 'Show less' : 'Show more'}
                </button>
            )}
        </div>
    );
}
