import { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { m } from 'framer-motion';
import { pressMotion } from '../../utils/motion';

interface ScrollToTopProps {
    /** Scroll threshold in pixels before showing the button */
    threshold?: number;
    /** Custom className for additional styling */
    className?: string;
    /** Active tab to determine theme color */
    activeTab?: 'anime' | 'manga' | 'ln';
    /** Optional controlled visibility */
    isVisible?: boolean;
}

export default function ScrollToTop({ threshold = 400, className = '', activeTab = 'anime', isVisible }: ScrollToTopProps) {
    const [internalIsVisible, setInternalIsVisible] = useState(false);
    const resolvedIsVisible = isVisible ?? internalIsVisible;

    useEffect(() => {
        if (typeof isVisible === 'boolean') return;

        const toggleVisibility = () => {
            if (window.scrollY > threshold) {
                setInternalIsVisible(true);
            } else {
                setInternalIsVisible(false);
            }
        };

        window.addEventListener('scroll', toggleVisibility, { passive: true });

        // Check initial scroll position
        toggleVisibility();

        return () => {
            window.removeEventListener('scroll', toggleVisibility);
        };
    }, [threshold, isVisible]);

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    const bgColor = activeTab === 'ln' ? 'bg-amber-400 text-black' : activeTab === 'manga' ? 'bg-yorumi-manga text-black' : 'bg-yorumi-accent text-black';
    const hoverColor = activeTab === 'ln' ? 'hover:bg-amber-300' : activeTab === 'manga' ? 'hover:bg-yorumi-manga/90' : 'hover:bg-yorumi-accent/90';

    return (
        <m.button
            onClick={scrollToTop}
            aria-label="Scroll to top"
            whileTap={pressMotion}
            className={`
                fixed bottom-6 right-6 z-50
                w-12 h-12 rounded-full
                ${bgColor}
                shadow-lg
                flex items-center justify-center
                transition-all duration-300 ease-out
                hover:scale-110 ${hoverColor}
                active:scale-95
                ${resolvedIsVisible
                    ? 'opacity-100 translate-y-0 pointer-events-auto'
                    : 'opacity-0 translate-y-4 pointer-events-none'
                }
                ${className}
            `}
        >
            <ChevronUp className="w-6 h-6" strokeWidth={2.5} />
        </m.button>
    );
}
