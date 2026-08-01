import React, { useState, useEffect } from 'react';
import { 
  Sun,
  Moon,
  ArrowRight,
  ExternalLink,
  Star,
  AlertTriangle,
  Download,
  Bug,
  Server,
  Zap,
  Terminal
} from 'lucide-react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { DocumentationGuide, type DocTabId } from './Documentation';

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
  const [currentPage, setCurrentPage] = useState<'home' | 'get-started' | 'docs'>('home');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [starCount, setStarCount] = useState<string>('...');
  const [activeDocTab, setActiveDocTab] = useState<DocTabId>('intro');
  const { scrollY } = useScroll();
  const yImage = useTransform(scrollY, [0, 500], [0, -50]);

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

  useEffect(() => {
    setIsDarkMode(false);
    document.documentElement.classList.remove('dark');

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
    <div className="min-h-screen font-sans selection:bg-yorumi-main selection:text-white transition-colors duration-500 bg-yorumi-bg">
      
      {/* Sticky Premium Navigation */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-12 py-4 transition-all duration-300 ${isScrolled ? 'bg-yorumi-bg/80 backdrop-blur-xl border-b border-yorumi-text/5 shadow-sm' : 'bg-transparent'}`}
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
          
          <div className="w-px h-6 bg-yorumi-text/10 hidden md:block"></div>
          
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
                className="flex flex-col justify-center h-full z-10 py-1"
              >
                <div className="flex flex-col gap-6">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <motion.h1 variants={itemVariants} className="text-5xl md:text-6xl lg:text-7xl font-display font-bold leading-none tracking-tight text-yorumi-text">
                      Yorumi
                    </motion.h1>
                    <motion.a
                      variants={itemVariants}
                      href="https://github.com/davenarchives/Yorumi/releases"
                      target="_blank"
                      rel="noreferrer"
                      className="text-yorumi-main font-semibold text-sm md:text-base tracking-wide hover:opacity-80 transition-opacity"
                    >
                      v3.5.7
                    </motion.a>
                  </div>
                  
                  <motion.p variants={itemVariants} className="text-xl md:text-2xl font-medium text-yorumi-muted max-w-xl leading-relaxed">
                    A modern, open-source platform for streaming anime and reading manga. Built with performance and user experience in mind.
                  </motion.p>
                </div>
                
                <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => navigateTo('get-started')}
                    className="group flex items-center justify-center gap-2.5 bg-yorumi-main hover:bg-yorumi-main/90 text-white px-6 py-2.5 rounded-full font-semibold text-sm md:text-base tracking-wide transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-sm shadow-yorumi-main/20 cursor-pointer"
                  >
                    <span>Get Started</span>
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
            <div className="w-full transform hover:scale-[1.01] transition-all duration-700 ease-out z-10">
              <HeroSlider />
            </div>
          </motion.div>
        </div>
        </>
        )}

        {/* Start Using Section (Miru style, minimal, Yorumi blue theme) */}
        {currentPage === 'get-started' && (
        <div id="start-using" className="w-full max-w-[1400px] space-y-16">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-yorumi-text">Start Using</h2>
            <p className="text-base md:text-lg text-yorumi-muted font-normal">
              You can download the standalone CLI package or use Yorumi directly on the web page.
            </p>
          </motion.div>

          {/* Client Subsection */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-yorumi-text">Client</h3>
            <div className="bg-yorumi-card rounded-3xl p-6 md:p-8 space-y-6">
              <div className="text-sm md:text-base text-yorumi-muted">
                <span className="font-medium text-yorumi-text">The latest stable version:</span>{' '}
                <span className="text-yorumi-main font-semibold">v3.5.7</span>
              </div>

              {/* Keep ONLY legit release downloads: latest .exe, source-code zip, and standalone CLI domain */}
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="https://github.com/davenarchives/Yorumi/releases/latest"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-yorumi-main/20 hover:bg-yorumi-main/30 text-yorumi-main font-semibold text-sm transition-colors border border-yorumi-main/30"
                >
                  <Download className="w-4 h-4" />
                  <span>Yorumi-v3.5.7.exe</span>
                </a>
                <a
                  href="https://github.com/davenarchives/Yorumi/archive/refs/heads/main.zip"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-yorumi-main/10 hover:bg-yorumi-main/20 text-yorumi-text hover:text-yorumi-main font-semibold text-sm transition-colors border border-yorumi-text/10"
                >
                  <Download className="w-4 h-4 text-yorumi-muted" />
                  <span>source-code.zip</span>
                </a>
                <a
                  href="https://yorumi-cli.vercel.app/index.html"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-yorumi-main/10 hover:bg-yorumi-main/20 text-yorumi-text hover:text-yorumi-main font-semibold text-sm transition-colors border border-yorumi-text/10"
                >
                  <ExternalLink className="w-4 h-4 text-yorumi-main" />
                  <span>yorumi-cli-v2.1.8</span>
                </a>
              </div>

              <div className="border-t border-white/5 pt-6 space-y-4">
                <div className="text-sm font-semibold text-yorumi-text">What&apos;s new in this version?</div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-yorumi-main">
                    <Bug className="w-4 h-4" />
                    <span>Bug Fixes & Enhancements</span>
                  </div>
                  <ul className="list-disc list-inside text-sm text-yorumi-muted space-y-1 pl-1">
                    <li>
                      <span className="font-semibold text-yorumi-text">scraper:</span> Dynamic AES-256-GCM key scraping & AllManga scraper stream resolution restoration.
                    </li>
                    <li>
                      <span className="font-semibold text-yorumi-text">web:</span> Minimal hero redesign with streamlined get started workflow & documentation hub.
                    </li>
                    <li>
                      <span className="font-semibold text-yorumi-text">anime:</span> Updated `/anime/home-fast` to populate Top Ten lists with latest episode counts.
                    </li>
                  </ul>
                </div>
                <div>
                  <a
                    href="https://github.com/davenarchives/Yorumi/releases"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-yorumi-main hover:underline"
                  >
                    <span>View changes on GitHub</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Web Subsection */}
          <div className="space-y-4 pt-4">
            <h3 className="text-xl font-bold text-yorumi-text">Web</h3>
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
                className="bg-yorumi-card hover:bg-yorumi-card/80 p-6 rounded-2xl transition-all flex flex-col justify-between group text-left"
              >
                <div>
                  <h4 className="text-lg font-bold text-yorumi-text mb-2 group-hover:text-yorumi-main transition-colors">Web deployment tutorial</h4>
                  <p className="text-yorumi-muted text-sm leading-relaxed">
                    Learn how to deploy Yorumi as a modern web app (Client + Server) or self-host your own scraper backend.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-yorumi-main">
                  <span>Read Tutorial</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>

              <a
                href="https://github.com/davenarchives/Yorumi"
                target="_blank"
                rel="noreferrer"
                className="bg-yorumi-card hover:bg-yorumi-card/80 p-6 rounded-2xl transition-all flex flex-col justify-between group"
              >
                <div>
                  <h4 className="text-lg font-bold text-yorumi-text mb-2 group-hover:text-yorumi-main transition-colors">Use instances directly</h4>
                  <p className="text-yorumi-muted text-sm leading-relaxed">
                    You can visit the live Yorumi repository and web instance to start watching anime and reading manga immediately.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-yorumi-main">
                  <span>Visit Instance</span>
                  <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </a>
            </div>
          </div>

          {/* Documentation Subsection */}
          <div id="documentation" className="space-y-4 pt-4">
            <h3 className="text-xl font-bold text-yorumi-text">Documentation</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button
                type="button"
                onClick={() => handleOpenDoc('intro')}
                className="bg-yorumi-card hover:bg-yorumi-card/80 p-6 rounded-2xl transition-all flex flex-col justify-between group text-left"
              >
                <div>
                  <h4 className="text-lg font-bold text-yorumi-text mb-2 group-hover:text-yorumi-main transition-colors">User Usage Documents</h4>
                  <p className="text-yorumi-muted text-sm leading-relaxed">
                    Can help you get started with Yorumi quickly, including web mode and standalone CLI setup.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-yorumi-main">
                  <span>View Guide</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleOpenDoc('scraper')}
                className="bg-yorumi-card hover:bg-yorumi-card/80 p-6 rounded-2xl transition-all flex flex-col justify-between group text-left"
              >
                <div>
                  <h4 className="text-lg font-bold text-yorumi-text mb-2 group-hover:text-yorumi-main transition-colors">Scraper API & Dev Documents</h4>
                  <p className="text-yorumi-muted text-sm leading-relaxed">
                    Can help you develop and integrate with Yorumi&apos;s Express backend, Redis caching, and scraper engine.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-yorumi-main">
                  <span>View API Docs</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleOpenDoc('tmdb')}
                className="bg-yorumi-card hover:bg-yorumi-card/80 p-6 rounded-2xl transition-all flex flex-col justify-between group text-left"
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
                <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-yorumi-main">
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

        {/* Pro Max Features Section */}
        {currentPage === 'home' && (
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
              icon={<Server className="w-8 h-8 text-yorumi-text transition-colors" />}
              title="Electron Scraper Engine"
              description="A custom headless Electron instance that mimics Chromium to silently solve Cloudflare JS challenges and extract raw stream keys."
              delay={0.1}
            />
            <FeatureCard 
              icon={<Zap className="w-8 h-8 text-yorumi-text transition-colors" />}
              title="Lightning Fast Caching"
              description="Powered by Redis and Upstash, Yorumi caches metadata and provider links to ensure instantaneous, rate-limit-free load times."
              delay={0.2}
            />
            <FeatureCard 
              icon={<Terminal className="w-8 h-8 text-yorumi-text transition-colors" />}
              title="Standalone CLI"
              description="Search, download, and stream media straight into your favorite local media player entirely from your terminal."
              delay={0.3}
            />
          </div>
        </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-yorumi-text/5 mt-20 bg-yorumi-bg">
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
