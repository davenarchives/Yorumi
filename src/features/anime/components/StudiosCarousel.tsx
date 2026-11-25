import React from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface StudioItem {
    name: string;
    bgColor: string;
    renderLogo: () => React.ReactNode;
}

const STUDIOS: StudioItem[] = [
    {
        name: 'MAPPA',
        bgColor: '#d9ede5',
        renderLogo: () => (
            <div className="flex items-center justify-center select-none">
                <span className="text-[28px] font-black tracking-[0.06em] text-[#0b7a4b] font-sans uppercase leading-none">
                    MAPPA
                </span>
            </div>
        ),
    },
    {
        name: 'WIT Studio',
        bgColor: '#dee8d8',
        renderLogo: () => (
            <div className="flex flex-col items-center justify-center select-none leading-none">
                <span className="text-[32px] font-black tracking-tight text-[#2b9348] italic">
                    WIT
                </span>
                <span className="text-[11px] font-extrabold tracking-[0.28em] text-[#111] mt-0.5">
                    STUDIO
                </span>
            </div>
        ),
    },
    {
        name: 'Bones',
        bgColor: '#ede3d2',
        renderLogo: () => (
            <div className="flex items-center gap-2 select-none">
                <div className="w-7 h-7 bg-[#f5c400] flex items-center justify-center rounded-[3px] shadow-xs">
                    <span className="text-[#111] font-black text-lg leading-none">&lt;</span>
                </div>
                <span className="text-[28px] font-black tracking-tight text-[#141414] lowercase leading-none">
                    bones
                </span>
            </div>
        ),
    },
    {
        name: 'Madhouse',
        bgColor: '#eae0e9',
        renderLogo: () => (
            <div className="flex flex-col items-center justify-center select-none leading-none">
                <span className="text-[26px] font-black tracking-[0.14em] text-[#111] uppercase">
                    MAD
                </span>
                <span className="text-[12px] font-black tracking-[0.34em] text-[#111] uppercase mt-0.5">
                    HOUSE
                </span>
            </div>
        ),
    },
    {
        name: 'Kyoto Animation',
        bgColor: '#eddcd1',
        renderLogo: () => (
            <div className="flex items-center gap-1.5 select-none">
                <span className="text-[#d94e34] text-xl font-black leading-none">&#10043;</span>
                <span className="text-[19px] font-bold italic text-[#d94e34] tracking-tight font-serif">
                    Kyoto Animation
                </span>
            </div>
        ),
    },
    {
        name: 'ufotable',
        bgColor: '#d9e6f0',
        renderLogo: () => (
            <div className="flex items-center justify-center select-none">
                <span className="text-[25px] font-extrabold tracking-tight text-[#1b4965] lowercase">
                    ufotable
                </span>
            </div>
        ),
    },
    {
        name: 'CloverWorks',
        bgColor: '#e4ddf0',
        renderLogo: () => (
            <div className="flex items-center gap-1.5 select-none">
                <span className="text-[#5a3e85] text-lg">&#9827;</span>
                <span className="text-[21px] font-extrabold tracking-tight text-[#2b1e42]">
                    CloverWorks
                </span>
            </div>
        ),
    },
    {
        name: 'A-1 Pictures',
        bgColor: '#dbe7f0',
        renderLogo: () => (
            <div className="flex flex-col items-center justify-center select-none leading-none">
                <span className="text-[24px] font-black tracking-tight text-[#1a365d]">
                    A-1 Pictures
                </span>
            </div>
        ),
    },
    {
        name: 'Production I.G',
        bgColor: '#ebe3d5',
        renderLogo: () => (
            <div className="flex items-center justify-center select-none">
                <span className="text-[20px] font-black tracking-wider text-[#222] uppercase">
                    Production I.G
                </span>
            </div>
        ),
    },
    {
        name: 'Toei Animation',
        bgColor: '#f0dede',
        renderLogo: () => (
            <div className="flex flex-col items-center justify-center select-none leading-none">
                <span className="text-[22px] font-black tracking-[0.12em] text-[#9b2226] uppercase">
                    TOEI
                </span>
                <span className="text-[10px] font-bold tracking-[0.25em] text-[#222] uppercase mt-1">
                    ANIMATION
                </span>
            </div>
        ),
    },
];

const StudiosCarousel: React.FC = () => {
    const navigate = useNavigate();
    const [emblaRef, emblaApi] = useEmblaCarousel({
        align: 'start',
        containScroll: 'trimSnaps',
        dragFree: true,
    });

    const scrollPrev = () => emblaApi?.scrollPrev();
    const scrollNext = () => emblaApi?.scrollNext();

    const handleStudioClick = (studioName: string) => {
        navigate(`/anime/studio/${encodeURIComponent(studioName)}`);
    };

    return (
        <section className="relative z-20 mb-10">
            <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-[20px] sm:text-[22px] font-extrabold text-white tracking-tight">
                    Studios
                </h2>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={scrollPrev}
                        aria-label="Previous studios"
                        className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border-0 outline-none focus:outline-none flex items-center justify-center text-white/85 hover:text-white transition-all cursor-pointer"
                    >
                        <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
                    </button>
                    <button
                        type="button"
                        onClick={scrollNext}
                        aria-label="Next studios"
                        className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border-0 outline-none focus:outline-none flex items-center justify-center text-white/85 hover:text-white transition-all cursor-pointer"
                    >
                        <ChevronRight className="w-4 h-4 stroke-[2.2]" />
                    </button>
                </div>
            </div>

            <div className="overflow-hidden -mx-1 px-1 py-1" ref={emblaRef}>
                <div className="flex gap-4">
                    {STUDIOS.map((studio) => (
                        <button
                            key={studio.name}
                            type="button"
                            onClick={() => handleStudioClick(studio.name)}
                            style={{ backgroundColor: studio.bgColor }}
                            className="flex-[0_0_200px] sm:flex-[0_0_220px] md:flex-[0_0_235px] h-[122px] rounded-2xl p-4 flex flex-col justify-between text-left group hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 cursor-pointer"
                        >
                            <div className="flex-1 flex items-center justify-center w-full">
                                {studio.renderLogo()}
                            </div>
                            <div className="flex items-center justify-between w-full pt-1">
                                <span className="text-[13px] font-bold text-[#141414] tracking-tight">
                                    {studio.name}
                                </span>
                                <ArrowUpRight className="w-4 h-4 text-[#141414]/75 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default StudiosCarousel;

