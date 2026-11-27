import React, { useEffect, useState } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  Tag,
} from 'lucide-react';

export type DocTabId = 'intro' | 'setup' | 'tmdb' | 'scraper' | 'cli' | 'changelogs';

interface DocumentationGuideProps {
  activeTab: DocTabId;
  scrollNonce?: number;
  onTabChange: (tab: DocTabId) => void;
}

interface DocSubsection {
  id: string;
  label: string;
}

interface DocSection {
  id: DocTabId;
  anchorId: string;
  label: string;
  title: string;
  lede: string;
  subsections: DocSubsection[];
}

const DOC_SECTIONS: DocSection[] = [
  {
    id: 'intro',
    anchorId: 'sec-intro',
    label: 'Getting Started',
    title: 'Getting Started',
    lede: 'Yorumi is a free, ad-free app for watching anime and reading manga and light novels on Windows, macOS, Linux, and Android — with offline downloads and optional Discord sync.',
    subsections: [
      { id: 'what-is-yorumi', label: 'What You Can Do' },
      { id: 'platforms', label: 'Platforms' },
      { id: 'disclaimer', label: 'Media & Privacy' },
    ],
  },
  {
    id: 'setup',
    anchorId: 'sec-setup',
    label: 'Self-Host & Setup',
    title: 'Self-Host & Setup',
    lede: 'Normal users can just download the desktop app or Android APK. Use this guide if you want to run Yorumi from source or deploy the web version yourself.',
    subsections: [
      { id: 'local-setup', label: 'Run Locally' },
      { id: 'backend-deploy', label: 'Deploy Backend' },
      { id: 'frontend-deploy', label: 'Deploy Web App' },
    ],
  },
  {
    id: 'tmdb',
    anchorId: 'sec-tmdb',
    label: 'TMDB API Key',
    title: 'TMDB API Key',
    lede: 'Add a free The Movie Database (TMDB) API key to unlock widescreen backdrops, official anime title logos, and crisp episode thumbnails.',
    subsections: [
      { id: 'why-tmdb', label: 'Why Add a Key' },
      { id: 'tmdb-steps', label: 'Step-by-Step Guide' },
    ],
  },
  {
    id: 'scraper',
    anchorId: 'sec-scraper',
    label: 'How It Works',
    title: 'How It Works',
    lede: 'How Yorumi loads anime streams, manga chapters, light novels, and artwork — and keeps your library synced across devices.',
    subsections: [
      { id: 'native-apps', label: 'Native Apps' },
      { id: 'source-fallbacks', label: 'Source Fallbacks' },
      { id: 'artwork-sync', label: 'Artwork & Cloud Sync' },
    ],
  },
  {
    id: 'cli',
    anchorId: 'sec-cli',
    label: 'Yorumi CLI',
    title: 'Yorumi CLI',
    lede: 'A separate standalone command-line tool for watching and downloading anime directly from your terminal with mpv or VLC — no local backend required.',
    subsections: [
      { id: 'cli-install', label: 'Installation' },
      { id: 'cli-usage', label: 'Quick Usage' },
      { id: 'cli-links', label: 'Links' },
    ],
  },
  {
    id: 'changelogs',
    anchorId: 'sec-changelogs',
    label: 'Changelogs',
    title: 'Changelogs',
    lede: 'Track Yorumi releases, new features, and fixes across desktop and Android.',
    subsections: [
      { id: 'release-v5-0-8', label: 'v5.0.8' },
      { id: 'release-v5-0-7', label: 'v5.0.7' },
      { id: 'release-v5-0-6', label: 'v5.0.6' },
      { id: 'release-v5-0-5', label: 'v5.0.5' },
      { id: 'release-v5-0-0', label: 'v5.0.0' },
      { id: 'release-v4-3-0', label: 'v4.3.0' },
      { id: 'release-v4-1-1', label: 'v4.1.1' },
      { id: 'release-v4-1-0', label: 'v4.1.0' },
      { id: 'release-v4-0-9', label: 'v4.0.9' },
    ],
  },
];

