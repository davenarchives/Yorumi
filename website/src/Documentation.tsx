import React, { useState } from 'react';
import { 
  BookOpen, 
  Terminal, 
  Key, 
  Server, 
  Layers, 
  ArrowRight, 
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';

export type DocTabId = 'intro' | 'setup' | 'tmdb' | 'scraper' | 'cli';

interface DocumentationGuideProps {
  activeTab: DocTabId;
  onTabChange: (tab: DocTabId) => void;
}

interface DocSection {
  id: DocTabId;
  title: string;
  icon: React.ReactNode;
  category: string;
  nextId?: DocTabId;
  nextTitle?: string;
  subsections: string[];
}

const DOC_SECTIONS: DocSection[] = [
  {
    id: 'intro',
    title: 'Introduction & Overview',
    icon: <BookOpen className="w-4 h-4" />,
    category: 'Developer Guide',
    nextId: 'setup',
    nextTitle: 'Environment Setup & Web',
    subsections: ['Overview', 'System Architecture', 'User Manual Usage']
  },
  {
    id: 'setup',
    title: 'Environment Setup & Web',
    icon: <Server className="w-4 h-4" />,
    category: 'Developer Guide',
    nextId: 'tmdb',
    nextTitle: 'TMDB API Key Tutorial',
    subsections: ['Local Installation', 'Cloud Deployment Real world']
  },
  {
    id: 'tmdb',
    title: 'TMDB API Key Tutorial',
    icon: <Key className="w-4 h-4" />,
    category: 'Tutorials & Guides',
    nextId: 'scraper',
    nextTitle: 'Scraper Engine & Backend',
    subsections: ['Why TMDB', 'Step by Step Configuration Guide']
  },
  {
    id: 'scraper',
    title: 'Scraper Engine & Backend',
    icon: <Layers className="w-4 h-4" />,
    category: 'Developer Guide',
    nextId: 'cli',
    nextTitle: 'Standalone CLI',
    subsections: ['Scrapers Providers Used', 'Defeating Cloudflare WAF']
  },
  {
    id: 'cli',
    title: 'Standalone CLI (yorumi-cli)',
    icon: <Terminal className="w-4 h-4" />,
    category: 'Standalone Tools',
    subsections: ['Important Architecture Note', 'Standalone Web Domain', 'Example CLI Usage']
  }
];

export const DocumentationGuide: React.FC<DocumentationGuideProps> = ({ activeTab, onTabChange }) => {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const currentSection = DOC_SECTIONS.find((s) => s.id === activeTab) || DOC_SECTIONS[0];

  const scrollToSection = (e: React.MouseEvent, title: string) => {
    e.preventDefault();
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const element = document.getElementById(id);
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedImage(null);
    };
    if (expandedImage) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedImage]);

  return (
    <div id="docs-section" className="w-full max-w-[1400px] space-y-8">
      <div className="space-y-2">
        <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-yorumi-text">
          Developer Docs &amp; Guides
        </h2>
        <p className="text-base md:text-lg text-yorumi-muted font-normal max-w-3xl">
          Everything you need to know about the Yorumi web application, scraper backend API, TMDB metadata configuration, and the standalone CLI tool.
        </p>
      </div>

      {/* 3-Column Documentation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
        {/* Left Sidebar: Topic Navigation */}
        <div className="lg:col-span-3 lg:sticky lg:top-28 h-fit bg-yorumi-card/80 rounded-3xl p-5 space-y-6">
          <div>
            <div className="text-xs font-bold text-yorumi-muted uppercase tracking-wider px-3 mb-3">
              Developer Guide
            </div>
            <div className="space-y-1">
              {DOC_SECTIONS.map((sec) => {
                const isActive = sec.id === activeTab;
                return (
                  <button
                    key={sec.id}
                    onClick={() => onTabChange(sec.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left text-sm font-semibold transition-all ${
                      isActive 
                        ? 'bg-yorumi-main text-white shadow-md shadow-yorumi-main/25' 
                        : 'text-yorumi-text hover:bg-yorumi-main/10 hover:text-yorumi-main'
                    }`}
                  >
                    <span className="shrink-0">{sec.icon}</span>
                    <span className="truncate">{sec.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 space-y-3 px-2">
            <div className="text-xs font-semibold text-yorumi-muted">Quick Links</div>
            <div className="flex flex-col gap-2 text-sm">
              <a 
                href="https://yorumi-cli.vercel.app/index.html"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-yorumi-text hover:text-yorumi-main transition-colors font-medium"
              >
                <span>Yorumi CLI</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a 
                href="https://github.com/davenarchives/Yorumi"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-yorumi-text hover:text-yorumi-main transition-colors font-medium"
              >
                <span>GitHub Repository</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Middle Column: Active Documentation Content */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-10 min-h-[580px] flex flex-col justify-between pt-2 lg:pt-5">
          <div className="space-y-8">
            {/* Title Header */}
            <div className="space-y-3 pb-6 border-b border-white/5">
              <div className="text-sm font-bold text-yorumi-main uppercase tracking-wider">
                {currentSection.category}
              </div>
              <h3 className="text-3xl md:text-4xl font-display font-bold text-yorumi-text">
                {currentSection.title}
              </h3>
            </div>

            {/* TAB CONTENT: INTRODUCTION */}
            {activeTab === 'intro' && (
              <div className="space-y-8 text-sm md:text-base text-yorumi-muted leading-relaxed">
                <p id="overview">
                  Welcome to the official documentation for <strong className="text-yorumi-text">Yorumi</strong>. This comprehensive guide covers the system architecture, our unique scraper engine, Cloudflare WAF circumvention, and deployment instructions.
                </p>

                <div className="bg-yorumi-main/10 rounded-2xl p-5 text-yorumi-text space-y-2">
                  <div className="font-bold flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-yorumi-main" />
                    <span>Educational &amp; Research Purposes Only</span>
                  </div>
                  <p className="text-sm text-yorumi-muted">
                    Yorumi is an open-source demonstration of modern web scraping, server-side caching, and HLS video streaming. It does not host any media files.
                  </p>
                </div>

                <div className="space-y-4">
                  <h4 id="system-architecture" className="text-2xl font-bold text-yorumi-text">System Architecture</h4>
                  <p>
                    Yorumi is built on a decoupled, high-performance client-server architecture designed for rapid content delivery and resilient scraping:
                  </p>
                  <ul className="space-y-6">
                    <li className="space-y-1">
                      <strong className="text-yorumi-text block text-lg">Frontend Layer (React 19 + Vite)</strong>
                      <p>A blazing-fast Single Page Application (SPA) utilizing React 19 concurrent features. It features Framer Motion for liquid-smooth transitions, custom CSS architecture, and a highly optimized HLS.js video player for seamless anime streaming.</p>
                    </li>
                    <li className="space-y-1">
                      <strong className="text-yorumi-text block text-lg">Backend API (Express.js + TypeScript)</strong>
                      <p>The orchestrator node that handles client requests, queries AniList for extensive show metadata, Fanart.tv for high-resolution assets, and heavily relies on Upstash/Redis for caching to prevent rate-limiting and ensure sub-100ms response times.</p>
                    </li>
                    <li className="space-y-1">
                      <strong className="text-yorumi-text block text-lg">Scraper Engine (Electron + Puppeteer Core)</strong>
                      <p>Instead of standard HTTP clients or basic headless browsers, Yorumi employs a sophisticated scraper engine running on Electron and Puppeteer Core. This allows Yorumi to present a <strong>genuine Chrome TLS fingerprint</strong> and execute full JavaScript environments, effectively bypassing Cloudflare Web Application Firewalls (WAF) and CAPTCHAs that block traditional scrapers.</p>
                    </li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <h4 id="user-manual-usage" className="text-2xl font-bold text-yorumi-text">User Manual &amp; Usage</h4>
                  <p>
                    Using Yorumi is designed to be frictionless. In <strong>Web Mode</strong>, you simply search for a show, select it, and the backend scraper dynamically resolves the best streaming provider in real-time. The built-in player supports quality switching, auto-next episode, and theater mode. 
                    Alternatively, the <strong>Standalone CLI</strong> allows you to search and stream anime directly into your local media player (like VLC or MPV) entirely from your terminal, completely bypassing the web interface!
                  </p>
                </div>
              </div>
            )}

            {/* TAB CONTENT: ENVIRONMENT SETUP */}
            {activeTab === 'setup' && (
              <div className="space-y-8 text-sm md:text-base text-yorumi-muted leading-relaxed">
                <p>
                  Deploy Yorumi to the cloud or set it up locally. This guide covers a real-world web deployment scenario using Vercel (Frontend) and Render (Backend).
                </p>

                <div className="space-y-3">
                  <h4 id="local-installation" className="text-xl font-bold text-yorumi-text">1. Local Installation</h4>
                  <p>Clone the repository and install dependencies for both the frontend and backend:</p>
                  <div className="bg-yorumi-text/5 rounded-2xl p-4 font-mono text-xs md:text-sm text-yorumi-text overflow-x-auto space-y-2 border border-yorumi-text/5">
                    <div>git clone https://github.com/davenarchives/yorumi.git</div>
                    <div>cd yorumi &amp;&amp; npm install</div>
                    <div>cd backend &amp;&amp; npm install &amp;&amp; cd ..</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 id="cloud-deployment-real-world" className="text-xl font-bold text-yorumi-text">2. Cloud Deployment (Real-world)</h4>
                  
                  <div className="space-y-2 pt-2">
                    <strong className="text-yorumi-text block text-lg">Backend (Render / Railway)</strong>
                    <p>The backend requires Node.js and Chromium/Electron dependencies for the Cloudflare bypass.</p>
                    <ul className="list-disc list-inside space-y-1 pl-2 text-sm">
                      <li>Create a new Web Service and point it to the <code className="text-yorumi-main bg-yorumi-main/10 px-1.5 py-0.5 rounded">backend/</code> directory.</li>
                      <li>Set Build Command: <code className="text-yorumi-main bg-yorumi-main/10 px-1.5 py-0.5 rounded">npm install && npm run build</code></li>
                      <li>Set Start Command: <code className="text-yorumi-main bg-yorumi-main/10 px-1.5 py-0.5 rounded">npm start</code></li>
                      <li>Ensure you add necessary environment variables (TMDB_API_KEY, REDIS_URL).</li>
                    </ul>
                  </div>

                  <div className="space-y-2 pt-4">
                    <strong className="text-yorumi-text block text-lg">Frontend (Vercel)</strong>
                    <p>The frontend is a standard Vite React application.</p>
                    <ul className="list-disc list-inside space-y-1 pl-2 text-sm">
                      <li>Import the repository into Vercel and set the Root Directory to <code className="text-yorumi-main bg-yorumi-main/10 px-1.5 py-0.5 rounded">website/</code>.</li>
                      <li>Vercel will automatically detect Vite. Leave build commands as default.</li>
                      <li>Add the environment variable <code className="text-yorumi-main bg-yorumi-main/10 px-1.5 py-0.5 rounded">VITE_API_URL</code> pointing to your deployed Render backend URL.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: TMDB API KEY TUTORIAL */}
            {activeTab === 'tmdb' && (
              <div className="space-y-8 text-sm md:text-base text-yorumi-muted leading-relaxed">
                <p>
                  Yorumi integrates with <strong className="text-yorumi-text">The Movie Database (TMDB)</strong> and <strong className="text-yorumi-text">Fanart.tv</strong> to fetch high-resolution show logos, episode thumbnails, and background banners.
                </p>

                <div className="space-y-3">
                  <div id="why-tmdb" className="font-bold text-yorumi-text flex items-center gap-2 text-lg">
                    <CheckCircle2 className="w-6 h-6 text-yorumi-main" />
                    <span>Why configure a TMDB API Key?</span>
                  </div>
                  <p className="text-sm border-l-2 border-yorumi-main/40 pl-4 py-1">
                    Without a valid TMDB key, Yorumi will fallback to standard AniList poster images. Adding your API key enables cinematic episode screenshots and logo overlays in the video player, drastically improving the UI experience.
                  </p>
                </div>

                <div className="space-y-5 pt-4">
                  <h4 id="step-by-step-configuration-guide" className="text-2xl font-bold text-yorumi-text">Step-by-Step Configuration Guide</h4>
                  
                  <div className="space-y-10">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yorumi-main/10 text-yorumi-main flex items-center justify-center font-bold">1</div>
                      <div className="space-y-3 w-full">
                        <strong className="text-yorumi-text block text-lg">Create an account</strong>
                        <img 
                          src="/tmdb/image-2.png" 
                          alt="Create TMDB Account" 
                          className="rounded-xl border border-yorumi-text/10 shadow-sm max-w-full cursor-pointer hover:scale-[1.02] hover:shadow-lg transition-all"
                          onClick={() => setExpandedImage('/tmdb/image-2.png')} 
                        />
                      </div>
                    </div>
                    
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yorumi-main/10 text-yorumi-main flex items-center justify-center font-bold">2</div>
                      <div className="space-y-3 w-full">
                        <strong className="text-yorumi-text block text-lg">Click Settings</strong>
                        <img 
                          src="/tmdb/image.png" 
                          alt="Click Settings" 
                          className="rounded-xl border border-yorumi-text/10 shadow-sm max-w-full cursor-pointer hover:scale-[1.02] hover:shadow-lg transition-all"
                          onClick={() => setExpandedImage('/tmdb/image.png')} 
                        />
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yorumi-main/10 text-yorumi-main flex items-center justify-center font-bold">3</div>
                      <div className="space-y-3 w-full">
                        <strong className="text-yorumi-text block text-lg">Click API then request an API key</strong>
                        <img 
                          src="/tmdb/image-1.png" 
                          alt="Request API Key" 
                          className="rounded-xl border border-yorumi-text/10 shadow-sm max-w-full cursor-pointer hover:scale-[1.02] hover:shadow-lg transition-all"
                          onClick={() => setExpandedImage('/tmdb/image-1.png')} 
                        />
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yorumi-main/10 text-yorumi-main flex items-center justify-center font-bold">4</div>
                      <div className="space-y-3 w-full">
                        <strong className="text-yorumi-text block text-lg">Click for personal use only</strong>
                        <img 
                          src="/tmdb/image-3.png" 
                          alt="Personal use only" 
                          className="rounded-xl border border-yorumi-text/10 shadow-sm max-w-full cursor-pointer hover:scale-[1.02] hover:shadow-lg transition-all"
                          onClick={() => setExpandedImage('/tmdb/image-3.png')} 
                        />
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yorumi-main/10 text-yorumi-main flex items-center justify-center font-bold">5</div>
                      <div className="space-y-3 w-full">
                        <strong className="text-yorumi-text block text-lg">Fill out the application</strong>
                        <img 
                          src="/tmdb/opera-snapshot.png" 
                          alt="Fill out application" 
                          className="rounded-xl border border-yorumi-text/10 shadow-sm max-w-full cursor-pointer hover:scale-[1.02] hover:shadow-lg transition-all"
                          onClick={() => setExpandedImage('/tmdb/opera-snapshot.png')} 
                        />
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yorumi-main/10 text-yorumi-main flex items-center justify-center font-bold">6</div>
                      <div className="space-y-3 w-full">
                        <strong className="text-yorumi-text block text-lg">Copy your API key</strong>
                        <img 
                          src="/tmdb/image-5.png" 
                          alt="Copy API Key" 
                          className="rounded-xl border border-yorumi-text/10 shadow-sm max-w-full cursor-pointer hover:scale-[1.02] hover:shadow-lg transition-all"
                          onClick={() => setExpandedImage('/tmdb/image-5.png')} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: SCRAPER ENGINE */}
            {activeTab === 'scraper' && (
              <div className="space-y-8 text-sm md:text-base text-yorumi-muted leading-relaxed">
                <p>
                  Yorumi&apos;s scraper engine is built for ultimate reliability, using multi-source fallbacks, advanced Cloudflare circumvention, and intelligent title reconciliation to ensure seamless playback.
                </p>

                <div className="space-y-4">
                  <h4 id="scrapers-providers-used" className="text-2xl font-bold text-yorumi-text">Scrapers &amp; Providers Used</h4>
                  <p>
                    The backend engine dynamically queries multiple anime and manga indexers simultaneously. If one provider is rate-limited or fails, it instantly falls back to the next.
                  </p>
                  <ul className="grid grid-cols-1 gap-6 pt-2">
                    <li className="space-y-1">
                      <strong className="text-yorumi-text block text-lg">AllManga Engine</strong>
                      <p>Primary provider. Supports GraphQL metadata discovery and direct AES-256-GCM stream URL decryption.</p>
                    </li>
                    <li className="space-y-1">
                      <strong className="text-yorumi-text block text-lg">AnimePahe Engine</strong>
                      <p>Secondary provider. High-performance Cheerio parsing with advanced token resolution for reliable streaming.</p>
                    </li>
                    <li className="space-y-1">
                      <strong className="text-yorumi-text block text-lg">AniList &amp; Fanart.tv</strong>
                      <p>Metadata providers. Used for mapping titles, generating synopsis, and fetching ultra-high-resolution artwork.</p>
                    </li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <h4 id="defeating-cloudflare-waf" className="text-2xl font-bold text-yorumi-text">Defeating Cloudflare WAF</h4>
                  <p>
                    Modern anime indexers protect their assets behind strict Cloudflare Web Application Firewalls (WAF) that block requests from Node.js (axios/node-fetch) by inspecting TLS fingerprints and executing JavaScript challenges.
                  </p>
                  <div className="space-y-2 pt-2">
                    <strong className="text-yorumi-text block text-lg">The Electron Advantage</strong>
                    <p>
                      Yorumi solves this by spinning up a lightweight, headless <strong>Electron</strong> instance orchestrated by Puppeteer Core. Because Electron uses a genuine Chromium networking stack, it possesses a completely valid Chrome TLS fingerprint. This allows the scraper engine to silently solve JS challenges, extract decryption keys at runtime, and cache the resolved stream links in Redis without triggering rate limits or captchas!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: STANDALONE CLI */}
            {activeTab === 'cli' && (
              <div className="space-y-6 text-sm md:text-base text-yorumi-muted leading-relaxed">
                <div className="bg-yorumi-main/15 rounded-2xl p-5 space-y-2">
                  <div id="important-architecture-note" className="font-bold text-yorumi-main flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    <span>Important Architecture Note</span>
                  </div>
                  <p className="text-sm text-yorumi-text">
                    <strong>yorumi-cli</strong> is a standalone tool (`yorumi-cli/`) completely unrelated to the main Yorumi web app. It works out-of-the-box for non-developer users to watch anime without needing any local backend running.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 id="standalone-web-domain" className="text-xl font-bold text-yorumi-text">Standalone Web Domain</h4>
                  <p>
                    If you prefer to use or download the standalone CLI tool, visit its dedicated domain:
                  </p>
                  <div>
                    <a
                      href="https://yorumi-cli.vercel.app/index.html"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-yorumi-main text-white font-semibold text-sm hover:bg-yorumi-main/90 transition-colors shadow-md shadow-yorumi-main/20"
                    >
                      <span>Visit https://yorumi-cli.vercel.app</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 id="example-cli-usage" className="text-xl font-bold text-yorumi-text">Example CLI Usage</h4>
                  <div className="bg-yorumi-text/5 rounded-2xl p-4 font-mono text-xs md:text-sm text-yorumi-text overflow-x-auto space-y-2">
                    <div># Search and watch directly in your terminal/media player:</div>
                    <div>npx yorumi-cli watch &quot;Frieren&quot; --episode 1</div>
                    <div className="pt-2"># Download episode with specific quality:</div>
                    <div>npx yorumi-cli download &quot;One Piece&quot; -e 1089 --quality 720</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Next Section Button (Miru style) */}
          {currentSection.nextId && (
            <div className="pt-6 border-t border-white/5 flex justify-end">
              <button
                onClick={() => onTabChange(currentSection.nextId!)}
                className="group inline-flex items-center gap-3 bg-yorumi-card hover:bg-yorumi-main/15 text-yorumi-text hover:text-yorumi-main px-6 py-4 rounded-2xl font-semibold text-sm transition-all"
              >
                <div className="text-right">
                  <div className="text-xs font-medium text-yorumi-muted">Next</div>
                  <div className="text-sm font-bold">{currentSection.nextTitle}</div>
                </div>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          )}
        </div>

        {/* Right Sidebar: On This Page Table of Contents */}
        <div className="hidden xl:block xl:col-span-2 xl:sticky xl:top-28 h-fit bg-yorumi-card/80 rounded-3xl p-5 space-y-4">
          <div className="text-xs font-bold text-yorumi-muted uppercase tracking-wider px-2">
            On this page
          </div>
          <div className="space-y-2 text-sm">
            {currentSection.subsections.map((sub, i) => (
              <button
                key={i}
                onClick={(e) => scrollToSection(e, sub)}
                className={`block w-full text-left px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer ${
                  i === 0 
                    ? 'bg-yorumi-main/15 text-yorumi-main font-semibold' 
                    : 'text-yorumi-muted hover:text-yorumi-text hover:bg-white/5'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Expanded Image Modal */}
      {expandedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 cursor-pointer backdrop-blur-sm"
          onClick={() => setExpandedImage(null)}
        >
          <img 
            src={expandedImage} 
            alt="Expanded view" 
            className="max-w-[95vw] max-h-[95vh] rounded-2xl object-contain shadow-2xl border border-white/10"
          />
        </div>
      )}
    </div>
  );
};
