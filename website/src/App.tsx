import { useState, useEffect } from 'react';
import { 
  Sun,
  Moon,
  ArrowRight,
  ExternalLink,
  Star,
  AlertTriangle,
  Download,
  Sparkles,
  Copy,
  Check,
  Terminal,
  Laptop,
  Globe
} from 'lucide-react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { DocumentationGuide, type DocTabId } from './Documentation';

function AppleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 1.01-2.87-.96.04-2.12.64-2.8 1.44-.59.68-1.11 1.76-1.07 2.81 1.07.08 2.24-.63 2.86-1.38z" />
    </svg>
  );
}

function WindowsIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.551H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.849" />
    </svg>
  );
}

function LinuxIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} role="img" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <title>Linux</title>
      <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 00-.205.334 1.18 1.18 0 00-.09.4v.019c.002.089.008.179.02.267-.193-.067-.438-.135-.607-.202a1.635 1.635 0 01-.018-.2v-.02a1.772 1.772 0 01.15-.768c.082-.22.232-.406.43-.533a.985.985 0 01.594-.2zm-2.962.059h.036c.142 0 .27.048.399.135.146.129.264.288.344.465.09.199.14.4.153.667v.004c.007.134.006.2-.002.266v.08c-.03.007-.056.018-.083.024-.152.055-.274.135-.393.2.012-.09.013-.18.003-.267v-.015c-.012-.133-.04-.2-.082-.333a.613.613 0 00-.166-.267.248.248 0 00-.183-.064h-.021c-.071.006-.13.04-.186.132a.552.552 0 00-.12.27.944.944 0 00-.023.33v.015c.012.135.037.2.08.334.046.134.098.2.166.268.01.009.02.018.034.024-.07.057-.117.07-.176.136a.304.304 0 01-.131.068 2.62 2.62 0 01-.275-.402 1.772 1.772 0 01-.155-.667 1.759 1.759 0 01.08-.668 1.43 1.43 0 01.283-.535c.128-.133.26-.2.418-.2zm1.37 1.706c.332 0 .733.065 1.216.399.293.2.523.269 1.052.468h.003c.255.136.405.266.478.399v-.131a.571.571 0 01.016.47c-.123.31-.516.643-1.063.842v.002c-.268.135-.501.333-.775.465-.276.135-.588.292-1.012.267a1.139 1.139 0 01-.448-.067 3.566 3.566 0 01-.322-.198c-.195-.135-.363-.332-.612-.465v-.005h-.005c-.4-.246-.616-.512-.686-.71-.07-.268-.005-.47.193-.6.224-.135.38-.271.483-.336.104-.074.143-.102.176-.131h.002v-.003c.169-.202.436-.47.839-.601.139-.036.294-.065.466-.065zm2.8 2.142c.358 1.417 1.196 3.475 1.735 4.473.286.534.855 1.659 1.102 3.024.156-.005.33.018.513.064.646-1.671-.546-3.467-1.089-3.966-.22-.2-.232-.335-.123-.335.59.534 1.365 1.572 1.646 2.757.13.535.16 1.104.021 1.67.067.028.135.06.205.067 1.032.534 1.413.938 1.23 1.537v-.043c-.06-.003-.12 0-.18 0h-.016c.151-.467-.182-.825-1.065-1.224-.915-.4-1.646-.336-1.77.465-.008.043-.013.066-.018.135-.068.023-.139.053-.209.064-.43.268-.662.669-.793 1.187-.13.533-.17 1.156-.205 1.869v.003c-.02.334-.17.838-.319 1.35-1.5 1.072-3.58 1.538-5.348.334a2.645 2.645 0 00-.402-.533 1.45 1.45 0 00-.275-.333c.182 0 .338-.03.465-.067a.615.615 0 00.314-.334c.108-.267 0-.697-.345-1.163-.345-.467-.931-.995-1.788-1.521-.63-.4-.986-.87-1.15-1.396-.165-.534-.143-1.085-.015-1.645.245-1.07.873-2.11 1.274-2.763.107-.065.037.135-.408.974-.396.751-1.14 2.497-.122 3.854a8.123 8.123 0 01.647-2.876c.564-1.278 1.743-3.504 1.836-5.268.048.036.217.135.289.202.218.133.38.333.59.465.21.201.477.335.876.335.039.003.075.006.11.006.412 0 .73-.134.997-.268.29-.134.52-.334.74-.4h.005c.467-.135.835-.402 1.044-.7zm2.185 8.958c.037.6.343 1.245.882 1.377.588.134 1.434-.333 1.791-.765l.211-.01c.315-.007.577.01.847.268l.003.003c.208.199.305.53.391.876.085.4.154.78.409 1.066.486.527.645.906.636 1.14l.003-.007v.018l-.003-.012c-.015.262-.185.396-.498.595-.63.401-1.746.712-2.457 1.57-.618.737-1.37 1.14-2.036 1.191-.664.053-1.237-.2-1.574-.898l-.005-.003c-.21-.4-.12-1.025.056-1.69.176-.668.428-1.344.463-1.897.037-.714.076-1.335.195-1.814.12-.465.308-.797.641-.984l.045-.022zm-10.814.049h.01c.053 0 .105.005.157.014.376.055.706.333 1.023.752l.91 1.664.003.003c.243.533.754 1.064 1.189 1.637.434.598.77 1.131.729 1.57v.006c-.057.744-.48 1.148-1.125 1.294-.645.135-1.52.002-2.395-.464-.968-.536-2.118-.469-2.857-.602-.369-.066-.61-.2-.723-.4-.11-.2-.113-.602.123-1.23v-.004l.002-.003c.117-.334.03-.752-.027-1.118-.055-.401-.083-.71.043-.94.16-.334.396-.4.69-.533.294-.135.64-.202.915-.47h.002v-.002c.256-.268.445-.601.668-.838.19-.201.38-.336.663-.336zm7.159-9.074c-.435.201-.945.535-1.488.535-.542 0-.97-.267-1.28-.466-.154-.134-.28-.268-.373-.335-.164-.134-.144-.333-.074-.333.109.016.129.134.199.2.096.066.215.2.36.333.292.2.68.467 1.167.467.485 0 1.053-.267 1.398-.466.195-.135.445-.334.648-.467.156-.136.149-.267.279-.267.128.016.034.134-.147.332a8.097 8.097 0 01-.69.468zm-1.082-1.583V5.64c-.006-.02.013-.042.029-.05.074-.043.18-.027.26.004.063 0 .16.067.15.135-.006.049-.085.066-.135.066-.055 0-.092-.043-.141-.068-.052-.018-.146-.008-.163-.065zm-.551 0c-.02.058-.113.049-.166.066-.047.025-.086.068-.14.068-.05 0-.13-.02-.136-.068-.01-.066.088-.133.15-.133.08-.031.184-.047.259-.005.019.009.036.03.03.05v.02h.003z" />
    </svg>
  );
}