const CHANGELOG_ENTRIES = [
  {
    id: 'release-v5-0-8',
    version: 'v5.0.8',
    date: 'November 27, 2026',
    summary: 'Dedicated collapsible Tablet Navigation Rail, unsigned iOS (.ipa) beta, Anime/Manga/LN chapter & episode push notifications, faster alternative-title Search, batch download picker on Desktop & Tablet, and Explore/caption polish.',
    highlights: [
      { title: 'Tablet Navigation Rail & Full-Screen Readers', body: 'Added a bare-icon collapsible frosted-glass Tablet Navigation Rail (84px) with PC-style SearchModal, fixed tablet Explore landscape & sidebar overlap, made Menu drawers & sub-drawers frosted glass to the top edge, and made Manga & LN readers 100% full-screen.' },
      { title: 'iOS Unsigned .ipa (Beta) & SideStore Repo', body: 'Added native Swift plugins (ImmersiveMode, LocalMediaProxy with HLS/image referer proxying, and YouTube HUD cleaner), automated macOS GitHub Actions .ipa builds, and 1-tap SideStore/AltStore support at yorumi.cloud/source.json.' },
      { title: 'Faster Alt-Title Search & Anime/Manga/LN Notifications', body: 'Switched Anime search to AniList-first with 3-minute caching so English, Romaji, Native, and official synonyms resolve fast; bounded slow NovelBin/MangaKatana/Render timeouts; and extended native Android push notifications & Updates to Manga and Light Novel chapters.' },
      { title: 'Batch Download Picker, Explore Watch Fix & Captions', body: 'Added the batch download selector (Next 1/5/10/25, Unread, All, Custom) to Desktop & Tablet details toolbars, fixed tapping episodes from Explore swipe-to-details, removed the post-scroll Explore video jump, prioritized JP Light Novel editions over Web Novels, and refined phone/desktop caption sizing.' },
    ],
  },
  {
    id: 'release-v5-0-7',
    version: 'v5.0.7',
    date: 'November 27, 2026',
    summary: 'TikTok-smooth Explore feed with zero-delay preloading and clean trailer playback, built-in global TMDB artwork proxy, desktop slide-over menu drawer, and Android polish.',
    highlights: [
      { title: 'TikTok-Smooth Explore & Clean Trailers', body: 'Preloads the next trailer silently for instant 0:00 playback on scroll, hides YouTube play/pause overlays on both Android and Desktop, automatically skips region-blocked trailers, displays Main Character profile avatars, and pauses video cleanly when swiping left into the full Details view.' },
      { title: 'Built-In Global TMDB Artwork Proxy', body: 'Widescreen backdrops, crisp official title logos, and episode stills now work out of the box across Desktop and Android via a 24-hour cached Cloudflare Worker edge proxy, with an optional personal TMDB API key override in Settings.' },
      { title: 'Desktop Menu Drawer & Slide-Over Sub-Drawer', body: 'Added the hamburger menu drawer to Desktop with matching slide-over sub-drawers for Updates, Download Queue, History, Statistics, Data & Storage, Settings, and About.' },
      { title: 'Android Download Queue Deep-Linking & Mobile Polish', body: 'Tapping active Anime, Manga, or Light Novel download notifications now jumps straight to the matching Download Queue tab; details headers sit cleanly below the Downloaded-only banner, and mobile scrollbars are hidden globally.' },
    ],
  },
  {
    id: 'release-v5-0-6',
    version: 'v5.0.6',
    date: 'November 26, 2026',
    summary: 'Mihon-style seamless multi-chapter manga scrolling, 60fps interactive paged swiping, reading mode settings, reliable read-state tracking, and offline chapter collision fixes.',
    highlights: [
      { title: 'Seamless Multi-Chapter Manga Reader', body: 'Long-strip reading now flows continuously from chapter to chapter with Mihon-style Finished / Next transition dividers — scroll forward or back up seamlessly without reloads or jumps.' },
      { title: 'Reading Mode Settings & 60fps Free Swiping', body: 'Added a top-right Reading Settings sheet with 6 reading modes (Default, Paged LTR, Paged RTL, Paged Vertical, Long strip, Long strip with gaps) and native 60fps scroll-snap finger swiping.' },
      { title: 'Dynamic Page Indicator & Faster Preloading', body: 'Added an outlined bottom-center page counter (current / total) that hides when reader bars open, plus immediate tap-time chapter warming and a 4-worker rolling page preloader.' },
      { title: 'Reliable Read State & Offline Download Isolation', body: 'Fixed manga chapters failing to mark as read on initial open or across different IDs, kept download icons crisp on read chapters, and prevented offline chapter collisions across different series.' },
    ],
  },
  {
    id: 'release-v5-0-5',
    version: 'v5.0.5',
    date: 'November 26, 2026',
    summary: 'Full offline Library & History persistence, TikTok-style mobile drawer & Explore swipe-to-details, Android episode update notifications, and rock-solid anime downloads on Desktop & Android.',
    highlights: [
      { title: 'Full Offline Library & Durable History', body: 'All Library posters, banners, synopsis/genres metadata, episode titles, and Manga/LN chapter lists now save locally across Desktop and Android — plus IndexedDB-backed offline History (up to 200 items with cached posters).' },
      { title: 'Mobile Drawer, Incognito & Downloaded-Only Modes', body: 'Added a smooth zero-bounce TikTok-style mobile menu drawer with Downloaded only, Incognito mode, tabbed Download Queue (Anime / Manga / LN), date-grouped History, Statistics, Data & Storage with Discord Cloud Sync, and About.' },
      { title: 'Smooth Explore Swipe-to-Details & Mobile Performance', body: 'Swiping left on Explore now slides in the real Anime Details page preloaded with metadata, moving the full shell smoothly at 60fps and returning straight to your Explore session on Back.' },
      { title: 'Android & Desktop Anime Downloads Fixed', body: 'Fixed MAL-keyed anime downloads, added 403/401 header fallback and 720p mobile stream cap, real native download cancellation, and Android push notifications for airing watchlist episodes.' },
    ],
  },
  {
    id: 'release-v5-0-0',
    version: 'v5.0.0',
    date: 'November 25, 2026',
    summary: 'Major Tauri v2 & Android release with UI redesign, Explore gestures, Global Chat, Discord Cloud Sync, in-app Auto-Updater, and accurate watch stats.',
    highlights: [
      { title: 'Explore Feed & Mobile Gestures', body: 'Swipe through personalized anime trailers with full-screen tap play/pause, double-tap heart likes, and long-press 2x playback speed.' },
      { title: 'Live Discord Cloud Sync (PC & Android)', body: 'Sign in with Discord to keep your continue watching, episode/chapter history, favorites, custom categories, and watch time synced automatically via Neon Postgres.' },
      { title: 'Global Chat & In-App Auto-Updater', body: 'Chat live with clickable Now Watching episode links, and get one-click in-app updates with full changelogs on Desktop and Android.' },
      { title: 'UI Redesign, Accurate Watch Hours & Cleanup', body: 'Redesigned Library with 26-week Activity heatmaps, Browse Anime multi-genre filters, unified video player controls, accurate tracked watch hours, and removed legacy Firebase & Yumi bloat.' },
    ],
  },
  {
    id: 'release-v4-3-0',
    version: 'v4.3.0',
    date: 'October 16, 2026',
    summary: 'Native Tauri desktop & Android offline downloads, Discord cloud sync, Browse Anime, and Explore.',
    highlights: [
      { title: 'Offline Downloads Everywhere', body: 'Save anime episodes, manga chapters, and light novel chapters on desktop and Android to watch and read without Wi-Fi.' },
      { title: 'Discord Cloud Sync & User Profiles', body: 'Sign in with Discord anytime to automatically sync your watchlist, custom categories, and history across devices — plus browse community profiles.' },
      { title: 'Browse Anime & Explore Feed', body: 'Added multi-genre Browse Anime with draggable mobile filters and a vertical Explore trailer feed for discovering new shows.' },
      { title: 'Faster Progressive Search', body: 'Search results now stream in per section with typo suggestions, recent searches, and personalized recommendations.' },
    ],
  },
  {
    id: 'release-v4-1-1',
    version: 'v4.1.1',
    date: 'September 20, 2026',
    summary: 'Playback stability, subtitle fixes, and improved anime source matching.',
    highlights: [
      { title: 'Reliable Subtitle Rendering', body: 'Switched to a custom WebVTT/SRT subtitle renderer with multi-language tracks and on-demand translation.' },
      { title: 'Season & Sequel Accuracy', body: 'Improved episode matching so Season 1 and sequel seasons never mix up episode lists.' },
    ],
  },
  {
    id: 'release-v4-1-0',
    version: 'v4.1.0',
    date: 'August 21, 2026',
    summary: 'Light Novel reader, custom Library categories, and Global Chat.',
    highlights: [
      { title: 'Light & Web Novel Reader', body: 'Read Japanese, Korean, and Chinese novels with customizable text size, spacing, and dark themes.' },
      { title: 'Custom Library Categories', body: 'Organize your Anime, Manga, and Light Novels into custom lists alongside Watchlist and Favorites.' },
      { title: 'Global Anime Chat', body: 'Chat live with other Yorumi fans and jump straight to episodes others are watching.' },
    ],
  },
  {
    id: 'release-v4-0-9',
    version: 'v4.0.9',
    date: 'August 13, 2026',
    summary: 'Android mobile app polish, faster manga reader, and artwork upgrades.',
    highlights: [
      { title: 'Faster Manga Page Loading', body: 'Added parallel page preloading and smart caching for smooth vertical strip reading.' },
      { title: 'TMDB Backdrops & Logos', body: 'Added crisp widescreen backdrops, episode stills, and official anime title logos.' },
    ],
  },
];

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="relative rounded-xl bg-yorumi-card p-4 pr-14 font-mono text-xs sm:text-[13px] text-yorumi-text overflow-x-auto my-4">
      <pre className="whitespace-pre leading-relaxed">{code}</pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy command"
        className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-yorumi-bg text-yorumi-muted hover:text-yorumi-text transition-colors cursor-pointer"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export const DocumentationGuide: React.FC<DocumentationGuideProps> = ({ activeTab, scrollNonce = 0, onTabChange }) => {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [visibleSectionId, setVisibleSectionId] = useState<DocTabId>(activeTab);
  const [visibleSubId, setVisibleSubId] = useState<string>(
    DOC_SECTIONS.find((s) => s.id === activeTab)?.subsections[0]?.id || 'what-is-yorumi'
  );

  const scrollToElement = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const headerOffset = 96;
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  };

  // Scroll to requested section every time activeTab or scrollNonce changes (including re-clicking Changelogs)
  useEffect(() => {
    const target = DOC_SECTIONS.find((s) => s.id === activeTab);
    if (!target) return;
    setVisibleSectionId(activeTab);
    if (activeTab === 'intro') {
      if (scrollNonce > 0) window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const raf1 = requestAnimationFrame(() => {
      scrollToElement(target.anchorId);
    });
    const timer = window.setTimeout(() => {
      scrollToElement(target.anchorId);
    }, 180);
    return () => {
      cancelAnimationFrame(raf1);
      window.clearTimeout(timer);
    };
  }, [activeTab, scrollNonce]);

  // Scroll-spy for left sidebar section & right TOC subsection
  useEffect(() => {
    const handleScroll = () => {
      const offset = 140;
      let currentSec: DocSection = DOC_SECTIONS[0];
      for (const sec of DOC_SECTIONS) {
        const el = document.getElementById(sec.anchorId);
        if (el && el.getBoundingClientRect().top <= offset) {
          currentSec = sec;
        }
      }
      setVisibleSectionId(currentSec.id);

      let currentSub = currentSec.subsections[0]?.id || '';
      for (const sub of currentSec.subsections) {
        const el = document.getElementById(sub.id);
        if (el && el.getBoundingClientRect().top <= offset + 40) {
          currentSub = sub.id;
        }
      }
      setVisibleSubId(currentSub);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedImage(null);
    };
    if (expandedImage) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedImage]);

  const activeSectionObj = DOC_SECTIONS.find((s) => s.id === visibleSectionId) || DOC_SECTIONS[0];

  return (
    <div
      id="docs-section"
      className="w-full max-w-[1320px] mx-auto grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,780px)_210px] gap-10 xl:gap-12 items-start"
    >
      {/* Left Sticky Sidebar */}
      <aside
        aria-label="Documentation navigation"
        className="lg:sticky lg:top-24 self-start lg:border-r lg:border-yorumi-text/10 lg:pr-5 pb-6 lg:pb-0 border-b lg:border-b-0 border-yorumi-text/10"
      >
        <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-yorumi-muted mb-3 px-2.5">
          Yorumi Docs
        </div>
        <nav className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
          {DOC_SECTIONS.map((sec) => {
            const isActive = sec.id === visibleSectionId;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => {
                  onTabChange(sec.id);
                  setVisibleSectionId(sec.id);
                  scrollToElement(sec.anchorId);
                }}
                className={`block text-left px-2.5 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-yorumi-card text-yorumi-text'
                    : 'text-yorumi-muted hover:text-yorumi-text hover:bg-yorumi-card/70 hover:translate-x-0.5'
                }`}
              >
                {sec.label}
              </button>
            );
          })}
        </nav>

        <div className="hidden lg:block mt-8 pt-6 border-t border-yorumi-text/10 space-y-1">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-yorumi-muted mb-2.5 px-2.5">
            Links
          </div>
          <a
            href="https://yorumi-cli.vercel.app/docs.html"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm font-bold text-yorumi-muted hover:text-yorumi-text hover:bg-yorumi-card/70 transition-colors"
          >
            <span>Yorumi CLI Docs</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </a>
          <a
            href="https://github.com/davenarchives/Yorumi"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm font-bold text-yorumi-muted hover:text-yorumi-text hover:bg-yorumi-card/70 transition-colors"
          >
            <span>GitHub</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </a>
        </div>
      </aside>

      {/* Middle Long Connected Scroll */}
      <div className="min-w-0">
        {/* SECTION 1: GETTING STARTED */}
        <section id="sec-intro" className="scroll-mt-24 pb-12 space-y-10">
          <div>
            <h1 className="text-4xl sm:text-5xl font-display font-extrabold tracking-tight text-yorumi-text mb-4">
              Getting Started
            </h1>
            <p className="text-base sm:text-lg text-yorumi-muted leading-relaxed">
              Yorumi is a free, ad-free app for watching anime and reading manga and light novels on Windows, macOS, Linux, and Android — with offline downloads and optional Discord sync.
            </p>
          </div>

          <div id="what-is-yorumi" className="space-y-3">
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-yorumi-text">
              What You Can Do
            </h2>
            <ul className="space-y-2.5 text-sm sm:text-base text-yorumi-muted leading-relaxed list-disc pl-5">
              <li>
                <strong className="text-yorumi-text">Watch anime in HD</strong> — play new episodes and classics in one tap, switch between sub and dub, skip intros, and swipe through trailers in Explore.
              </li>
              <li>
                <strong className="text-yorumi-text">Read manga &amp; light novels</strong> — browse manga, manhwa, manhua, and web novels in clean readers with adjustable text size, spacing, and dark themes.
              </li>
              <li>
                <strong className="text-yorumi-text">Save for offline</strong> — download episodes, manga chapters, and light novel chapters right to your device for trips with no Wi-Fi.
              </li>
              <li>
                <strong className="text-yorumi-text">Organize &amp; sync</strong> — track your watchlist with custom categories locally, or sign in with Discord anytime to keep your library synced across devices.
              </li>
            </ul>
          </div>

          <div id="platforms" className="space-y-3">
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-yorumi-text">
              Platforms
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <tbody>
                  {[
                    { platform: 'Windows', details: 'Native desktop installer (.exe) for Windows 10 / 11' },
                    { platform: 'macOS', details: 'Universal app (.dmg) for Apple Silicon & Intel Macs' },
                    { platform: 'Linux', details: 'Portable AppImage (.AppImage) for Ubuntu, Fedora, Arch & more' },
                    { platform: 'Android', details: 'Native Android APK (.apk) with offline downloads & mobile reader' },
                  ].map((row) => (
                    <tr key={row.platform} className="border-t border-yorumi-text/10 first:border-t-0">
                      <th className="py-3.5 pr-6 font-bold text-yorumi-text whitespace-nowrap w-32">{row.platform}</th>
                      <td className="py-3.5 text-yorumi-muted">{row.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div id="disclaimer" className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-yorumi-text">
              Media &amp; Privacy
            </h2>
            <p className="text-sm sm:text-base text-yorumi-muted leading-relaxed">
              Yorumi does not host or upload any video, manga, or novel files — all content is fetched directly from publicly available sources. Your watchlist and history stay on your device unless you choose to sign in with Discord to sync them.
            </p>
          </div>
        </section>

        {/* SECTION 2: SELF-HOST & SETUP */}
        <section id="sec-setup" className="scroll-mt-24 pt-12 pb-12 border-t border-yorumi-text/10 space-y-10">
          <div>
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight text-yorumi-text mb-3">
              Self-Host &amp; Setup
            </h2>
            <p className="text-base text-yorumi-muted leading-relaxed">
              Normal users can just download the desktop app or Android APK. Use this guide if you want to run Yorumi from source or deploy the web version yourself.
            </p>
          </div>

          <div id="local-setup" className="space-y-3">
            <h3 className="text-xl font-display font-bold text-yorumi-text">Run Locally</h3>
            <p className="text-sm sm:text-base text-yorumi-muted leading-relaxed">
              Requires <strong className="text-yorumi-text">Node.js 18+</strong>. Clone the repository, install dependencies, and start both the web frontend and backend API:
            </p>
            <CodeBlock
              code={`git clone https://github.com/davenarchives/Yorumi.git\ncd Yorumi\nnpm install\nnpm install --prefix backend\nnpm run dev`}
            />
            <p className="text-sm text-yorumi-muted leading-relaxed">
              To run the native desktop app locally (requires Rust), use{' '}
              <code className="px-1.5 py-0.5 rounded bg-yorumi-card text-yorumi-text font-mono text-xs">npm run dev:tauri</code>.
            </p>
          </div>

          <div id="backend-deploy" className="space-y-3">
            <h3 className="text-xl font-display font-bold text-yorumi-text">Deploy Backend</h3>
            <p className="text-sm sm:text-base text-yorumi-muted leading-relaxed">
              Host the Express backend on Render, Railway, or any Node.js host:
            </p>
            <ul className="space-y-2 text-sm sm:text-base text-yorumi-muted list-disc pl-5">
              <li>Root directory: <code className="text-yorumi-main font-mono text-xs sm:text-sm">backend/</code></li>
              <li>Build command: <code className="text-yorumi-main font-mono text-xs sm:text-sm">npm install &amp;&amp; npm run build</code></li>
              <li>Start command: <code className="text-yorumi-main font-mono text-xs sm:text-sm">npm start</code></li>
              <li>Optional env vars: <code className="text-yorumi-main font-mono text-xs sm:text-sm">TMDB_API_KEY</code> and Upstash Redis keys for faster caching.</li>
            </ul>
          </div>

          <div id="frontend-deploy" className="space-y-3">
            <h3 className="text-xl font-display font-bold text-yorumi-text">Deploy Web App</h3>
            <p className="text-sm sm:text-base text-yorumi-muted leading-relaxed">
              Import the repository root into Vercel (Vite is detected automatically) and add the environment variable{' '}
              <code className="text-yorumi-main font-mono text-xs sm:text-sm">VITE_API_URL</code> pointing to your backend URL ending in{' '}
              <code className="text-yorumi-main font-mono text-xs sm:text-sm">/api</code>.
            </p>
          </div>
        </section>

        {/* SECTION 3: TMDB API KEY */}
        <section id="sec-tmdb" className="scroll-mt-24 pt-12 pb-12 border-t border-yorumi-text/10 space-y-10">
          <div>
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight text-yorumi-text mb-3">
              TMDB API Key
            </h2>
            <p className="text-base text-yorumi-muted leading-relaxed">
              Add a free The Movie Database (TMDB) API key to unlock widescreen backdrops, official anime title logos, and crisp episode thumbnails.
            </p>
          </div>

          <div id="why-tmdb" className="space-y-2">
            <h3 className="text-xl font-display font-bold text-yorumi-text">Why Add a Key</h3>
            <p className="text-sm sm:text-base text-yorumi-muted leading-relaxed">
              Yorumi now includes a built-in global TMDB edge proxy so widescreen backdrops, official show logos, and crisp episode thumbnails work out of the box. Adding your own free TMDB API key in Settings is completely optional if you prefer your own dedicated rate limit.
            </p>
          </div>

          <div id="tmdb-steps" className="space-y-8">
            <h3 className="text-xl font-display font-bold text-yorumi-text">Step-by-Step Guide</h3>
            {[
              { step: 1, title: 'Create a free TMDB account', img: '/tmdb/image-2.png', alt: 'Create TMDB Account' },
              { step: 2, title: 'Open your account Settings', img: '/tmdb/image.png', alt: 'Open Settings' },
              { step: 3, title: 'Select API and request a new key', img: '/tmdb/image-1.png', alt: 'Request API Key' },
              { step: 4, title: 'Choose Developer / Personal use', img: '/tmdb/image-3.png', alt: 'Personal use only' },
              { step: 5, title: 'Fill out the quick application form', img: '/tmdb/opera-snapshot.png', alt: 'Fill out application' },
              { step: 6, title: 'Copy your API key into Yorumi Settings', img: '/tmdb/image-5.png', alt: 'Copy API Key' },
            ].map((item) => (
              <div key={item.step} className="space-y-3">
                <h4 className="text-base sm:text-lg font-display font-bold text-yorumi-text">
                  {item.step}. {item.title}
                </h4>
                <img
                  src={item.img}
                  alt={item.alt}
                  onClick={() => setExpandedImage(item.img)}
                  className="rounded-xl w-full aspect-video object-contain bg-yorumi-card cursor-pointer hover:opacity-95 transition-opacity"
                />
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 4: HOW IT WORKS */}
        <section id="sec-scraper" className="scroll-mt-24 pt-12 pb-12 border-t border-yorumi-text/10 space-y-10">
          <div>
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight text-yorumi-text mb-3">
              How It Works
            </h2>
            <p className="text-base text-yorumi-muted leading-relaxed">
              How Yorumi loads anime streams, manga chapters, light novels, and artwork — and keeps your library synced across devices.
            </p>
          </div>

          <div id="native-apps" className="space-y-2">
            <h3 className="text-xl font-display font-bold text-yorumi-text">Native Apps</h3>
            <p className="text-sm sm:text-base text-yorumi-muted leading-relaxed">
              Yorumi desktop runs on <strong className="text-yorumi-text">Tauri (Rust + React 19)</strong> and Android runs on <strong className="text-yorumi-text">Capacitor</strong>. Video playback, chapter fetching, and offline downloads run directly on your device without needing a separate server.
            </p>
          </div>

          <div id="source-fallbacks" className="space-y-2">
            <h3 className="text-xl font-display font-bold text-yorumi-text">Source Fallbacks</h3>
            <p className="text-sm sm:text-base text-yorumi-muted leading-relaxed">
              Yorumi checks multiple public anime, manga, and light novel sources automatically. If one server is slow or temporarily unavailable, it falls back to the next working source so playback and reading stay uninterrupted.
            </p>
          </div>

          <div id="artwork-sync" className="space-y-2">
            <h3 className="text-xl font-display font-bold text-yorumi-text">Artwork &amp; Cloud Sync</h3>
            <p className="text-sm sm:text-base text-yorumi-muted leading-relaxed">
              Catalog details, scores, and airing schedules come from <strong className="text-yorumi-text">AniList</strong>, while widescreen backdrops, episode thumbnails, and show logos come from <strong className="text-yorumi-text">TMDB</strong>. Your watchlist, custom categories, and progress are saved locally first, and signing in with Discord syncs them across your devices automatically.
            </p>
          </div>
        </section>

        {/* SECTION 5: YORUMI CLI */}
        <section id="sec-cli" className="scroll-mt-24 pt-12 pb-12 border-t border-yorumi-text/10 space-y-10">
          <div>
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight text-yorumi-text mb-3">
              Yorumi CLI
            </h2>
            <p className="text-base text-yorumi-muted leading-relaxed">
              A separate standalone command-line tool for watching and downloading anime directly from your terminal with mpv or VLC — no local backend required.
            </p>
          </div>

          <div id="cli-install" className="space-y-3">
            <h3 className="text-xl font-display font-bold text-yorumi-text">Installation</h3>
            <h4 className="text-sm font-bold text-yorumi-text pt-1">Windows (PowerShell)</h4>
            <CodeBlock code="iwr -useb https://raw.githubusercontent.com/davenarchives/yorumi-cli/main/install.ps1 | iex" />
            <h4 className="text-sm font-bold text-yorumi-text pt-1">macOS / Linux</h4>
            <CodeBlock code="curl -fsSL https://raw.githubusercontent.com/davenarchives/yorumi-cli/main/install.sh | bash" />
          </div>

          <div id="cli-usage" className="space-y-3">
            <h3 className="text-xl font-display font-bold text-yorumi-text">Quick Usage</h3>
            <CodeBlock
              code={`# Search and stream in mpv\nyorumi-cli watch "Frieren" --episode 1\n\n# Download an episode in 720p\nyorumi-cli download "One Piece" -e 1089 --quality 720\n\n# Update to the latest version\nyorumi-cli --update`}
            />
          </div>

          <div id="cli-links" className="space-y-3">
            <h3 className="text-xl font-display font-bold text-yorumi-text">Links</h3>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="https://yorumi-cli.vercel.app/docs.html"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-yorumi-main hover:bg-yorumi-main/90 text-white font-bold text-sm transition-colors"
              >
                <span>Full Yorumi CLI Docs</span>
                <ExternalLink className="w-4 h-4" />
              </a>
              <a
                href="https://github.com/davenarchives/yorumi-cli"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full tarsi-card hover:opacity-90 text-yorumi-text font-bold text-sm transition-colors"
              >
                <span>GitHub Repository</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* SECTION 6: CHANGELOGS */}
        <section id="sec-changelogs" className="scroll-mt-24 pt-12 pb-6 border-t border-yorumi-text/10 space-y-8">
          <div>
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight text-yorumi-text mb-3">
              Changelogs
            </h2>
            <p className="text-base text-yorumi-muted leading-relaxed">
              Track Yorumi releases, new features, and fixes across desktop and Android.
            </p>
          </div>

          <div className="space-y-8">
            {CHANGELOG_ENTRIES.map((entry) => (
              <article
                key={entry.id}
                id={entry.id}
                className="tarsi-card rounded-2xl p-6 sm:p-8 space-y-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight text-yorumi-text">
                    {entry.version}
                  </h3>
                  <time className="text-xs sm:text-sm font-bold text-yorumi-muted">
                    {entry.date}
                  </time>
                </div>

                <p className="text-sm sm:text-base text-yorumi-muted leading-relaxed">
                  {entry.summary}
                </p>

                <div className="pt-1 space-y-2.5">
                  <h4 className="text-base font-display font-bold text-yorumi-text">
                    What&apos;s New
                  </h4>
                  <ul className="space-y-2.5 text-sm text-yorumi-muted leading-relaxed list-disc pl-5">
                    {entry.highlights.map((h) => (
                      <li key={h.title}>
                        <strong className="text-yorumi-text">{h.title}:</strong> {h.body}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2">
                  <a
                    href={`https://github.com/davenarchives/Yorumi/releases/tag/${entry.version}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-yorumi-muted hover:text-yorumi-main transition-colors"
                  >
                    <Tag className="w-4 h-4" />
                    <span>{entry.version}</span>
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {/* Right Sticky TOC Sidebar (dynamically updates per scrolled section) */}
      <aside
        aria-label="On this page"
        className="hidden xl:block sticky top-24 self-start border-l border-yorumi-text/10 pl-5"
      >
        <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-yorumi-muted mb-3 px-2.5">
          On this page
        </div>
        <div className="space-y-1">
          {activeSectionObj.subsections.map((sub) => {
            const isSubActive = sub.id === visibleSubId;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => scrollToElement(sub.id)}
                className={`block w-full text-left px-2.5 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                  isSubActive
                    ? 'bg-yorumi-card text-yorumi-text'
                    : 'text-yorumi-muted hover:text-yorumi-text hover:bg-yorumi-card/70 hover:translate-x-0.5'
                }`}
              >
                {sub.label}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Expanded Screenshot Modal for TMDB Guide */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 cursor-pointer backdrop-blur-sm"
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage}
            alt="Expanded guide screenshot"
            className="max-w-[95vw] max-h-[95vh] rounded-2xl object-contain"
          />
        </div>
      )}
    </div>
  );
};
