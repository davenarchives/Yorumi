import React, { useState, useEffect } from 'react';
import { 
  Monitor,
  Globe,
  Sun,
  Moon,
  Tv,
  BookOpen,
  Library,
  ArrowRight,
  Star
} from 'lucide-react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';

const SLIDES = [
  { id: 1, image: '/browse-animes.png', label: 'Browse Animes', description: 'Discover thousands of titles instantly across all genres.' },
  { id: 2, image: '/browse-mangas.png', label: 'Browse Mangas', description: 'Explore a vast, organized library of manga and manhwa.' },
  { id: 3, image: '/anime-details.png', label: 'Anime Details', description: 'Get comprehensive stats, episodes, and rich metadata.' },
  { id: 4, image: '/manga-details.png', label: 'Manga Details', description: 'Deep dive into chapters, artwork, and story progression.' },
  { id: 5, image: '/watch-anime.png', label: 'Watch Anime in One Click', description: 'Immerse yourself in a cinematic, zero-latency streaming experience.' },
  { id: 6, image: '/read-manga.png', label: 'Read Manga in One Click', description: 'Seamless reading powered by a high-performance stealth engine.' },
];

function HeroSlider() {
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
    <div className="relative w-full max-w-[850px] flex flex-col items-center">
      {/* Text labels above */}
      <div className="h-16 flex flex-col items-center justify-end w-full z-50 mb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 15, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -15, filter: "blur(4px)" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            <h3 className="text-yorumi-text font-bold text-xl md:text-2xl tracking-wide text-center">
              {SLIDES[currentIndex].label}
            </h3>
            <p className="text-yorumi-muted font-medium mt-1 text-center">
              {SLIDES[currentIndex].description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Stacked Cards Container */}
      <div className="relative w-full aspect-[16/10] mb-10 group">
        {SLIDES.map((slide, index) => {
          // Calculate relative position where 0 is active, 1 is behind, 2 is further behind.
          let relativeIndex = index - currentIndex;
          if (relativeIndex < 0) relativeIndex += SLIDES.length;

          let state = 'hidden';
          if (relativeIndex === 0) state = 'active';
          else if (relativeIndex === 1) state = 'next1';
          else if (relativeIndex === 2) state = 'next2';
          else if (relativeIndex === SLIDES.length - 1) state = 'prev';

          const variants = {
            active: { x: 0, y: 0, scale: 1, zIndex: 30, opacity: 1 },
            next1: { x: 0, y: 25, scale: 0.95, zIndex: 20, opacity: 1 },
            next2: { x: 0, y: 50, scale: 0.90, zIndex: 10, opacity: 1 },
            prev: { x: 0, y: -30, scale: 1.05, zIndex: 40, opacity: 0 },
            hidden: { x: 0, y: 50, scale: 0.85, zIndex: 0, opacity: 0 }
          };

          return (
            <motion.div
              key={slide.id}
              variants={variants}
              animate={state}
              initial="hidden"
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
              drag={state === 'active' ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, { offset }) => {
                if (offset.x < -50) handleNext();
                if (offset.x > 50) handlePrev();
              }}
              onClick={() => {
                if (state === 'next1') handleNext();
                if (state === 'next2') setCurrentIndex((prev) => (prev + 2) % SLIDES.length);
              }}
              className="absolute inset-0 w-full h-full rounded-3xl overflow-hidden cursor-grab active:cursor-grabbing"
            >
              {/* Dark Overlay for non-active cards to create depth */}
              <motion.div 
                animate={{ opacity: state === 'active' ? 0 : 0.6 }}
                className="absolute inset-0 bg-[#0f1115] z-20 pointer-events-none transition-opacity duration-300"
              />
              <img src={slide.image} alt={slide.label} className="w-full h-full object-cover relative z-10 pointer-events-none" />
            </motion.div>
          );
        })}
      </div>

      {/* Indicators */}
      <div className="flex gap-3 mt-6 z-50">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`w-3 h-3 rounded-full transition-all duration-500 ease-out ${
              idx === currentIndex ? 'bg-yorumi-main w-10 shadow-[0_0_12px_rgba(var(--color-yorumi-main),0.6)]' : 'bg-yorumi-text/20 hover:bg-yorumi-text/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [starCount, setStarCount] = useState<string>('...');
  const { scrollY } = useScroll();
  const yImage = useTransform(scrollY, [0, 500], [0, -50]);

  useEffect(() => {
    setIsDarkMode(false);
    document.documentElement.classList.remove('dark');

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);

    fetch('https://api.github.com/repos/davenarchives/Yorumi')
      .then(res => res.json())
      .then(data => {
        if (data.stargazers_count !== undefined) {
          setStarCount(data.stargazers_count.toString());
        }
      })
      .catch(console.error);

    return () => window.removeEventListener('scroll', handleScroll);
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
    <div className="min-h-screen font-sans selection:bg-yorumi-main selection:text-white transition-colors duration-500 bg-yorumi-bg">
      
      {/* Sticky Premium Navigation */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-12 py-4 transition-all duration-300 ${isScrolled ? 'bg-yorumi-bg/80 backdrop-blur-xl border-b border-yorumi-text/5 shadow-sm' : 'bg-transparent'}`}
      >
        <div className="flex items-center gap-3 group cursor-pointer">
          <img src="/yorumi-app-icon.png" alt="Yorumi" className="w-8 h-8 group-hover:scale-110 group-active:scale-95 transition-transform duration-300 rounded-md" />
          <span className="text-lg font-display font-bold tracking-wide text-yorumi-text">Yorumi</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-6 font-bold text-sm tracking-wide text-yorumi-muted">
            <a href="https://github.com/davenarchives/Yorumi" target="_blank" rel="noreferrer" className="hover:text-yorumi-text transition-colors flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
                <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02A9.58 9.58 0 0 1 12 6.84c.85 0 1.71.12 2.5.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5A10 10 0 0 0 22 12 10 10 0 0 0 12 2z"></path>
              </svg>
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                {starCount}
              </span>
            </a>
            <a href="https://ko-fi.com/yorumii" target="_blank" rel="noreferrer" className="hover:text-yorumi-text transition-colors flex items-center gap-2">
              <svg role="img" viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.351 2.715c-2.7 0-4.986.025-6.83.26C2.078 3.285 0 5.154 0 8.61c0 3.506.182 6.13 1.585 8.493 1.584 2.701 4.233 4.182 7.662 4.182h.83c4.209 0 6.494-2.234 7.637-4a9.5 9.5 0 0 0 1.091-2.338C21.792 14.688 24 12.22 24 9.208v-.415c0-3.247-2.13-5.507-5.792-5.87-1.558-.156-2.65-.208-6.857-.208m0 1.947c4.208 0 5.09.052 6.571.182 2.624.311 4.13 1.584 4.13 4v.39c0 2.156-1.792 3.844-3.87 3.844h-.935l-.156.649c-.208 1.013-.597 1.818-1.039 2.546-.909 1.428-2.545 3.064-5.922 3.064h-.805c-2.571 0-4.831-.883-6.078-3.195-1.09-2-1.298-4.155-1.298-7.506 0-2.181.857-3.402 3.012-3.714 1.533-.233 3.559-.26 6.39-.26m6.547 2.287c-.416 0-.65.234-.65.546v2.935c0 .311.234.545.65.545 1.324 0 2.051-.754 2.051-2s-.727-2.026-2.052-2.026m-10.39.182c-1.818 0-3.013 1.48-3.013 3.142 0 1.533.858 2.857 1.949 3.897.727.701 1.87 1.429 2.649 1.896a1.47 1.47 0 0 0 1.507 0c.78-.467 1.922-1.195 2.623-1.896 1.117-1.039 1.974-2.364 1.974-3.897 0-1.662-1.247-3.142-3.039-3.142-1.065 0-1.792.545-2.338 1.298-.493-.753-1.246-1.298-2.312-1.298"/>
              </svg>
              Ko-fi
            </a>
          </div>
          
          <div className="w-px h-6 bg-yorumi-text/10 hidden md:block"></div>
          
          <button 
            onClick={toggleDarkMode}
            className="relative flex items-center justify-center w-10 h-10 rounded-full bg-yorumi-card hover:bg-yorumi-main/10 hover:text-yorumi-main border border-yorumi-text/5 hover:scale-105 active:scale-95 transition-all duration-300 shadow-sm overflow-hidden"
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
      <main className="flex flex-col items-center pt-40 pb-32 px-6 md:px-12 lg:px-24 overflow-hidden">
        <div className="w-full max-w-[1400px] grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-stretch">
          
          {/* Left Column (Text & Buttons) */}
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col justify-center h-full z-10 py-1"
          >
            <div className="flex flex-col gap-8">
              <div className="space-y-6">
                <motion.a
                  variants={itemVariants}
                  href="https://github.com/davenarchives/Yorumi/releases"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yorumi-main/10 text-yorumi-main font-bold text-sm tracking-wide border border-yorumi-main/20 w-fit hover:bg-yorumi-main/20 hover:scale-105 active:scale-95 transition-all duration-200"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yorumi-main opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-yorumi-main"></span>
                  </span>
                  Yorumi v3.5.6
                </motion.a>
                <motion.h1 variants={itemVariants} className="text-4xl md:text-5xl lg:text-[4rem] font-display font-black leading-[1.1] tracking-tight text-yorumi-text">
                  Your anime and manga <br />
                  in one seamless space.
                </motion.h1>
              </div>
              
              <motion.p variants={itemVariants} className="text-xl md:text-2xl font-medium text-yorumi-muted max-w-xl leading-relaxed">
                A modern, open-source platform for streaming anime and reading manga. Built with performance and user experience in mind.
              </motion.p>
            </div>
            
            <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-4 pt-6">
              <a 
                href="https://github.com/davenarchives/Yorumi/releases" 
                target="_blank"
                rel="noreferrer"
                className="group relative flex items-center justify-center gap-2 bg-yorumi-main text-white px-6 py-3 rounded-xl font-semibold text-base overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-yorumi-main/20"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <Monitor className="w-5 h-5 relative z-10" />
                <span className="relative z-10">download desktop</span>
              </a>
              
              <a 
                href="https://github.com/davenarchives/Yorumi" 
                target="_blank" 
                rel="noreferrer"
                className="group flex items-center justify-center gap-2 bg-yorumi-card text-yorumi-text px-6 py-3 rounded-xl font-semibold text-base border border-yorumi-text/5 hover:border-yorumi-main/50 hover:bg-yorumi-main/5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Globe className="w-5 h-5 group-hover:text-yorumi-main transition-colors" />
                <span>open source</span>
                <ArrowRight className="w-4 h-4 opacity-0 -ml-3 group-hover:opacity-100 group-hover:ml-0 group-hover:text-yorumi-main transition-all duration-300" />
              </a>
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
            <div className="w-full transform hover:scale-[1.01] transition-all duration-700 ease-out z-10">
              <HeroSlider />
            </div>
          </motion.div>
        </div>

        {/* Pro Max Features Section */}
        <div id="features" className="w-full max-w-[1400px] mt-40">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16 space-y-4"
          >
            <h2 className="text-4xl md:text-5xl font-display font-black tracking-tighter text-yorumi-text">Built for enthusiasts.</h2>
            <p className="text-xl text-yorumi-muted font-medium">Carefully crafted for a seamless viewing and reading experience.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Tv className="w-8 h-8 text-yorumi-text transition-colors" />}
              title="Cinematic Playback"
              description="A custom-built video player designed for massive screens and crystal clear HLS streaming."
              delay={0.1}
            />
            <FeatureCard 
              icon={<BookOpen className="w-8 h-8 text-yorumi-text transition-colors" />}
              title="Stealth Reader"
              description="Zero-latency manga reading with hardware-accelerated image decoding and seamless preloading."
              delay={0.2}
            />
            <FeatureCard 
              icon={<Library className="w-8 h-8 text-yorumi-text transition-colors" />}
              title="Unified Library"
              description="Your entire universe of media, perfectly synced, deeply organized, and instantly accessible."
              delay={0.3}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className="group bg-yorumi-card rounded-[2rem] p-10 flex flex-col gap-6 transition-transform duration-500 hover:-translate-y-2 overflow-hidden"
    >
      <div className="bg-yorumi-bg w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110">
        {icon}
      </div>
      <div>
        <h3 className="text-3xl font-display font-black tracking-tight mb-3 text-yorumi-text">{title}</h3>
        <p className="text-yorumi-muted font-medium text-lg leading-relaxed">
          {description}
        </p>
      </div>
    </motion.div>
  );
}

export default App;