const SLIDES = [
  { id: 1, image: '/browse-animes.png', label: 'Browse Animes', description: 'Browse thousands of anime titles.' },
  { id: 2, image: '/browse-mangas.png', label: 'Browse Mangas', description: 'Access a comprehensive library of manga and manhwa.' },
  { id: 3, image: '/lighnovel.png', label: 'Read Light Novels', description: 'Explore top 100 collections and trending light novels.' },
  { id: 4, image: '/search-anime.png', label: 'Search Media', description: 'Find your favorite titles instantly with powerful search tools.' },
  { id: 5, image: '/anime-details.png', label: 'Anime Details', description: 'View detailed stats, episode lists, and metadata.' },
  { id: 6, image: '/manga-details.png', label: 'Manga Details', description: 'Access chapter lists, artwork, and story information.' },
  { id: 7, image: '/watch-anime.png', label: 'Watch Anime in One Click', description: 'Stream anime directly within the application.' },
  { id: 8, image: '/read-manga.png', label: 'Read Manga in One Click', description: 'Read manga chapters directly within the application.' },
  { id: 9, image: '/read-lightnovel.png', label: 'Read Light Novels in One Click', description: 'Read light novel chapters with custom typography and reader settings.' },
];

function AppPreviews() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % SLIDES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [currentIndex]);

  const handleNext = () => setCurrentIndex((prev) => (prev + 1) % SLIDES.length);
  const handlePrev = () => setCurrentIndex((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);

  return (
    <div className="relative w-full max-w-[1000px] flex flex-col items-center mx-auto">
      {/* Description text above */}
      <div className="flex flex-col items-center justify-end w-full z-50 mb-10 min-h-[40px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 15, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -15, filter: "blur(4px)" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            <p className="text-yorumi-text font-display font-bold text-2xl md:text-3xl tracking-tight text-center">
              {SLIDES[currentIndex].description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Stacked Cards Container */}
      <div className="relative w-full max-w-[800px] aspect-video mb-16 mt-8 group mx-auto">
        {SLIDES.map((slide, index) => {
          let relativeIndex = index - currentIndex;
          if (relativeIndex < 0) relativeIndex += SLIDES.length;

          let state = 'hidden';
          if (relativeIndex === 0) state = 'active';
          else if (relativeIndex === 1) state = 'next1';
          else if (relativeIndex === 2) state = 'next2';
          else if (relativeIndex === SLIDES.length - 1) state = 'prev1';
          else if (relativeIndex === SLIDES.length - 2) state = 'prev2';

          // Pseudo-random offsets based on slide ID for an asymmetrical, dynamic flow
          const yOffset = (slide.id * 23) % 60 - 30; // -30 to +30 px
          const scaleOffset = ((slide.id * 11) % 6) / 100; // 0.0 to 0.05
          const xOffset = (slide.id * 17) % 6 - 3; // -3% to +3%

          const variants = {
            active: { x: '0%', y: 0, scale: 1.15, zIndex: 30, opacity: 1 },
            next1: { x: `${68 + xOffset}%`, y: 35 + yOffset, scale: 0.85 + scaleOffset, zIndex: 20, opacity: 0.65 },
            next2: { x: '110%', y: 80, scale: 0.7, zIndex: 10, opacity: 0 },
            prev1: { x: `${-68 + xOffset}%`, y: -25 - yOffset, scale: 0.88 + scaleOffset, zIndex: 20, opacity: 0.65 },
            prev2: { x: '-110%', y: -50, scale: 0.7, zIndex: 10, opacity: 0 },
            hidden: { x: '0%', y: 0, scale: 0.65, zIndex: 0, opacity: 0 }
          };

          return (
            <motion.div
              key={slide.id}
              variants={variants}
              animate={state}
              initial="hidden"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              drag={state === 'active' ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, { offset }) => {
                if (offset.x < -50) handleNext();
                if (offset.x > 50) handlePrev();
              }}
              onClick={() => {
                if (state === 'next1') handleNext();
                if (state === 'prev1') handlePrev();
              }}
              className="absolute inset-0 w-full h-full rounded-3xl overflow-hidden cursor-grab active:cursor-grabbing"
            >
              <motion.div 
                animate={{ opacity: state === 'active' ? 0 : 0.6 }}
                className="absolute inset-0 bg-[#000000] z-20 pointer-events-none transition-opacity duration-300"
              />
              <img src={slide.image} alt={slide.label} className="w-full h-full object-contain bg-yorumi-bg relative z-10 pointer-events-none" />
            </motion.div>
          );
        })}
      </div>

      {/* Indicators */}
      <div className="flex gap-2.5 mt-2 z-50">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`h-2 rounded-full transition-all duration-500 ease-out ${
              idx === currentIndex ? 'bg-yorumi-main w-6' : 'w-2 bg-yorumi-text/20 hover:bg-yorumi-text/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'get-started' | 'docs'>('home');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [starCount, setStarCount] = useState<string>('...');
  const [activeDocTab, setActiveDocTab] = useState<DocTabId>('intro');
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const { scrollY } = useScroll();
  const yImage = useTransform(scrollY, [0, 500], [0, -50]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(id);
    setTimeout(() => {
      setCopiedCommand((prev) => (prev === id ? null : prev));
    }, 2000);
  };

  const navigateTo = (page: 'home' | 'get-started' | 'docs', docTab?: DocTabId) => {
    setCurrentPage(page);
    if (docTab) {
      setActiveDocTab(docTab);
    }
    window.location.hash = page === 'home' ? '' : `#${page}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenDoc = (tab: DocTabId) => {
    navigateTo('docs', tab);
  };

  const scrollToAnchor = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    setIsDarkMode(true);
    document.documentElement.classList.add('dark');

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);

    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#get-started') {
        setCurrentPage('get-started');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (hash === '#docs' || hash.startsWith('#docs-')) {
        setCurrentPage('docs');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (hash === '' || hash === '#home') {
        setCurrentPage('home');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    fetch('https://api.github.com/repos/davenarchives/Yorumi')
      .then(res => res.json())
      .then(data => {
        if (data.stargazers_count !== undefined) {
          setStarCount(data.stargazers_count.toString());
        }
      })
      .catch(console.error);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (next) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      return next;
    });
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 80, damping: 20 } }
  };

  return (
    <div className="min-h-screen font-sans selection:bg-yorumi-main selection:text-white transition-colors duration-500 bg-yorumi-bg text-yorumi-text overflow-x-hidden relative z-0">
      
      {/* Light Mode Blue Gradient Overlay */}
      <div className={`fixed inset-0 pointer-events-none -z-10 transition-opacity duration-700 ${isDarkMode ? 'opacity-0' : 'opacity-100'} bg-gradient-to-br from-blue-300/30 via-transparent to-blue-200/20`} />

      {/* Sticky Premium Navigation */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-12 py-4 transition-all duration-300 ${isScrolled ? 'bg-yorumi-bg/80 backdrop-blur-xl' : 'bg-transparent'}`}
      >
        <div onClick={() => navigateTo('home')} className="flex items-center gap-3 group cursor-pointer">
          <img src="/yorumi-app-icon.png" alt="Yorumi" className="w-8 h-8 group-hover:scale-110 group-active:scale-95 transition-transform duration-300 rounded-md" />
          <span className="text-lg font-display font-bold tracking-wide text-yorumi-text">Yorumi</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-6 font-semibold text-sm tracking-wide text-yorumi-muted">

            <a href="https://github.com/davenarchives/Yorumi" target="_blank" rel="noreferrer" className="hover:text-yorumi-text transition-colors flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
                <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02A9.58 9.58 0 0 1 12 6.84c.85 0 1.71.12 2.5.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5A10 10 0 0 0 22 12 10 10 0 0 0 12 2z"></path>
              </svg>
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                {starCount}
              </span>
            </a>
            <a href="https://ko-fi.com/yorumii" target="_blank" rel="noreferrer" className="hover:text-yorumi-text transition-all hover:scale-110 active:scale-95" aria-label="Ko-fi">
              <svg role="img" viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.351 2.715c-2.7 0-4.986.025-6.83.26C2.078 3.285 0 5.154 0 8.61c0 3.506.182 6.13 1.585 8.493 1.584 2.701 4.233 4.182 7.662 4.182h.83c4.209 0 6.494-2.234 7.637-4a9.5 9.5 0 0 0 1.091-2.338C21.792 14.688 24 12.22 24 9.208v-.415c0-3.247-2.13-5.507-5.792-5.87-1.558-.156-2.65-.208-6.857-.208m0 1.947c4.208 0 5.09.052 6.571.182 2.624.311 4.13 1.584 4.13 4v.39c0 2.156-1.792 3.844-3.87 3.844h-.935l-.156.649c-.208 1.013-.597 1.818-1.039 2.546-.909 1.428-2.545 3.064-5.922 3.064h-.805c-2.571 0-4.831-.883-6.078-3.195-1.09-2-1.298-4.155-1.298-7.506 0-2.181.857-3.402 3.012-3.714 1.533-.233 3.559-.26 6.39-.26m6.547 2.287c-.416 0-.65.234-.65.546v2.935c0 .311.234.545.65.545 1.324 0 2.051-.754 2.051-2s-.727-2.026-2.052-2.026m-10.39.182c-1.818 0-3.013 1.48-3.013 3.142 0 1.533.858 2.857 1.949 3.897.727.701 1.87 1.429 2.649 1.896a1.47 1.47 0 0 0 1.507 0c.78-.467 1.922-1.195 2.623-1.896 1.117-1.039 1.974-2.364 1.974-3.897 0-1.662-1.247-3.142-3.039-3.142-1.065 0-1.792.545-2.338 1.298-.493-.753-1.246-1.298-2.312-1.298"/>
              </svg>
            </a>
            <a href="https://discord.gg/3xzCQvfanb" target="_blank" rel="noreferrer" className="hover:text-yorumi-text transition-all hover:scale-110 active:scale-95" aria-label="Discord">
              <svg role="img" viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
              </svg>
            </a>
          </div>
          
          <button 
            onClick={toggleDarkMode}
            className="relative flex items-center justify-center w-8 h-8 text-yorumi-muted hover:text-yorumi-main hover:scale-110 active:scale-95 transition-all duration-300"
            aria-label="Toggle Dark Mode"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={isDarkMode ? 'dark' : 'light'}
                initial={{ y: -20, opacity: 0, rotate: -90 }}
                animate={{ y: 0, opacity: 1, rotate: 0 }}
                exit={{ y: 20, opacity: 0, rotate: 90 }}
                transition={{ duration: 0.2 }}
                className="absolute"
              >
                {isDarkMode ? <Sun className="w-5 h-5 text-yorumi-text" /> : <Moon className="w-5 h-5 text-yorumi-text" />}
              </motion.div>
            </AnimatePresence>
          </button>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <main className={`flex flex-col items-center ${currentPage === 'home' ? 'pt-40' : 'pt-24'} pb-32 px-6 md:px-12 lg:px-24`}>
        {currentPage === 'home' && (
          <>
            <div className="w-full max-w-[1400px] grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
              
              {/* Left Column (Text & Buttons) */}
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="flex flex-col justify-center h-full z-10 py-1 lg:pl-12 xl:pl-20"
              >
                <div className="flex flex-col gap-5">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <motion.h1 variants={itemVariants} className="text-5xl lg:text-6xl font-display font-bold leading-none tracking-tight text-yorumi-text">
                      Yorumi
                    </motion.h1>
                    <motion.a
                      variants={itemVariants}
                      href="https://github.com/davenarchives/Yorumi/releases"
                      target="_blank"
                      rel="noreferrer"
                      className="text-yorumi-main font-semibold text-sm tracking-wide hover:opacity-80 transition-opacity"
                    >
                      v4.1.0
                    </motion.a>
                  </div>
                  
                  <motion.p variants={itemVariants} className="text-lg md:text-xl font-medium text-yorumi-muted max-w-lg leading-relaxed">
                    A modern, open-source platform for streaming anime, reading manga, and reading light novels. Built with performance and user experience in mind.
                  </motion.p>
                </div>
                
                <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => navigateTo('get-started')}
                    className="group flex items-center justify-center gap-2.5 bg-yorumi-main hover:bg-yorumi-main/90 text-white px-6 py-2.5 rounded-full font-semibold text-sm md:text-base tracking-wide transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  >
                    <span>Download</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
              
              <button 
                type="button"
                onClick={() => handleOpenDoc('intro')}
                className="group flex items-center justify-center gap-2 text-yorumi-text hover:text-yorumi-main px-4 py-2.5 font-medium text-sm md:text-base transition-colors"
              >
                <span>Development docs</span>
                <ExternalLink className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
              </button>
            </motion.div>
          </motion.div>

          {/* Right Column (Image/Slider) */}
          <motion.div 
            style={{ y: yImage }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 50, damping: 20, delay: 0.4 }}
            className="relative w-full h-full flex items-center justify-center lg:justify-end"
          >
            <div className="w-full max-w-[500px] transform hover:-translate-y-2 transition-all duration-700 ease-out z-10">
              <img src="/yorumi-mascot.png" alt="Yorumi Mascot" className="w-full h-auto object-contain pointer-events-none" />
            </div>
          </motion.div>
        </div>
        </>
        )}

        {/* Start Using Section (Antigravity 3-Platform Format with Direct Downloads & CLI) */}
        {currentPage === 'get-started' && (
        <div id="start-using" className="w-full max-w-[1400px] space-y-16">
          
          {/* Main Download Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2"
          >
            <div className="space-y-3 max-w-3xl">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight text-yorumi-text">
                Download Yorumi
              </h2>
              <p className="text-base md:text-lg text-yorumi-muted font-normal">
                Cross-platform desktop application and standalone terminal CLI for macOS, Windows, and Linux.
              </p>
            </div>

            <a
              href="https://github.com/davenarchives/Yorumi/releases"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-yorumi-card hover:bg-yorumi-card/80 text-yorumi-text text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shrink-0 self-start md:self-auto"
            >
              <span>View previous releases</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
          </motion.div>

          {/* Quick Anchor Filter Pills */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 pb-2">
            <button
              type="button"
              onClick={() => scrollToAnchor('yorumi-desktop')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yorumi-main/20 hover:bg-yorumi-main/30 text-yorumi-main font-semibold text-sm transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Yorumi Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => scrollToAnchor('yorumi-cli')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yorumi-card hover:bg-yorumi-card/80 text-yorumi-text font-semibold text-sm transition-all"
            >
              <Terminal className="w-4 h-4 opacity-70" />
              <span>Yorumi CLI</span>
            </button>
            <button
              type="button"
              onClick={() => scrollToAnchor('web-selfhost')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yorumi-card hover:bg-yorumi-card/80 text-yorumi-text font-semibold text-sm transition-all"
            >
              <Globe className="w-4 h-4 opacity-70" />
              <span>Web & Self-Host</span>
            </button>
            <button
              type="button"
              onClick={() => scrollToAnchor('documentation')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yorumi-card hover:bg-yorumi-card/80 text-yorumi-text font-semibold text-sm transition-all"
            >
              <Laptop className="w-4 h-4 opacity-70" />
              <span>Documentation</span>
            </button>
          </div>

          {/* SECTION 1: Yorumi Desktop (Antigravity 3-Platform Format) */}
          <div id="yorumi-desktop" className="space-y-8 scroll-mt-28">
            <div className="flex items-center gap-3">
              <h3 className="text-2xl md:text-3xl font-display font-bold text-yorumi-text">Yorumi Desktop</h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-yorumi-main/15 text-yorumi-main">
                v4.1.0
              </span>
            </div>

            {/* 3 Platforms Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* macOS Platform */}
              <div className="bg-yorumi-card rounded-3xl p-6 md:p-8 flex flex-col justify-between space-y-6 transition-all duration-300 group h-full">
                <div className="space-y-5">
                  <div className="flex items-center gap-3 text-yorumi-text">
                    <AppleIcon className="w-6 h-6 fill-current" />
                    <h4 className="text-xl font-bold font-display">macOS</h4>
                  </div>

                  <div className="space-y-3 pt-2">
                    <a
                      href="https://github.com/davenarchives/Yorumi/releases/latest/download/Yorumi.dmg"
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-yorumi-text text-yorumi-bg font-semibold text-sm transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download for Apple Silicon (.dmg)</span>
                    </a>

                    <a
                      href="https://github.com/davenarchives/Yorumi/releases/latest/download/Yorumi.dmg"
                      className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-yorumi-text/5 hover:bg-yorumi-text/10 text-yorumi-text font-semibold text-sm transition-all"
                    >
                      <Download className="w-4 h-4 text-yorumi-muted" />
                      <span>Download for Intel (.dmg)</span>
                    </a>

                    <a
                      href="https://github.com/davenarchives/Yorumi/releases/latest/download/Yorumi.zip"
                      className="w-full flex items-center justify-center gap-2 px-5 py-2 rounded-full hover:bg-yorumi-text/5 text-yorumi-muted hover:text-yorumi-text text-xs font-medium transition-all"
                    >
                      <span>Download Portable (.zip)</span>
                    </a>
                  </div>
                </div>

                <div className="pt-4 mt-auto border-t border-yorumi-text/5 space-y-1 min-h-[58px] flex flex-col justify-start">
                  <div className="text-xs font-semibold text-yorumi-text">Minimum Requirements</div>
                  <div className="text-xs text-yorumi-muted leading-relaxed">macOS 10.15+ (Catalina) • Apple Silicon or Intel 64-bit</div>
                </div>
              </div>

              {/* Windows Platform */}
              <div className="bg-yorumi-card rounded-3xl p-6 md:p-8 flex flex-col justify-between space-y-6 transition-all duration-300 group h-full">
                <div className="space-y-5">
                  <div className="flex items-center gap-3 text-yorumi-text">
                    <WindowsIcon className="w-6 h-6 fill-current" />
                    <h4 className="text-xl font-bold font-display">Windows</h4>
                  </div>

                  <div className="space-y-3 pt-2">
                    <a
                      href="https://github.com/davenarchives/Yorumi/releases/latest/download/Yorumi.exe"
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-yorumi-text text-yorumi-bg font-semibold text-sm transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Installer (.exe)</span>
                    </a>

                    <a
                      href="https://github.com/davenarchives/Yorumi/releases/latest/download/Yorumi.zip"
                      className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-yorumi-text/5 hover:bg-yorumi-text/10 text-yorumi-text font-semibold text-sm transition-all"
                    >
                      <Download className="w-4 h-4 text-yorumi-muted" />
                      <span>Download Portable (.zip)</span>
                    </a>

                    <a
                      href="https://github.com/davenarchives/Yorumi/releases/latest"
                      target="_blank"
                      rel="noreferrer"
                      className="w-full flex items-center justify-center gap-2 px-5 py-2 rounded-full hover:bg-yorumi-text/5 text-yorumi-muted hover:text-yorumi-text text-xs font-medium transition-all"
                    >
                      <span>View Windows Release Assets</span>
                    </a>
                  </div>
                </div>

                <div className="pt-4 mt-auto border-t border-yorumi-text/5 space-y-1 min-h-[58px] flex flex-col justify-start">
                  <div className="text-xs font-semibold text-yorumi-text">Minimum Requirements</div>
                  <div className="text-xs text-yorumi-muted leading-relaxed">Windows 10 / 11 (64-bit or ARM64) • DirectX 11+</div>
                </div>
              </div>

              {/* Linux Platform */}
              <div className="bg-yorumi-card rounded-3xl p-6 md:p-8 flex flex-col justify-between space-y-6 transition-all duration-300 group h-full">
                <div className="space-y-5">
                  <div className="flex items-center gap-3 text-yorumi-text">
                    <LinuxIcon className="w-6 h-6 fill-current" />
                    <h4 className="text-xl font-bold font-display">Linux</h4>
                  </div>

                  <div className="space-y-3 pt-2">
                    <a
                      href="https://github.com/davenarchives/Yorumi/releases/latest/download/Yorumi.AppImage"
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-yorumi-text text-yorumi-bg font-semibold text-sm transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download for x64 (.AppImage)</span>
                    </a>

                    <a
                      href="https://github.com/davenarchives/Yorumi/releases/latest/download/Yorumi.zip"
                      className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-yorumi-text/5 hover:bg-yorumi-text/10 text-yorumi-text font-semibold text-sm transition-all"
                    >
                      <Download className="w-4 h-4 text-yorumi-muted" />
                      <span>Download Portable (.zip)</span>
                    </a>

                    <a
                      href="https://github.com/davenarchives/Yorumi/releases/latest"
                      target="_blank"
                      rel="noreferrer"
                      className="w-full flex items-center justify-center gap-2 px-5 py-2 rounded-full hover:bg-yorumi-text/5 text-yorumi-muted hover:text-yorumi-text text-xs font-medium transition-all"
                    >
                      <span>View Linux Release Assets</span>
                    </a>
                  </div>
                </div>

                <div className="pt-4 mt-auto border-t border-yorumi-text/5 space-y-1 min-h-[58px] flex flex-col justify-start">
                  <div className="text-xs font-semibold text-yorumi-text">Minimum Requirements</div>
                  <div className="text-xs text-yorumi-muted leading-relaxed">glibc 2.28+ • Ubuntu 20.04+, Fedora 34+, Arch Linux</div>
                </div>
              </div>

            </div>

            {/* What's New In Release Card */}
            <div className="bg-yorumi-card rounded-3xl p-6 md:p-8 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm font-semibold text-yorumi-text">What&apos;s new in version 4.1.0?</div>
                <a
                  href="https://github.com/davenarchives/Yorumi/releases"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-yorumi-main hover:underline"
                >
                  <span>Full Changelog on GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-sm font-bold text-yorumi-main">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>High-Throughput TMDB Architecture, Multi-Season Sync & Discord RPC Bundling</span>
                </div>
                <ul className="list-disc list-inside text-sm text-yorumi-muted space-y-2 pl-1 leading-relaxed">
                  <li>
                    <span className="font-semibold text-yorumi-text">tmdb core catalog & rate-limit shield:</span> Discovery feeds and catalog browsing are powered by TMDB with zero AniList 429 rate limit exceptions.
                  </li>
                  <li>
                    <span className="font-semibold text-yorumi-text">multi-season & hero sync:</span> Switching season chips dynamically updates hero art, poster thumbnails, synopsis, and 16:9 episode preview cards.
                  </li>
                  <li>
                    <span className="font-semibold text-yorumi-text">standalone discord rich presence:</span> Self-contained `discord-rpc` binary packaging across Windows, macOS, and Linux desktop distributions.
                  </li>
                  <li>
                    <span className="font-semibold text-yorumi-text">optimized scraper pipeline:</span> Sub-second video stream resolution and multi-tier caching for seamless playback.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* SECTION 2: Yorumi CLI (Antigravity Terminal Format) */}
          <div id="yorumi-cli" className="space-y-8 pt-4 scroll-mt-28">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl md:text-3xl font-display font-bold text-yorumi-text">Yorumi CLI</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-yorumi-main/15 text-yorumi-main">
                  v2.2.0
                </span>
              </div>
              <p className="text-base text-yorumi-muted max-w-2xl">
                Work with Yorumi directly in your codebase and terminal. Build, stream, download, and enjoy anime from your terminal. Describe what you need, and Yorumi CLI handles the rest.
              </p>
            </div>

            {/* Terminal Command Blocks */}
            <div className="space-y-5">
              
              {/* macOS | Linux */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-yorumi-text">
                  <AppleIcon className="w-4 h-4 fill-current" />
                  <span>macOS</span>
                  <span className="text-yorumi-muted font-normal">|</span>
                  <LinuxIcon className="w-4 h-4 fill-current" />
                  <span>Linux</span>
                </div>
                <div className="bg-slate-100/90 dark:bg-black/40 border border-slate-300/80 dark:border-white/5 rounded-2xl p-3.5 md:p-4 flex items-center justify-between gap-4 font-mono text-xs md:text-sm">
                  <span className="overflow-x-auto whitespace-nowrap scrollbar-none select-all text-black dark:text-slate-200 font-semibold md:font-medium tracking-tight">
                    curl -fsSL https://raw.githubusercontent.com/davenarchives/yorumi-cli/main/install.sh | bash
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('curl -fsSL https://raw.githubusercontent.com/davenarchives/yorumi-cli/main/install.sh | bash', 'cli-unix')}
                    className="p-2 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-black dark:text-slate-200 border border-slate-300 dark:border-white/5 shadow-xs dark:shadow-none transition-all shrink-0 flex items-center gap-1.5 text-xs font-sans font-semibold cursor-pointer"
                    aria-label="Copy Command"
                  >
                    {copiedCommand === 'cli-unix' ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400 hidden sm:inline font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-black dark:text-slate-200" />
                        <span className="hidden sm:inline">Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Windows PowerShell */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-yorumi-text">
                  <WindowsIcon className="w-4 h-4 fill-current" />
                  <span>Windows PowerShell</span>
                </div>
                <div className="bg-slate-100/90 dark:bg-black/40 border border-slate-300/80 dark:border-white/5 rounded-2xl p-3.5 md:p-4 flex items-center justify-between gap-4 font-mono text-xs md:text-sm">
                  <span className="overflow-x-auto whitespace-nowrap scrollbar-none select-all text-black dark:text-slate-200 font-semibold md:font-medium tracking-tight">
                    iwr -useb https://raw.githubusercontent.com/davenarchives/yorumi-cli/main/install.ps1 | iex
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('iwr -useb https://raw.githubusercontent.com/davenarchives/yorumi-cli/main/install.ps1 | iex', 'cli-win-ps')}
                    className="p-2 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-black dark:text-slate-200 border border-slate-300 dark:border-white/5 shadow-xs dark:shadow-none transition-all shrink-0 flex items-center gap-1.5 text-xs font-sans font-semibold cursor-pointer"
                    aria-label="Copy Command"
                  >
                    {copiedCommand === 'cli-win-ps' ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400 hidden sm:inline font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-black dark:text-slate-200" />
                        <span className="hidden sm:inline">Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Windows Scoop / npx */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-yorumi-text">
                  <Terminal className="w-4 h-4" />
                  <span>Scoop Package Manager & npx Direct</span>
                </div>
                <div className="bg-slate-100/90 dark:bg-black/40 border border-slate-300/80 dark:border-white/5 rounded-2xl p-3.5 md:p-4 flex items-center justify-between gap-4 font-mono text-xs md:text-sm">
                  <span className="overflow-x-auto whitespace-nowrap scrollbar-none select-all text-black dark:text-slate-200 font-semibold md:font-medium tracking-tight">
                    scoop bucket add yorumi https://github.com/davenarchives/yorumi-cli && scoop install yorumi-cli
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('scoop bucket add yorumi https://github.com/davenarchives/yorumi-cli && scoop install yorumi-cli', 'cli-scoop')}
                    className="p-2 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-black dark:text-slate-200 border border-slate-300 dark:border-white/5 shadow-xs dark:shadow-none transition-all shrink-0 flex items-center gap-1.5 text-xs font-sans font-semibold cursor-pointer"
                    aria-label="Copy Command"
                  >
                    {copiedCommand === 'cli-scoop' ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400 hidden sm:inline font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-black dark:text-slate-200" />
                        <span className="hidden sm:inline">Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>

            {/* CLI Quick Action Badges */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a
                href="https://yorumi-cli.vercel.app/index.html"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-yorumi-main/20 hover:bg-yorumi-main/30 text-yorumi-main font-semibold text-sm transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Yorumi CLI Portal</span>
              </a>
              <a
                href="https://github.com/davenarchives/yorumi-cli"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-yorumi-card hover:bg-yorumi-card/80 text-yorumi-text font-semibold text-sm transition-all"
              >
                <ExternalLink className="w-4 h-4 opacity-70" />
                <span>GitHub Repository</span>
              </a>
            </div>
          </div>

          {/* SECTION 3: Web & Self-Hosting */}
          <div id="web-selfhost" className="space-y-6 pt-4 scroll-mt-28">
            <h3 className="text-2xl md:text-3xl font-display font-bold text-yorumi-text">Web & Self-Host</h3>
            
            <div className="bg-yorumi-card rounded-2xl p-4 flex items-start gap-3 text-sm text-yorumi-muted">
              <AlertTriangle className="w-5 h-5 text-yorumi-main shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-yorumi-text">Note:</span> Due to real-time scraping from publicly available sources, for best performance run the backend with Upstash or local Redis caching enabled.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                type="button"
                onClick={() => handleOpenDoc('setup')}
                className="bg-yorumi-card hover:bg-yorumi-card/80 p-6 md:p-8 rounded-3xl transition-all flex flex-col justify-between group text-left"
              >
                <div>
                  <h4 className="text-lg font-bold text-yorumi-text mb-2 group-hover:text-yorumi-main transition-colors">Web deployment tutorial</h4>
                  <p className="text-yorumi-muted text-sm leading-relaxed">
                    Learn how to deploy Yorumi as a modern web app (Client + Server) or self-host your own scraper backend.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-yorumi-main">
                  <span>Read Tutorial</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>

              <a
                href="https://github.com/davenarchives/Yorumi"
                target="_blank"
                rel="noreferrer"
                className="bg-yorumi-card hover:bg-yorumi-card/80 p-6 md:p-8 rounded-3xl transition-all flex flex-col justify-between group"
              >
                <div>
                  <h4 className="text-lg font-bold text-yorumi-text mb-2 group-hover:text-yorumi-main transition-colors">Use instances directly</h4>
                  <p className="text-yorumi-muted text-sm leading-relaxed">
                    You can visit the live Yorumi repository and web instance to start watching anime and reading manga immediately.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-yorumi-main">
                  <span>Visit Instance</span>
                  <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </a>
            </div>
          </div>

          {/* SECTION 4: Documentation */}
          <div id="documentation" className="space-y-6 pt-4 scroll-mt-28">
            <h3 className="text-2xl md:text-3xl font-display font-bold text-yorumi-text">Documentation</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button
                type="button"
                onClick={() => handleOpenDoc('intro')}
                className="bg-yorumi-card hover:bg-yorumi-card/80 p-6 rounded-3xl transition-all flex flex-col justify-between group text-left"
              >
                <div>
                  <h4 className="text-lg font-bold text-yorumi-text mb-2 group-hover:text-yorumi-main transition-colors">User Usage Documents</h4>
                  <p className="text-yorumi-muted text-sm leading-relaxed">
                    Can help you get started with Yorumi quickly, including web mode and standalone CLI setup.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-yorumi-main">
                  <span>View Guide</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleOpenDoc('scraper')}
                className="bg-yorumi-card hover:bg-yorumi-card/80 p-6 rounded-3xl transition-all flex flex-col justify-between group text-left"
              >
                <div>
                  <h4 className="text-lg font-bold text-yorumi-text mb-2 group-hover:text-yorumi-main transition-colors">Scraper API & Dev Documents</h4>
                  <p className="text-yorumi-muted text-sm leading-relaxed">
                    Can help you develop and integrate with Yorumi&apos;s Express backend, Redis caching, and scraper engine.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-yorumi-main">
                  <span>View API Docs</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleOpenDoc('tmdb')}
                className="bg-yorumi-card hover:bg-yorumi-card/80 p-6 rounded-3xl transition-all flex flex-col justify-between group text-left"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-lg font-bold text-yorumi-text group-hover:text-yorumi-main transition-colors">TMDB API Key Tutorial</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yorumi-main/20 text-yorumi-main uppercase">Tutorial</span>
                  </div>
                  <p className="text-yorumi-muted text-sm leading-relaxed">
                    Step-by-step tutorial on how to get and configure your TMDB API key for fanart and metadata in Yorumi.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-yorumi-main">
                  <span>View Tutorial</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            </div>
          </div>
        </div>
        )}

        {/* Comprehensive Developer Docs & Guides Component (Miru style) */}
        {currentPage === 'docs' && (
          <div className="w-full max-w-[1400px] space-y-12">
            
            <DocumentationGuide activeTab={activeDocTab} onTabChange={setActiveDocTab} />
          </div>
        )}

        {/* App Previews Section */}
        {currentPage === 'home' && (
        <div id="previews" className="w-full max-w-[1400px] mt-40">
          <AppPreviews />
        </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full mt-20 bg-yorumi-bg">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3 grayscale opacity-70">
            <img src="/yorumi-app-icon.png" alt="Yorumi" className="w-6 h-6 rounded-md" />
            <span className="text-sm font-semibold tracking-wide text-yorumi-text">&copy; {new Date().getFullYear()} Yorumi. All rights reserved.</span>
          </div>
          
          <div className="flex items-center gap-6 text-yorumi-muted">
            <a href="https://github.com/davenarchives/Yorumi" target="_blank" rel="noreferrer" className="hover:text-yorumi-text transition-colors" aria-label="GitHub">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
                <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02A9.58 9.58 0 0 1 12 6.84c.85 0 1.71.12 2.5.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5A10 10 0 0 0 22 12 10 10 0 0 0 12 2z"></path>
              </svg>
            </a>
            <a href="https://ko-fi.com/yorumii" target="_blank" rel="noreferrer" className="hover:text-yorumi-text transition-colors" aria-label="Ko-fi">
              <svg role="img" viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.351 2.715c-2.7 0-4.986.025-6.83.26C2.078 3.285 0 5.154 0 8.61c0 3.506.182 6.13 1.585 8.493 1.584 2.701 4.233 4.182 7.662 4.182h.83c4.209 0 6.494-2.234 7.637-4a9.5 9.5 0 0 0 1.091-2.338C21.792 14.688 24 12.22 24 9.208v-.415c0-3.247-2.13-5.507-5.792-5.87-1.558-.156-2.65-.208-6.857-.208m0 1.947c4.208 0 5.09.052 6.571.182 2.624.311 4.13 1.584 4.13 4v.39c0 2.156-1.792 3.844-3.87 3.844h-.935l-.156.649c-.208 1.013-.597 1.818-1.039 2.546-.909 1.428-2.545 3.064-5.922 3.064h-.805c-2.571 0-4.831-.883-6.078-3.195-1.09-2-1.298-4.155-1.298-7.506 0-2.181.857-3.402 3.012-3.714 1.533-.233 3.559-.26 6.39-.26m6.547 2.287c-.416 0-.65.234-.65.546v2.935c0 .311.234.545.65.545 1.324 0 2.051-.754 2.051-2s-.727-2.026-2.052-2.026m-10.39.182c-1.818 0-3.013 1.48-3.013 3.142 0 1.533.858 2.857 1.949 3.897.727.701 1.87 1.429 2.649 1.896a1.47 1.47 0 0 0 1.507 0c.78-.467 1.922-1.195 2.623-1.896 1.117-1.039 1.974-2.364 1.974-3.897 0-1.662-1.247-3.142-3.039-3.142-1.065 0-1.792.545-2.338 1.298-.493-.753-1.246-1.298-2.312-1.298"/>
              </svg>
            </a>
            <a href="https://discord.gg/3xzCQvfanb" target="_blank" rel="noreferrer" className="hover:text-yorumi-text transition-colors" aria-label="Discord">
              <svg role="img" viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}



export default App;
