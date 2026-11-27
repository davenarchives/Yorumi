import { useState, useEffect, useRef } from 'react';
import {
  Sun,
  Moon,
  ArrowRight,
  ArrowUp,
  ExternalLink,
  Star,
  Download,
  Copy,
  Check,
  Terminal,
  Smartphone,
  Monitor,
  ChevronDown,
  Tv,
  BookOpen,
  BookText,
  WifiOff,
  Menu,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { DocumentationGuide, type DocTabId } from './Documentation';

const RELEASE_VERSION = '5.0.8';
const RELEASE_TAG = `v${RELEASE_VERSION}`;
const RELEASES_URL = 'https://github.com/davenarchives/Yorumi/releases';
const RELEASE_URL = `${RELEASES_URL}/tag/${RELEASE_TAG}`;
const RELEASE_DOWNLOAD_URL = `${RELEASES_URL}/download/${RELEASE_TAG}`;
const releaseDownloadUrl = (assetName: string) => `${RELEASE_DOWNLOAD_URL}/${assetName}`;

const BASE_DOWNLOAD_COUNT = 500;

const COMMUNITY_AVATARS = [
  { name: 'Frieren', src: 'https://res.cloudinary.com/div8klfkc/image/upload/yorumi/avatars/frieren/frieren.jpg' },
  { name: 'Hitori', src: 'https://res.cloudinary.com/div8klfkc/image/upload/yorumi/avatars/bocchitherock/hitori.jpg' },
  { name: 'Luffy', src: 'https://res.cloudinary.com/div8klfkc/image/upload/yorumi/avatars/onepiece/luffy.jpg' },
  { name: 'Killua', src: 'https://res.cloudinary.com/div8klfkc/image/upload/yorumi/avatars/hunterxhunter/killua.jpg' },
  { name: 'Hu Tao', src: 'https://res.cloudinary.com/div8klfkc/image/upload/yorumi/avatars/genshin/hutao.jpg' },
];

const FLOATING_COMMUNITY_AVATARS = [
  { name: 'Frieren', src: 'https://res.cloudinary.com/div8klfkc/image/upload/yorumi/avatars/frieren/frieren.jpg', pos: 'top-10 left-8 lg:left-14 w-13 h-13', duration: 3.6, delay: 0 },
  { name: 'Luffy', src: 'https://res.cloudinary.com/div8klfkc/image/upload/yorumi/avatars/onepiece/luffy.jpg', pos: 'top-16 left-44 lg:left-56 w-9 h-9', duration: 4.1, delay: 0.6 },
  { name: 'Hitori', src: 'https://res.cloudinary.com/div8klfkc/image/upload/yorumi/avatars/bocchitherock/hitori.jpg', pos: 'bottom-9 left-24 lg:left-32 w-11 h-11', duration: 3.4, delay: 1.1 },
  { name: 'Killua', src: 'https://res.cloudinary.com/div8klfkc/image/upload/yorumi/avatars/hunterxhunter/killua.jpg', pos: 'top-11 right-28 lg:right-40 w-12 h-12', duration: 3.9, delay: 0.3 },
  { name: 'Hu Tao', src: 'https://res.cloudinary.com/div8klfkc/image/upload/yorumi/avatars/genshin/hutao.jpg', pos: 'bottom-8 right-44 lg:right-60 w-9 h-9', duration: 3.5, delay: 0.9 },
  { name: 'Yorumi', src: '/yorumi-app-icon.png', pos: 'bottom-10 right-8 lg:right-14 w-13 h-13', duration: 4.0, delay: 1.4 },
];

function AppleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 1.01-2.87-.96.04-2.12.64-2.8 1.44-.59.68-1.11 1.76-1.07 2.81 1.07.08 2.24-.63 2.86-1.38z" />
    </svg>
  );
}

function WindowsIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.551H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.849" />
    </svg>
  );
}

function LinuxIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} role="img" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <title>Linux</title>
      <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 00-.205.334 1.18 1.18 0 00-.09.4v.019c.002.089.008.179.02.267-.193-.067-.438-.135-.607-.202a1.635 1.635 0 01-.018-.2v-.02a1.772 1.772 0 01.15-.768c.082-.22.232-.406.43-.533a.985.985 0 01.594-.2zm-2.962.059h.036c.142 0 .27.048.399.135.146.129.264.288.344.465.09.199.14.4.153.667v.004c.007.134.006.2-.002.266v.08c-.03.007-.056.018-.083.024-.152.055-.274.135-.393.2.012-.09.013-.18.003-.267v-.015c-.012-.133-.04-.2-.082-.333a.613.613 0 00-.166-.267.248.248 0 00-.183-.064h-.021c-.071.006-.13.04-.186.132a.552.552 0 00-.12.27.944.944 0 00-.023.33v.015c.012.135.037.2.08.334.046.134.098.2.166.268.01.009.02.018.034.024-.07.057-.117.07-.176.136a.304.304 0 01-.131.068 2.62 2.62 0 01-.275-.402 1.772 1.772 0 01-.155-.667 1.759 1.759 0 01.08-.668 1.43 1.43 0 01.283-.535c.128-.133.26-.2.418-.2zm1.37 1.706c.332 0 .733.065 1.216.399.293.2.523.269 1.052.468h.003c.255.136.405.266.478.399v-.131a.571.571 0 01.016.47c-.123.31-.516.643-1.063.842v.002c-.268.135-.501.333-.775.465-.276.135-.588.292-1.012.267a1.139 1.139 0 01-.448-.067 3.566 3.566 0 01-.322-.198c-.195-.135-.363-.332-.612-.465v-.005h-.005c-.4-.246-.616-.512-.686-.71-.07-.268-.005-.47.193-.6.224-.135.38-.271.483-.336.104-.074.143-.102.176-.131h.002v-.003c.169-.202.436-.47.839-.601.139-.036.294-.065.466-.065zm2.8 2.142c.358 1.417 1.196 3.475 1.735 4.473.286.534.855 1.659 1.102 3.024.156-.005.33.018.513.064.646-1.671-.546-3.467-1.089-3.966-.22-.2-.232-.335-.123-.335.59.534 1.365 1.572 1.646 2.757.13.535.16 1.104.021 1.67.067.028.135.06.205.067 1.032.534 1.413.938 1.23 1.537v-.043c-.06-.003-.12 0-.18 0h-.016c.151-.467-.182-.825-1.065-1.224-.915-.4-1.646-.336-1.77.465-.008.043-.013.066-.018.135-.068.023-.139.053-.209.064-.43.268-.662.669-.793 1.187-.13.533-.17 1.156-.205 1.869v.003c-.02.334-.17.838-.319 1.35-1.5 1.072-3.58 1.538-5.348.334a2.645 2.645 0 00-.402-.533 1.45 1.45 0 00-.275-.333c.182 0 .338-.03.465-.067a.615.615 0 00.314-.334c.108-.267 0-.697-.345-1.163-.345-.467-.931-.995-1.788-1.521-.63-.4-.986-.87-1.15-1.396-.165-.534-.143-1.085-.015-1.645.245-1.07.873-2.11 1.274-2.763.107-.065.037.135-.408.974-.396.751-1.14 2.497-.122 3.854a8.123 8.123 0 01.647-2.876c.564-1.278 1.743-3.504 1.836-5.268.048.036.217.135.289.202.218.133.38.333.59.465.21.201.477.335.876.335.039.003.075.006.11.006.412 0 .73-.134.997-.268.29-.134.52-.334.74-.4h.005c.467-.135.835-.402 1.044-.7zm2.185 8.958c.037.6.343 1.245.882 1.377.588.134 1.434-.333 1.791-.765l.211-.01c.315-.007.577.01.847.268l.003.003c.208.199.305.53.391.876.085.4.154.78.409 1.066.486.527.645.906.636 1.14l.003-.007v.018l-.003-.012c-.015.262-.185.396-.498.595-.63.401-1.746.712-2.457 1.57-.618.737-1.37 1.14-2.036 1.191-.664.053-1.237-.2-1.574-.898l-.005-.003c-.21-.4-.12-1.025.056-1.69.176-.668.428-1.344.463-1.897.037-.714.076-1.335.195-1.814.12-.465.308-.797.641-.984l.045-.022zm-10.814.049h.01c.053 0 .105.005.157.014.376.055.706.333 1.023.752l.91 1.664.003.003c.243.533.754 1.064 1.189 1.637.434.598.77 1.131.729 1.57v.006c-.057.744-.48 1.148-1.125 1.294-.645.135-1.52.002-2.395-.464-.968-.536-2.118-.469-2.857-.602-.369-.066-.61-.2-.723-.4-.11-.2-.113-.602.123-1.23v-.004l.002-.003c.117-.334.03-.752-.027-1.118-.055-.401-.083-.71.043-.94.16-.334.396-.4.69-.533.294-.135.64-.202.915-.47h.002v-.002c.256-.268.445-.601.668-.838.19-.201.38-.336.663-.336zm7.159-9.074c-.435.201-.945.535-1.488.535-.542 0-.97-.267-1.28-.466-.154-.134-.28-.268-.373-.335-.164-.134-.144-.333-.074-.333.109.016.129.134.199.2.096.066.215.2.36.333.292.2.68.467 1.167.467.485 0 1.053-.267 1.398-.466.195-.135.445-.334.648-.467.156-.136.149-.267.279-.267.128.016.034.134-.147.332a8.097 8.097 0 01-.69.468zm-1.082-1.583V5.64c-.006-.02.013-.042.029-.05.074-.043.18-.027.26.004.063 0 .16.067.15.135-.006.049-.085.066-.135.066-.055 0-.092-.043-.141-.068-.052-.018-.146-.008-.163-.065zm-.551 0c-.02.058-.113.049-.166.066-.047.025-.086.068-.14.068-.05 0-.13-.02-.136-.068-.01-.066.088-.133.15-.133.08-.031.184-.047.259-.005.019.009.036.03.03.05v.02h.003z" />
    </svg>
  );
}

function GithubIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} fill-current`} aria-hidden="true">
      <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02A9.58 9.58 0 0 1 12 6.84c.85 0 1.71.12 2.5.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5A10 10 0 0 0 22 12 10 10 0 0 0 12 2z" />
    </svg>
  );
}

function DiscordIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" className={`${className} fill-current`} xmlns="http://www.w3.org/2000/svg">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  );
}

function KofiIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" className={`${className} fill-current`} xmlns="http://www.w3.org/2000/svg">
      <path d="M11.351 2.715c-2.7 0-4.986.025-6.83.26C2.078 3.285 0 5.154 0 8.61c0 3.506.182 6.13 1.585 8.493 1.584 2.701 4.233 4.182 7.662 4.182h.83c4.209 0 6.494-2.234 7.637-4a9.5 9.5 0 0 0 1.091-2.338C21.792 14.688 24 12.22 24 9.208v-.415c0-3.247-2.13-5.507-5.792-5.87-1.558-.156-2.65-.208-6.857-.208m0 1.947c4.208 0 5.09.052 6.571.182 2.624.311 4.13 1.584 4.13 4v.39c0 2.156-1.792 3.844-3.87 3.844h-.935l-.156.649c-.208 1.013-.597 1.818-1.039 2.546-.909 1.428-2.545 3.064-5.922 3.064h-.805c-2.571 0-4.831-.883-6.078-3.195-1.09-2-1.298-4.155-1.298-7.506 0-2.181.857-3.402 3.012-3.714 1.533-.233 3.559-.26 6.39-.26m6.547 2.287c-.416 0-.65.234-.65.546v2.935c0 .311.234.545.65.545 1.324 0 2.051-.754 2.051-2s-.727-2.026-2.052-2.026m-10.39.182c-1.818 0-3.013 1.48-3.013 3.142 0 1.533.858 2.857 1.949 3.897.727.701 1.87 1.429 2.649 1.896a1.47 1.47 0 0 0 1.507 0c.78-.467 1.922-1.195 2.623-1.896 1.117-1.039 1.974-2.364 1.974-3.897 0-1.662-1.247-3.142-3.039-3.142-1.065 0-1.792.545-2.338 1.298-.493-.753-1.246-1.298-2.312-1.298" />
    </svg>
  );
}

type ShowcaseCard =
  | {
      id: number;
      kind: 'screen';
      image: string;
      label: string;
      description: string;
      layout: 'top-text' | 'bottom-text';
      bgClass: string;
    }
  | {
      id: number;
      kind: 'mascot';
      label: string;
      description: string;
      bullets: string[];
      bgClass: string;
    };

const SHOWCASE_CARDS: ShowcaseCard[] = [
  {
    id: 1,
    kind: 'screen',
    image: '/shots/anime-home.jpg',
    label: 'All your favorite anime.',
    description: 'See what’s trending, browse new episodes, and check the top 10 right away.',
    layout: 'top-text',
    bgClass: 'bg-[#0C1D2E]',
  },
  {
    id: 2,
    kind: 'screen',
    image: '/shots/explore.jpg',
    label: 'Swipe trailers to find shows.',
    description: 'Scroll through quick anime trailers to discover your next favorite series.',
    layout: 'bottom-text',
    bgClass: 'bg-[#141419]',
  },
  {
    id: 3,
    kind: 'screen',
    image: '/shots/player.jpg',
    label: 'Watch in one tap.',
    description: 'Smooth HD playback with subtitles, skip buttons, and instant next episodes.',
    layout: 'top-text',
    bgClass: 'bg-[#0A253A]',
  },
  {
    id: 4,
    kind: 'screen',
    image: '/shots/episodes.jpg',
    label: 'Download to watch offline.',
    description: 'Save episodes to your phone and watch on flights, commutes, or without Wi-Fi.',
    layout: 'bottom-text',
    bgClass: 'bg-[#17121A]',
  },
  {
    id: 5,
    kind: 'mascot',
    label: 'Made for fans, not ads.',
    description: 'Everything stays right on your device, and you can sync your list anytime.',
    bullets: ['No ads. Ever.', '100% free to use.', 'Offline downloads.', 'Optional Discord sync.'],
    bgClass: 'bg-[#11263C]',
  },
  {
    id: 6,
    kind: 'screen',
    image: '/shots/library.jpg',
    label: 'Keep track of everything.',
    description: 'See what you’ve watched, organize custom lists, and share your profile with friends.',
    layout: 'top-text',
    bgClass: 'bg-[#161B22]',
  },
  {
    id: 7,
    kind: 'screen',
    image: '/shots/manga-home.jpg',
    label: 'Manga, manhwa & manhua.',
    description: 'Browse fresh chapters and trending titles across all your favorite genres.',
    layout: 'bottom-text',
    bgClass: 'bg-[#1D1229]',
  },
  {
    id: 8,
    kind: 'screen',
    image: '/shots/manga-chapters.jpg',
    label: 'Save chapters for later.',
    description: 'Download whole arcs at once and pick up right where you left off.',
    layout: 'top-text',
    bgClass: 'bg-[#191326]',
  },
  {
    id: 9,
    kind: 'screen',
    image: '/shots/manga-reader.jpg',
    label: 'Smooth, clutter-free reading.',
    description: 'Crisp pages, easy scrolling, and one-tap jumps to the next chapter.',
    layout: 'bottom-text',
    bgClass: 'bg-[#211530]',
  },
  {
    id: 10,
    kind: 'screen',
    image: '/shots/ln-home.jpg',
    label: 'Popular light & web novels.',
    description: 'Read hit Japanese, Korean, and Chinese novels right alongside your manga.',
    layout: 'top-text',
    bgClass: 'bg-[#241B0D]',
  },
  {
    id: 11,
    kind: 'screen',
    image: '/shots/ln-chapters.jpg',
    label: 'Thousands of chapters ready.',
    description: 'Bookmark your spot and download chapters so you can read anywhere.',
    layout: 'bottom-text',
    bgClass: 'bg-[#1E170C]',
  },
  {
    id: 12,
    kind: 'screen',
    image: '/shots/ln-reader.jpg',
    label: 'Easy on your eyes at night.',
    description: 'Pick your favorite text size, spacing, and dark theme for late-night reading.',
    layout: 'top-text',
    bgClass: 'bg-[#1A1610]',
  },
];

const BOUNCY_EASE: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

function AnimeFeatureIllustration() {
  return (
    <svg viewBox="0 0 220 150" className="w-44 h-32 mx-auto overflow-visible" fill="none" aria-hidden="true">
      {/* Soft organic pastel blob with bouncy breath */}
      <motion.path
        d="M42 46C24 67 28 104 54 118C74 129 108 116 135 124C164 132 194 112 193 80C192 50 166 26 132 24C99 22 61 24 42 46Z"
        fill="#3DB4F2"
        fillOpacity="0.18"
        animate={{ scale: [1, 1.07, 0.97, 1], rotate: [0, 2, -2, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: BOUNCY_EASE }}
        style={{ transformOrigin: '110px 76px' }}
      />
      <motion.ellipse
        cx="75"
        cy="130"
        rx="18"
        ry="11"
        fill="#3DB4F2"
        fillOpacity="0.16"
        animate={{ scale: [1, 1.18, 0.95, 1] }}
        transition={{ duration: 2.4, delay: 0.2, repeat: Infinity, ease: BOUNCY_EASE }}
        style={{ transformOrigin: '75px 130px' }}
      />

      {/* Cute rounded TV / video player card with squash-and-stretch hop */}
      <motion.g
        animate={{
          y: [0, 3, -10, 1.5, 0],
          scaleX: [1, 1.05, 0.95, 1.02, 1],
          scaleY: [1, 0.94, 1.06, 0.98, 1],
          rotate: [0, -2, 3, -1, 0],
        }}
        transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 0.35, ease: BOUNCY_EASE }}
        style={{ transformOrigin: '110px 108px' }}
      >
        <g transform="rotate(-4 110 76)">
          <rect x="44" y="34" width="132" height="84" rx="16" fill="#1C2736" />
          <rect x="52" y="42" width="116" height="58" rx="10" fill="#0E1726" />
          <rect x="52" y="42" width="116" height="58" rx="10" fill="#3DB4F2" fillOpacity="0.12" />

          {/* Snappy bouncy play button */}
          <motion.g
            animate={{ scale: [1, 0.84, 1.24, 0.95, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 0.4, ease: BOUNCY_EASE }}
            style={{ transformOrigin: '110px 71px' }}
          >
            <circle cx="110" cy="71" r="18" fill="#00A3FF" />
            <path d="M105.5 63.5L118 71L105.5 78.5V63.5Z" fill="#FFFFFF" />
          </motion.g>

          {/* Zippy progress bar */}
          <rect x="54" y="106" width="112" height="5" rx="2.5" fill="#2B3A4E" />
          <motion.rect
            x="54"
            y="106"
            height="5"
            rx="2.5"
            fill="#3DB4F2"
            animate={{ width: [20, 100, 20] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.circle
            cy="108.5"
            r="4.2"
            fill="#FFFFFF"
            animate={{ cx: [74, 154, 74] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </g>
      </motion.g>

      {/* Bouncy HD badge */}
      <motion.g
        animate={{ y: [0, -11, 2, 0], rotate: [0, 12, -4, 0], scale: [1, 1.14, 0.95, 1] }}
        transition={{ duration: 1.9, delay: 0.15, repeat: Infinity, repeatDelay: 0.45, ease: BOUNCY_EASE }}
        style={{ transformOrigin: '169px 37px' }}
      >
        <g transform="rotate(8 172 40)">
          <rect x="150" y="26" width="38" height="22" rx="8" fill="#00A3FF" />
          <text x="169" y="41" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="800" fontFamily="sans-serif">
            HD
          </text>
        </g>
      </motion.g>

      {/* Bouncy subtitle pill */}
      <motion.g
        animate={{ y: [0, -8, 2, 0], rotate: [0, -10, 4, 0], scale: [1, 1.12, 0.96, 1] }}
        transition={{ duration: 2.0, delay: 0.55, repeat: Infinity, repeatDelay: 0.4, ease: BOUNCY_EASE }}
        style={{ transformOrigin: '53px 109px' }}
      >
        <g transform="rotate(-7 54 112)">
          <rect x="30" y="98" width="46" height="22" rx="8" fill="#FBBF24" />
          <rect x="38" y="106" width="30" height="3" rx="1.5" fill="#1C1917" />
          <rect x="42" y="112" width="22" height="3" rx="1.5" fill="#1C1917" fillOpacity="0.65" />
        </g>
      </motion.g>
    </svg>
  );
}

function ReaderFeatureIllustration() {
  return (
    <svg viewBox="0 0 220 150" className="w-44 h-32 mx-auto overflow-visible" fill="none" aria-hidden="true">
      {/* Soft organic pastel purple blob */}
      <motion.path
        d="M36 62C29 90 48 122 82 125C110 128 130 113 158 118C184 123 200 94 190 64C181 36 146 21 112 27C81 32 43 35 36 62Z"
        fill="#C084FC"
        fillOpacity="0.18"
        animate={{ scale: [1, 1.07, 0.97, 1], rotate: [0, -2, 2, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: BOUNCY_EASE }}
        style={{ transformOrigin: '112px 76px' }}
      />
      <motion.ellipse
        cx="164"
        cy="126"
        rx="16"
        ry="10"
        fill="#C084FC"
        fillOpacity="0.16"
        animate={{ scale: [1, 1.2, 0.94, 1] }}
        transition={{ duration: 2.5, delay: 0.25, repeat: Infinity, ease: BOUNCY_EASE }}
        style={{ transformOrigin: '164px 126px' }}
      />

      {/* Back stacked light novel cover popping out playfully */}
      <motion.g
        animate={{ x: [0, 9, -1.5, 0], y: [0, -10, 2, 0], rotate: [0, 9, -2, 0] }}
        transition={{ duration: 2.1, delay: 0.2, repeat: Infinity, repeatDelay: 0.45, ease: BOUNCY_EASE }}
        style={{ transformOrigin: '132px 92px' }}
      >
        <g transform="rotate(10 132 72)">
          <rect x="108" y="32" width="60" height="82" rx="10" fill="#FBBF24" />
          <rect x="116" y="44" width="36" height="6" rx="3" fill="#1C1917" fillOpacity="0.25" />
          <rect x="116" y="55" width="24" height="5" rx="2.5" fill="#1C1917" fillOpacity="0.18" />
          <circle cx="138" cy="86" r="13" fill="#FFFBEB" fillOpacity="0.65" />
        </g>
      </motion.g>

      {/* Front open manga book with squash-and-stretch hop */}
      <motion.g
        animate={{
          y: [0, 3, -9, 1.5, 0],
          scaleX: [1, 1.05, 0.95, 1.02, 1],
          scaleY: [1, 0.94, 1.06, 0.98, 1],
          rotate: [0, -2.5, 2.5, 0],
        }}
        transition={{ duration: 2.3, repeat: Infinity, repeatDelay: 0.35, ease: BOUNCY_EASE }}
        style={{ transformOrigin: '95px 110px' }}
      >
        <g transform="rotate(-6 92 78)">
          <rect x="40" y="38" width="56" height="78" rx="9" fill="#FFFFFF" />
          <rect x="94" y="38" width="56" height="78" rx="9" fill="#F3E8FF" />
          <rect x="92" y="38" width="5" height="78" fill="#C084FC" fillOpacity="0.45" />

          {/* Punchy manga panel highlights */}
          <motion.rect
            x="48"
            y="47"
            width="38"
            height="24"
            rx="4"
            fill="#C084FC"
            animate={{ fillOpacity: [0.3, 0.75, 0.3] }}
            transition={{ duration: 2.2, delay: 0, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.rect
            x="48"
            y="76"
            width="18"
            height="30"
            rx="4"
            fill="#3DB4F2"
            animate={{ fillOpacity: [0.3, 0.75, 0.3] }}
            transition={{ duration: 2.2, delay: 0.55, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.rect
            x="70"
            y="76"
            width="16"
            height="30"
            rx="4"
            fill="#A855F7"
            animate={{ fillOpacity: [0.28, 0.72, 0.28] }}
            transition={{ duration: 2.2, delay: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          />

          <rect x="104" y="50" width="36" height="5" rx="2.5" fill="#9333EA" fillOpacity="0.4" />
          <rect x="104" y="60" width="30" height="4" rx="2" fill="#9333EA" fillOpacity="0.25" />
          <motion.rect
            x="104"
            y="72"
            width="36"
            height="34"
            rx="5"
            fill="#C084FC"
            animate={{ fillOpacity: [0.28, 0.72, 0.28] }}
            transition={{ duration: 2.2, delay: 1.65, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Bouncy bookmark ribbon */}
          <motion.path
            d="M126 32H138V56L132 50L126 56V32Z"
            fill="#9333EA"
            animate={{ y: [0, -9, 2, 0], scaleY: [1, 1.16, 0.92, 1] }}
            transition={{ duration: 1.7, repeat: Infinity, repeatDelay: 0.4, ease: BOUNCY_EASE }}
            style={{ transformOrigin: '132px 32px' }}
          />
        </g>
      </motion.g>
    </svg>
  );
}

function SyncFeatureIllustration() {
  return (
    <svg viewBox="0 0 220 150" className="w-44 h-32 mx-auto overflow-visible" fill="none" aria-hidden="true">
      {/* Soft organic pastel amber + blue blob */}
      <motion.path
        d="M38 78C34 106 60 128 96 125C124 123 145 129 169 116C193 103 196 66 176 44C156 22 117 22 86 33C57 43 42 52 38 78Z"
        fill="#FBBF24"
        fillOpacity="0.17"
        animate={{ scale: [1, 1.07, 0.97, 1], rotate: [0, 2, -2, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: BOUNCY_EASE }}
        style={{ transformOrigin: '114px 76px' }}
      />
      <motion.ellipse
        cx="62"
        cy="40"
        rx="16"
        ry="11"
        fill="#3DB4F2"
        fillOpacity="0.18"
        animate={{ scale: [1, 1.2, 0.94, 1] }}
        transition={{ duration: 2.4, delay: 0.3, repeat: Infinity, ease: BOUNCY_EASE }}
        style={{ transformOrigin: '62px 40px' }}
      />

      {/* Cute laptop bouncing on alternating beat */}
      <motion.g
        animate={{
          y: [0, 2.5, -8, 1.5, 0],
          scaleX: [1, 1.05, 0.96, 1.01, 1],
          scaleY: [1, 0.95, 1.05, 0.98, 1],
          rotate: [0, 2.5, -2, 0],
        }}
        transition={{ duration: 2.1, delay: 0.55, repeat: Infinity, repeatDelay: 0.4, ease: BOUNCY_EASE }}
        style={{ transformOrigin: '138px 108px' }}
      >
        <g transform="rotate(4 138 82)">
          <rect x="92" y="48" width="90" height="58" rx="10" fill="#1F2937" />
          <rect x="99" y="55" width="76" height="44" rx="6" fill="#0F172A" />
          <rect x="106" y="63" width="30" height="28" rx="4" fill="#3DB4F2" fillOpacity="0.5" />
          <rect x="142" y="65" width="26" height="5" rx="2.5" fill="#FFFFFF" fillOpacity="0.5" />
          <rect x="142" y="75" width="20" height="4" rx="2" fill="#FFFFFF" fillOpacity="0.3" />
          <rect x="82" y="106" width="110" height="8" rx="4" fill="#374151" />
        </g>
      </motion.g>

      {/* Cute phone hopping on first beat */}
      <motion.g
        animate={{
          y: [0, 3, -10, 1.5, 0],
          scaleX: [1, 1.06, 0.94, 1.02, 1],
          scaleY: [1, 0.93, 1.07, 0.98, 1],
          rotate: [0, -4, 3, 0],
        }}
        transition={{ duration: 2.1, repeat: Infinity, repeatDelay: 0.4, ease: BOUNCY_EASE }}
        style={{ transformOrigin: '72px 118px' }}
      >
        <g transform="rotate(-7 72 86)">
          <rect x="46" y="42" width="52" height="84" rx="13" fill="#111827" />
          <rect x="52" y="50" width="40" height="68" rx="8" fill="#1E293B" />
          <rect x="57" y="57" width="30" height="22" rx="4" fill="#C084FC" fillOpacity="0.55" />
          <rect x="57" y="84" width="30" height="5" rx="2.5" fill="#FFFFFF" fillOpacity="0.45" />
          <rect x="57" y="93" width="20" height="4" rx="2" fill="#FFFFFF" fillOpacity="0.25" />

          {/* Snappy green checkmark pop */}
          <motion.g
            animate={{ scale: [1, 0.8, 1.28, 0.94, 1], rotate: [0, -10, 8, 0] }}
            transition={{ duration: 1.7, delay: 0.35, repeat: Infinity, repeatDelay: 0.5, ease: BOUNCY_EASE }}
            style={{ transformOrigin: '88px 108px' }}
          >
            <circle cx="88" cy="108" r="13" fill="#10B981" />
            <path d="M82.5 108.5L86.2 112.2L93.5 104.5" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          </motion.g>
        </g>
      </motion.g>

      {/* Juicy squash-and-stretch cloud + brisk bouncing download arrow */}
      <motion.g
        animate={{
          y: [0, -10, 2, 0],
          scaleX: [1, 0.92, 1.09, 1],
          scaleY: [1, 1.1, 0.92, 1],
        }}
        transition={{ duration: 2.0, repeat: Infinity, repeatDelay: 0.35, ease: BOUNCY_EASE }}
        style={{ transformOrigin: '114px 36px' }}
      >
        <path
          d="M95 45H129C135.6 45 141 39.8 141 33.4C141 27.5 136.4 22.6 130.5 22C128.4 15.1 122 10 114.3 10C105.4 10 98.1 16.9 97.4 25.6C92.1 26.5 88 31 88 36.5C88 41.2 91.2 45 95 45Z"
          fill="#00A3FF"
        />
        <motion.path
          d="M114.5 22V35M114.5 35L109.5 30M114.5 35L119.5 30"
          stroke="#FFFFFF"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ y: [-4, 5, -4] }}
          transition={{ duration: 1.15, repeat: Infinity, ease: BOUNCY_EASE }}
        />
      </motion.g>
    </svg>
  );
}

const CORE_FEATURES = [
  {
    illustration: AnimeFeatureIllustration,
    title: 'Watch anime in HD',
    description: 'Play new episodes and classics in one tap, switch between sub and dub, and skip straight to the action.',
  },
  {
    illustration: ReaderFeatureIllustration,
    title: 'Read manga & light novels',
    description: 'Read manga, manhwa, and light novels in a clean, comfy reader made for long reading sessions.',
  },
  {
    illustration: SyncFeatureIllustration,
    title: 'Save offline & pick up anywhere',
    description: 'Download episodes and chapters for trips with no Wi-Fi, and sign in with Discord to keep your list across devices.',
  },
];

function ScreenshotShowcase() {
  return (
    <div className="w-full overflow-hidden py-2">
      <div className="animate-shots-marquee">
        {[0, 1].map((dupIndex) => (
          <div
            key={dupIndex}
            aria-hidden={dupIndex === 1}
            className="flex gap-4 sm:gap-5 pr-4 sm:pr-5 shrink-0"
          >
            {SHOWCASE_CARDS.map((card) => {
              if (card.kind === 'mascot') {
                return (
                  <div
                    key={`${dupIndex}-${card.id}`}
                    className={`relative w-[245px] sm:w-[270px] h-[475px] sm:h-[515px] shrink-0 rounded-[26px] overflow-hidden p-6 flex flex-col justify-between text-white select-none ${card.bgClass}`}
                  >
                    <div className="space-y-3 z-10">
                      <h3 className="font-display font-extrabold text-2xl leading-[1.15] text-white">
                        {card.label}
                      </h3>
                      <p className="text-xs sm:text-[13px] text-white/75 leading-relaxed">
                        {card.description}
                      </p>
                      <ul className="pt-1 space-y-1 text-xs sm:text-[13px] font-semibold text-white/90">
                        {card.bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="relative flex items-end justify-between pt-2">
                      <img
                        src="/yorumi-mascot.png"
                        alt="Yorumi Mascot"
                        className="w-36 sm:w-40 h-auto object-contain -mb-3 -ml-2 pointer-events-none"
                      />
                      <div className="flex items-center gap-2 pb-1">
                        <img src="/yorumi-app-icon.png" alt="Yorumi" className="w-7 h-7 rounded-lg" />
                        <span className="font-display font-extrabold text-base text-white">Yorumi</span>
                      </div>
                    </div>
                  </div>
                );
              }

              const isTopText = card.layout === 'top-text';

              return (
                <div
                  key={`${dupIndex}-${card.id}`}
                  className={`relative w-[245px] sm:w-[270px] h-[475px] sm:h-[515px] shrink-0 rounded-[26px] overflow-hidden text-left flex flex-col justify-between text-white select-none ${card.bgClass}`}
                >
                  {isTopText ? (
                    <>
                      <div className="px-5 pt-6 pb-3 space-y-1.5 shrink-0">
                        <h3 className="font-display font-extrabold text-xl sm:text-[22px] leading-[1.15] text-white">
                          {card.label}
                        </h3>
                        <p className="text-xs text-white/70 leading-relaxed">
                          {card.description}
                        </p>
                      </div>
                      <div className="px-4 pt-1 flex-1 min-h-0 overflow-hidden">
                        <div className="w-full h-full rounded-t-[24px] bg-[#08090d] p-1.5 pb-0 overflow-hidden">
                          <img
                            src={card.image}
                            alt={card.label}
                            loading="lazy"
                            className="w-full h-full object-cover object-top rounded-t-[18px]"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="px-4 pb-1 flex-1 min-h-0 overflow-hidden">
                        <div className="w-full h-full rounded-b-[24px] bg-[#08090d] p-1.5 pt-0 overflow-hidden">
                          <img
                            src={card.image}
                            alt={card.label}
                            loading="lazy"
                            className="w-full h-full object-cover object-top rounded-b-[18px]"
                          />
                        </div>
                      </div>
                      <div className="px-5 pt-3 pb-6 space-y-1.5 shrink-0">
                        <h3 className="font-display font-extrabold text-xl sm:text-[22px] leading-[1.15] text-white">
                          {card.label}
                        </h3>
                        <p className="text-xs text-white/70 leading-relaxed">
                          {card.description}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

interface DesktopShowcaseCard {
  id: string;
  label: string;
  description: string;
  image: string;
  bgClass: string;
  layout: 'top-text' | 'bottom-text';
}

const DESKTOP_SHOWCASE_ROW_1: DesktopShowcaseCard[] = [
  {
    id: 'desk-anime-spotlight',
    label: 'Cinematic anime spotlight.',
    description: 'Jump into trending releases with rich backdrops, ratings, and instant playback.',
    image: '/previews/desktop/anime-spotlight.jpg?v=2',
    bgClass: 'bg-[#0d192e]',
    layout: 'top-text',
  },
  {
    id: 'desk-anime-browse',
    label: 'Browse newest & top rated.',
    description: 'Filter seasonal hits, popular series, and studios in a crisp widescreen grid.',
    image: '/previews/desktop/anime-browse.jpg?v=2',
    bgClass: 'bg-[#101c2d]',
    layout: 'bottom-text',
  },
  {
    id: 'desk-anime-episodes',
    label: 'Every episode, tracked.',
    description: 'Search episodes, download seasons offline, and see your watch progress at a glance.',
    image: '/previews/desktop/anime-episodes.jpg?v=2',
    bgClass: 'bg-[#0e1b30]',
    layout: 'top-text',
  },
  {
    id: 'desk-anime-player',
    label: 'Smooth HD desktop player.',
    description: 'Stream in crisp quality with auto-tracking, quick mark watched, and clean controls.',
    image: '/previews/desktop/anime-player.jpg?v=2',
    bgClass: 'bg-[#121829]',
    layout: 'bottom-text',
  },
  {
    id: 'desk-manga-spotlight',
    label: 'Manga at a glance.',
    description: 'Discover trending manga with chapter counts, scores, and one-click reading.',
    image: '/previews/desktop/manga-spotlight.jpg?v=2',
    bgClass: 'bg-[#1b122b]',
    layout: 'top-text',
  },
  {
    id: 'desk-manga-top100',
    label: 'Top 100 classics & hits.',
    description: 'Explore highest-rated manga ranked from #1 with artwork that pops.',
    image: '/previews/desktop/manga-top100.jpg?v=2',
    bgClass: 'bg-[#201433]',
    layout: 'bottom-text',
  },
  {
    id: 'desk-manga-details',
    label: 'Full chapter lists & downloads.',
    description: 'Filter chapters, save arcs offline, and keep your reading list neatly organized.',
    image: '/previews/desktop/manga-details.jpg?v=2',
    bgClass: 'bg-[#181026]',
    layout: 'top-text',
  },
];

const DESKTOP_SHOWCASE_ROW_2: DesktopShowcaseCard[] = [
  {
    id: 'desk-manga-reader',
    label: 'Distraction-free manga reader.',
    description: 'Zoom, switch chapters, and read full-resolution panels comfortably on desktop.',
    image: '/previews/desktop/manga-reader.jpg?v=2',
    bgClass: 'bg-[#1b122b]',
    layout: 'bottom-text',
  },
  {
    id: 'desk-ln-spotlight',
    label: 'Light & web novels built in.',
    description: 'Switch seamlessly from anime and manga to Japanese, Korean, and Chinese novels.',
    image: '/previews/desktop/ln-spotlight.jpg?v=2',
    bgClass: 'bg-[#241b10]',
    layout: 'top-text',
  },
  {
    id: 'desk-ln-browse',
    label: 'Korean & Chinese web novels.',
    description: 'Browse top-rated series like Solo Leveling, ORV, and Lord of the Mysteries.',
    image: '/previews/desktop/ln-browse.jpg?v=2',
    bgClass: 'bg-[#291e12]',
    layout: 'bottom-text',
  },
  {
    id: 'desk-ln-details',
    label: 'Track hundreds of chapters.',
    description: 'Search chapters, pick up right where you left off, and download for offline reading.',
    image: '/previews/desktop/ln-details.jpg?v=2',
    bgClass: 'bg-[#21180e]',
    layout: 'top-text',
  },
  {
    id: 'desk-ln-reader',
    label: 'Comfy long-form typography.',
    description: 'Customize font size, theme, and spacing for effortless late-night reading.',
    image: '/previews/desktop/ln-reader.jpg?v=2',
    bgClass: 'bg-[#1e1710]',
    layout: 'bottom-text',
  },
  {
    id: 'desk-library',
    label: 'Your anime stats & library.',
    description: 'Track streaks, activity heatmaps, top genres, and custom categories in one place.',
    image: '/previews/desktop/library.jpg?v=2',
    bgClass: 'bg-[#121622]',
    layout: 'top-text',
  },
];

function DesktopShowcaseRow({
  cards,
  direction,
}: {
  cards: DesktopShowcaseCard[];
  direction: 'left' | 'right';
}) {
  return (
    <div className="w-full overflow-hidden marquee-fade-mask py-1">
      <div className={direction === 'left' ? 'animate-shots-marquee-desktop' : 'animate-shots-marquee-reverse'}>
        {[0, 1].map((dupIndex) => (
          <div
            key={dupIndex}
            aria-hidden={dupIndex === 1}
            className="flex gap-4 sm:gap-5 pr-4 sm:pr-5 shrink-0"
          >
            {cards.map((card) => {
              const isTopText = card.layout === 'top-text';
              return (
                <div
                  key={`${dupIndex}-${card.id}`}
                  className={`relative w-[320px] sm:w-[410px] h-[275px] sm:h-[325px] shrink-0 rounded-[24px] overflow-hidden text-left flex flex-col justify-between text-white select-none ${card.bgClass}`}
                >
                  {isTopText ? (
                    <>
                      <div className="px-5 pt-4 pb-2 space-y-1 shrink-0">
                        <h3 className="font-display font-extrabold text-base sm:text-[19px] leading-[1.15] text-white">
                          {card.label}
                        </h3>
                        <p className="text-[11px] sm:text-xs text-white/70 leading-snug">
                          {card.description}
                        </p>
                      </div>
                      <div className="px-3.5 pt-1 flex-1 min-h-0 overflow-hidden">
                        <div className="w-full h-full rounded-t-[16px] bg-[#08090d] p-1 pb-0 overflow-hidden">
                          <img
                            src={card.image}
                            alt={card.label}
                            loading="lazy"
                            className="w-full h-full object-cover object-top rounded-t-[12px]"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="px-3.5 pb-1 flex-1 min-h-0 overflow-hidden">
                        <div className="w-full h-full rounded-b-[16px] bg-[#08090d] p-1 pt-0 overflow-hidden">
                          <img
                            src={card.image}
                            alt={card.label}
                            loading="lazy"
                            className="w-full h-full object-cover object-top rounded-b-[12px]"
                          />
                        </div>
                      </div>
                      <div className="px-5 pt-2 pb-4 space-y-1 shrink-0">
                        <h3 className="font-display font-extrabold text-base sm:text-[19px] leading-[1.15] text-white">
                          {card.label}
                        </h3>
                        <p className="text-[11px] sm:text-xs text-white/70 leading-snug">
                          {card.description}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function DesktopScreenshotShowcase() {
  return (
    <div className="w-full space-y-4 sm:space-y-5">
      <DesktopShowcaseRow cards={DESKTOP_SHOWCASE_ROW_1} direction="left" />
      <DesktopShowcaseRow cards={DESKTOP_SHOWCASE_ROW_2} direction="right" />
    </div>
  );
}

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'get-started' | 'docs'>('home');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDiscordModalOpen, setIsDiscordModalOpen] = useState(false);
  const [isIosInstallModalOpen, setIsIosInstallModalOpen] = useState(false);
  const [starCount, setStarCount] = useState<string>('...');
  const [totalDownloads, setTotalDownloads] = useState<number>(BASE_DOWNLOAD_COUNT);
  const [displayedDownloads, setDisplayedDownloads] = useState<number>(BASE_DOWNLOAD_COUNT);
  const [activeDocTab, setActiveDocTab] = useState<DocTabId>('intro');
  const [docScrollNonce, setDocScrollNonce] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [cliInstallTab, setCliInstallTab] = useState<'windows' | 'unix' | 'scoop'>('windows');
  const [heroDropdown, setHeroDropdown] = useState<'desktop' | 'mobile' | null>(null);
  const [mobileDownloadTab, setMobileDownloadTab] = useState<'mobile' | 'desktop'>(() =>
    typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
      ? 'mobile'
      : 'mobile'
  );
  const heroDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!heroDropdown) return;
    const onPointerDown = (event: MouseEvent) => {
      if (heroDropdownRef.current && !heroDropdownRef.current.contains(event.target as Node)) {
        setHeroDropdown(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHeroDropdown(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [heroDropdown]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(id);
    setTimeout(() => {
      setCopiedCommand((prev) => (prev === id ? null : prev));
    }, 2000);
  };

  const getPathForRoute = (page: 'home' | 'get-started' | 'docs', docTab?: DocTabId): string => {
    if (page === 'get-started') return '/download';
    if (page === 'docs') {
      if (docTab === 'changelogs') return '/changelogs';
      if (docTab && docTab !== 'intro') return `/docs/${docTab}`;
      return '/docs';
    }
    return '/';
  };

  const navigateTo = (page: 'home' | 'get-started' | 'docs', docTab?: DocTabId) => {
    setIsMobileMenuOpen(false);
    setCurrentPage(page);
    if (docTab) {
      setActiveDocTab(docTab);
      setDocScrollNonce((n) => n + 1);
    }
    const nextPath = getPathForRoute(page, docTab);
    if (window.location.pathname !== nextPath || window.location.hash) {
      window.history.pushState({}, '', nextPath);
    }
    if (!(page === 'docs' && docTab && docTab !== 'intro')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenDoc = (tab: DocTabId) => {
    navigateTo('docs', tab);
  };

  const handleSpaLinkClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    action: () => void
  ) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    action();
  };

  const scrollToAnchor = (elementId: string) => {
    setIsMobileMenuOpen(false);
    if (currentPage !== 'home' && ['features', 'previews', 'everywhere'].includes(elementId)) {
      setCurrentPage('home');
      if (window.location.pathname !== '/') {
        window.history.pushState({}, '', `/#${elementId}`);
      }
      setTimeout(() => {
        document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
      return;
    }
    document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const seoByRoute = () => {
      if (currentPage === 'get-started') {
        return {
          title: 'Download Yorumi | Windows, macOS, Linux & Android APK',
          description: `Download Yorumi ${RELEASE_TAG} free for Windows (.exe), macOS (.dmg), Linux (.AppImage), and Android (.apk) — watch anime, read manga & light novels offline.`,
          canonical: 'https://yorumi.cloud/download',
        };
      }
      if (currentPage === 'docs') {
        if (activeDocTab === 'changelogs') {
          return {
            title: `Changelogs & Releases (${RELEASE_TAG}) | Yorumi`,
            description: `Track Yorumi releases, new features, offline improvements, and fixes across Windows, macOS, Linux, and Android.`,
            canonical: 'https://yorumi.cloud/changelogs',
          };
        }
        if (activeDocTab === 'cli') {
          return {
            title: 'Yorumi CLI | Watch Anime from Your Terminal',
            description: 'Install and use yorumi-cli to stream anime directly from your terminal on Windows, macOS, and Linux.',
            canonical: 'https://yorumi.cloud/docs/cli',
          };
        }
        return {
          title: 'Docs & User Guide | Yorumi',
          description: 'Learn how to install Yorumi, sync your library with Discord, configure offline downloads, and self-host.',
          canonical: 'https://yorumi.cloud/docs',
        };
      }
      return {
        title: 'Yorumi | All-in-One Anime, Manga & Light Novel App',
        description: 'Watch anime in HD, read manga & light novels, and download favorites to enjoy offline on Windows, macOS, Linux, and Android — free, open source, with no account needed.',
        canonical: 'https://yorumi.cloud/',
      };
    };

    const meta = seoByRoute();
    document.title = meta.title;
    const descEl = document.querySelector('meta[name="description"]');
    if (descEl) descEl.setAttribute('content', meta.description);
    const canonicalEl = document.querySelector('link[rel="canonical"]');
    if (canonicalEl) canonicalEl.setAttribute('href', meta.canonical);
  }, [currentPage, activeDocTab]);

  useEffect(() => {
    document.documentElement.classList.add('dark');

    const handleBackToTopScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', handleBackToTopScroll, { passive: true });
    handleBackToTopScroll();

    const syncRouteFromLocation = () => {
      const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
      const hash = window.location.hash;

      if (pathname === '/download' || pathname === '/get-started' || hash === '#get-started') {
        setCurrentPage('get-started');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (pathname === '/changelogs' || hash === '#docs-changelogs') {
        setCurrentPage('docs');
        setActiveDocTab('changelogs');
        setDocScrollNonce((n) => n + 1);
        return;
      }
      if (pathname === '/docs' || pathname.startsWith('/docs/') || hash === '#docs' || hash.startsWith('#docs-')) {
        setCurrentPage('docs');
        const fromPath = pathname.startsWith('/docs/') ? pathname.replace('/docs/', '') : '';
        const fromHash = hash.startsWith('#docs-') ? hash.replace('#docs-', '') : '';
        const requestedTab = (fromPath || fromHash || 'intro') as DocTabId;
        if (['intro', 'setup', 'tmdb', 'scraper', 'cli', 'changelogs'].includes(requestedTab)) {
          setActiveDocTab(requestedTab);
          setDocScrollNonce((n) => n + 1);
        }
        return;
      }
      setCurrentPage('home');
      if (hash && ['#features', '#previews', '#everywhere'].includes(hash)) {
        const targetId = hash.slice(1);
        setTimeout(() => {
          document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      }
    };
    window.addEventListener('popstate', syncRouteFromLocation);
    window.addEventListener('hashchange', syncRouteFromLocation);
    syncRouteFromLocation();

    fetch('https://api.github.com/repos/davenarchives/Yorumi')
      .then((res) => res.json())
      .then((data) => {
        if (data.stargazers_count !== undefined) {
          setStarCount(data.stargazers_count.toString());
        }
      })
      .catch(console.error);

    const fetchLatestDownloads = () => {
      fetch('https://api.github.com/repos/davenarchives/Yorumi/releases?per_page=100', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((releases) => {
          if (!Array.isArray(releases)) return;
          const summed = releases.reduce((total: number, release: { assets?: Array<{ download_count?: number }> }) => {
            const assets = Array.isArray(release.assets) ? release.assets : [];
            return total + assets.reduce((sum, asset) => sum + (Number(asset.download_count) || 0), 0);
          }, 0);
          if (summed >= BASE_DOWNLOAD_COUNT) {
            setTotalDownloads(summed);
          }
        })
        .catch(console.error);
    };

    fetchLatestDownloads();
    const downloadRefreshInterval = window.setInterval(fetchLatestDownloads, 5 * 60 * 1000);
    const handleVisibilityRefresh = () => {
      if (document.visibilityState === 'visible') {
        fetchLatestDownloads();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityRefresh);

    return () => {
      window.removeEventListener('scroll', handleBackToTopScroll);
      window.removeEventListener('popstate', syncRouteFromLocation);
      window.removeEventListener('hashchange', syncRouteFromLocation);
      window.clearInterval(downloadRefreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
    };
  }, []);

  const displayedDownloadsRef = useRef(BASE_DOWNLOAD_COUNT);

  // Animate download counter smoothly from 500 upwards to live totalDownloads
  useEffect(() => {
    const startVal = displayedDownloadsRef.current;
    const endVal = Math.max(BASE_DOWNLOAD_COUNT, totalDownloads);
    if (endVal <= startVal) {
      return;
    }

    const durationMs = startVal === BASE_DOWNLOAD_COUNT ? 1400 : 800;
    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextVal = Math.round(startVal + (endVal - startVal) * eased);
      if (nextVal !== displayedDownloadsRef.current) {
        displayedDownloadsRef.current = nextVal;
        setDisplayedDownloads(nextVal);
      }
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [totalDownloads]);

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
    visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 110, damping: 20 } },
  };

  return (
    <div className="min-h-screen font-sans selection:bg-yorumi-main selection:text-white transition-colors duration-500 bg-yorumi-bg text-yorumi-text overflow-x-clip relative z-0">
      {/* Clean Flat Top Header (sticky on Docs & Changelogs) */}
      <header
        className={
          currentPage === 'docs'
            ? 'sticky top-0 z-50 py-4 bg-yorumi-bg/90 backdrop-blur-md border-b border-yorumi-text/8'
            : 'relative z-50 py-5 bg-transparent'
        }
      >
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigateTo('home')}
            className="flex items-center gap-2.5 group cursor-pointer"
          >
            <img
              src="/yorumi-app-icon.png"
              alt="Yorumi"
              className="w-8 h-8 rounded-xl group-hover:scale-105 transition-transform"
            />
            <span className="text-xl font-display font-extrabold tracking-tight text-yorumi-text">
              Yorumi
            </span>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-yorumi-main/15 text-yorumi-main">
              {RELEASE_TAG}
            </span>
          </button>

          <nav className="flex items-center gap-2 sm:gap-5">
            <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-yorumi-muted">
              <a
                href="/#features"
                onClick={(e) => handleSpaLinkClick(e, () => scrollToAnchor('features'))}
                className="hover:text-yorumi-text transition-colors cursor-pointer"
              >
                Features
              </a>
              <a
                href="/#previews"
                onClick={(e) => handleSpaLinkClick(e, () => scrollToAnchor('previews'))}
                className="hover:text-yorumi-text transition-colors cursor-pointer"
              >
                Previews
              </a>
              <a
                href="/docs"
                onClick={(e) => handleSpaLinkClick(e, () => handleOpenDoc('intro'))}
                className="hover:text-yorumi-text transition-colors cursor-pointer"
              >
                Docs
              </a>
              <a
                href="/changelogs"
                onClick={(e) => handleSpaLinkClick(e, () => handleOpenDoc('changelogs'))}
                className="hover:text-yorumi-text transition-colors cursor-pointer"
              >
                Changelogs
              </a>
              <a
                href="https://github.com/davenarchives/Yorumi"
                target="_blank"
                rel="noreferrer"
                className="hover:text-yorumi-text transition-colors inline-flex items-center gap-1.5"
              >
                <GithubIcon className="w-4 h-4" />
                <span className="inline-flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {starCount}
                </span>
              </a>
              <button
                type="button"
                onClick={() => setIsDiscordModalOpen(true)}
                aria-label="Join us on Discord"
                title="Join us on Discord"
                className="hover:text-yorumi-text transition-colors inline-flex items-center justify-center cursor-pointer"
              >
                <DiscordIcon className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={toggleDarkMode}
              className="hidden md:flex relative items-center justify-center w-9 h-9 rounded-full text-yorumi-muted hover:text-yorumi-text hover:bg-yorumi-text/8 transition-colors cursor-pointer"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <a
              href="/download"
              onClick={(e) => handleSpaLinkClick(e, () => navigateTo('get-started'))}
              className="hidden md:inline-flex px-5 py-2 rounded-full bg-yorumi-text text-yorumi-bg font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
            >
              Download Yorumi
            </a>

            {/* Mobile Hamburger Menu Button (Tarsi-style clean square pill) */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl tarsi-card text-yorumi-text active:scale-95 transition-transform cursor-pointer"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </nav>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden max-w-[1200px] mx-auto px-5 pt-3">
            <div className="tarsi-card rounded-[24px] p-4 space-y-1.5">
              {[
                { label: 'Features', onClick: () => scrollToAnchor('features') },
                { label: 'Previews', onClick: () => scrollToAnchor('previews') },
                { label: 'Docs', onClick: () => handleOpenDoc('intro') },
                { label: 'Changelogs', onClick: () => handleOpenDoc('changelogs') },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-bold text-yorumi-text hover:bg-yorumi-bg/60 transition-colors cursor-pointer"
                >
                  {item.label}
                </button>
              ))}

              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl">
                <div className="flex items-center gap-4">
                  <a
                    href="https://github.com/davenarchives/Yorumi"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-bold text-yorumi-muted hover:text-yorumi-text"
                  >
                    <GithubIcon className="w-4 h-4" />
                    <span>GitHub</span>
                    <span className="inline-flex items-center gap-1 text-yorumi-text">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {starCount}
                    </span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsDiscordModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-yorumi-muted hover:text-yorumi-text cursor-pointer"
                  >
                    <DiscordIcon className="w-4 h-4" />
                    <span>Discord</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={toggleDarkMode}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yorumi-bg text-xs font-bold text-yorumi-text cursor-pointer"
                >
                  {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  <span>{isDarkMode ? 'Light' : 'Dark'}</span>
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigateTo('get-started')}
                  className="w-full py-3 rounded-2xl bg-yorumi-main text-white font-bold text-sm active:scale-[0.98] transition-transform cursor-pointer"
                >
                  Download Yorumi
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className={currentPage === 'home' ? 'pt-4 sm:pt-10 lg:pt-14 pb-20' : 'pt-6 sm:pt-12 pb-24 px-5 sm:px-8'}>
        {currentPage === 'home' && (
          <div className="space-y-20 sm:space-y-28 lg:space-y-32">
            {/* 1. HERO SECTION */}
            <section className="max-w-[1200px] mx-auto px-5 sm:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 items-center">
                {/* Left Visual (centered & upright with soft bottom fade on mobile; tilted left on desktop) */}
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 70, damping: 18, delay: 0.1 }}
                  className="lg:col-span-5 relative flex items-center justify-center lg:justify-start pt-1 lg:pt-0"
                >
                  <div className="group relative w-[245px] sm:w-[265px] lg:w-[255px] cursor-pointer">
                    <img
                      src="/yorumi-home.svg"
                      alt="Yorumi Mobile App Preview"
                      className="w-full h-auto block select-none rotate-0 lg:-rotate-[6deg] lg:group-hover:rotate-0 lg:group-hover:scale-[1.03] transition-transform duration-500 ease-out [mask-image:linear-gradient(to_bottom,black_78%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_78%,transparent_100%)] lg:[mask-image:none] lg:[-webkit-mask-image:none]"
                    />

                    {/* Mascot overlapping lower-right of phone, ducks away smoothly on hover */}
                    <img
                      src="/yorumi-mascot.png"
                      alt="Yorumi Mascot"
                      className="pointer-events-none select-none absolute bottom-10 sm:bottom-12 lg:bottom-14 -right-8 sm:-right-12 lg:-right-20 w-40 sm:w-52 lg:w-68 h-auto object-contain z-30 transition-all duration-500 ease-out group-hover:opacity-0 group-hover:translate-x-10 group-hover:translate-y-6 group-hover:scale-90"
                    />
                  </div>
                </motion.div>

                {/* Right Copy (centered on mobile, left-aligned on desktop) */}
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="lg:col-span-7 space-y-5 sm:space-y-6 lg:pl-6 text-center lg:text-left"
                >
                  <motion.h1
                    variants={itemVariants}
                    className="text-[2.15rem] sm:text-5xl lg:text-[3.5rem] font-display font-extrabold leading-[1.14] tracking-tight text-yorumi-text"
                  >
                    Your{' '}
                    <span className="inline-block px-3.5 sm:px-4 py-0.5 rounded-full bg-yorumi-text text-yorumi-bg align-baseline">
                      all-in-one anime
                    </span>{' '}
                    companion.
                  </motion.h1>

                  <motion.p
                    variants={itemVariants}
                    className="text-[15px] sm:text-lg md:text-[19px] text-yorumi-muted leading-[1.9] font-medium max-w-xl mx-auto lg:mx-0"
                  >
                    Watch{' '}
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mx-0.5 rounded-lg bg-yorumi-accent/15 text-yorumi-accent font-bold text-[0.9em] align-middle">
                      <Tv className="w-3.5 h-3.5" />
                      anime
                    </span>{' '}
                    in HD, read{' '}
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mx-0.5 rounded-lg bg-yorumi-manga/15 text-yorumi-manga font-bold text-[0.9em] align-middle">
                      <BookOpen className="w-3.5 h-3.5" />
                      manga
                    </span>{' '}
                    &amp;{' '}
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mx-0.5 rounded-lg bg-yorumi-ln/15 text-yorumi-ln font-bold text-[0.9em] align-middle">
                      <BookText className="w-3.5 h-3.5" />
                      light novels
                    </span>
                    . Download favorites to enjoy{' '}
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mx-0.5 rounded-lg bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 font-bold text-[0.9em] align-middle">
                      <WifiOff className="w-3.5 h-3.5" />
                      offline
                    </span>{' '}
                    on desktop, Android, and iOS — with no account needed.
                  </motion.p>

                  {/* Store / Platform CTA Dropdowns: Desktop & Mobile */}
                  <motion.div
                    ref={heroDropdownRef}
                    variants={itemVariants}
                    className="relative z-40 flex flex-nowrap items-center justify-center lg:justify-start gap-2.5 sm:gap-3 pt-1"
                  >
                    {/* Desktop Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setHeroDropdown((prev) => (prev === 'desktop' ? null : 'desktop'))}
                        aria-expanded={heroDropdown === 'desktop'}
                        className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-2xl bg-yorumi-main hover:bg-yorumi-main/90 text-white font-bold text-xs sm:text-base whitespace-nowrap transition-all hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
                      >
                        <Monitor className="w-4 h-4 shrink-0" />
                        <span>Desktop</span>
                        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${heroDropdown === 'desktop' ? 'rotate-180' : ''}`} />
                      </button>

                      {heroDropdown === 'desktop' && (
                        <div className="absolute left-0 sm:left-0 mt-2.5 w-60 rounded-2xl border border-yorumi-text/10 bg-yorumi-card/95 backdrop-blur-2xl p-2 shadow-2xl text-left z-50">
                          <a
                            href={releaseDownloadUrl('Yorumi.exe')}
                            onClick={() => setHeroDropdown(null)}
                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-yorumi-text/10 transition-colors"
                          >
                            <WindowsIcon className="w-4 h-4 text-yorumi-text shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-yorumi-text">Windows</div>
                              <div className="text-[11px] text-yorumi-muted">Yorumi.exe · Win 10/11</div>
                            </div>
                            <Download className="w-3.5 h-3.5 text-yorumi-muted shrink-0" />
                          </a>
                          <a
                            href={releaseDownloadUrl('Yorumi.dmg')}
                            onClick={() => setHeroDropdown(null)}
                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-yorumi-text/10 transition-colors"
                          >
                            <AppleIcon className="w-4 h-4 text-yorumi-text shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-yorumi-text">macOS</div>
                              <div className="text-[11px] text-yorumi-muted">Yorumi.dmg · Apple Silicon &amp; Intel</div>
                            </div>
                            <Download className="w-3.5 h-3.5 text-yorumi-muted shrink-0" />
                          </a>
                          <a
                            href={releaseDownloadUrl('Yorumi.AppImage')}
                            onClick={() => setHeroDropdown(null)}
                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-yorumi-text/10 transition-colors"
                          >
                            <LinuxIcon className="w-4 h-4 text-yorumi-text shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-yorumi-text">Linux</div>
                              <div className="text-[11px] text-yorumi-muted">Yorumi.AppImage</div>
                            </div>
                            <Download className="w-3.5 h-3.5 text-yorumi-muted shrink-0" />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Mobile Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setHeroDropdown((prev) => (prev === 'mobile' ? null : 'mobile'))}
                        aria-expanded={heroDropdown === 'mobile'}
                        className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-2xl tarsi-card hover:opacity-90 text-yorumi-text font-bold text-xs sm:text-base whitespace-nowrap transition-all hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
                      >
                        <Smartphone className="w-4 h-4 text-yorumi-main shrink-0" />
                        <span>Mobile</span>
                        <ChevronDown className={`w-4 h-4 shrink-0 text-yorumi-muted transition-transform duration-200 ${heroDropdown === 'mobile' ? 'rotate-180' : ''}`} />
                      </button>

                      {heroDropdown === 'mobile' && (
                        <div className="absolute right-0 lg:left-0 lg:right-auto mt-2.5 w-60 rounded-2xl border border-yorumi-text/10 bg-yorumi-card/95 backdrop-blur-2xl p-2 shadow-2xl text-left z-50">
                          <a
                            href={releaseDownloadUrl('Yorumi.apk')}
                            onClick={() => setHeroDropdown(null)}
                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-yorumi-text/10 transition-colors"
                          >
                            <Smartphone className="w-4 h-4 text-yorumi-main shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-yorumi-text">Android</div>
                              <div className="text-[11px] text-yorumi-muted">Yorumi.apk · Phones &amp; Tablets</div>
                            </div>
                            <Download className="w-3.5 h-3.5 text-yorumi-muted shrink-0" />
                          </a>
                          <a
                            href={releaseDownloadUrl('Yorumi.ipa')}
                            onClick={() => setHeroDropdown(null)}
                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-yorumi-text/10 transition-colors"
                          >
                            <AppleIcon className="w-4 h-4 text-yorumi-main shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-yorumi-text">iOS (Beta)</div>
                              <div className="text-[11px] text-yorumi-muted">Yorumi.ipa · Unsigned IPA</div>
                            </div>
                            <Download className="w-3.5 h-3.5 text-yorumi-muted shrink-0" />
                          </a>
                          <div className="my-1 border-t border-yorumi-text/10" />
                          <button
                            type="button"
                            onClick={() => {
                              setHeroDropdown(null);
                              setIsIosInstallModalOpen(true);
                            }}
                            className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold text-yorumi-main hover:bg-yorumi-main/10 transition-colors cursor-pointer"
                          >
                            <span>How to install on iOS</span>
                            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Tarsi-style Overlapping Anime Avatars + Animated Downloads Counter */}
                  <motion.div variants={itemVariants} className="pt-2 space-y-2">
                    <div className="flex items-center justify-center lg:justify-start gap-3 flex-wrap">
                      <div className="flex items-center -space-x-2.5 shrink-0">
                        {COMMUNITY_AVATARS.map((avatar) => (
                          <img
                            key={avatar.name}
                            src={avatar.src}
                            alt={avatar.name}
                            className="w-8 h-8 rounded-full object-cover bg-yorumi-card ring-2 ring-yorumi-bg"
                          />
                        ))}
                      </div>
                      <p className="text-sm sm:text-[15px] font-medium text-yorumi-muted">
                        <span className="relative inline-grid align-baseline font-extrabold text-yorumi-main tabular-nums">
                          <span className="invisible col-start-1 row-start-1" aria-hidden="true">
                            {Math.max(BASE_DOWNLOAD_COUNT, totalDownloads).toLocaleString()}+
                          </span>
                          <span className="col-start-1 row-start-1">
                            {displayedDownloads.toLocaleString()}+
                          </span>
                        </span>{' '}
                        downloads &amp; anime fans already love Yorumi.
                      </p>
                    </div>
                    <p className="text-xs sm:text-sm text-yorumi-muted/85">
                      Developed by{' '}
                      <a
                        href="https://github.com/davenarchives"
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-yorumi-text hover:text-yorumi-main hover:underline transition-colors"
                      >
                        davenarchives
                      </a>
                    </p>
                  </motion.div>
                </motion.div>
              </div>
            </section>

            {/* 2. THREE CORE FEATURE CARDS */}
            <section id="features" className="max-w-[1200px] mx-auto px-5 sm:px-8 scroll-mt-24">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
                {CORE_FEATURES.map((feat) => {
                  const Illustration = feat.illustration;
                  return (
                    <div
                      key={feat.title}
                      className="tarsi-card rounded-[28px] px-7 pt-8 pb-8 sm:px-8 sm:pt-9 sm:pb-9 hover:-translate-y-1 transition-transform duration-300 flex flex-col justify-between"
                    >
                      <div className="mb-6 flex items-center justify-center">
                        <Illustration />
                      </div>
                      <div>
                        <h2 className="font-display font-extrabold text-xl sm:text-[22px] text-yorumi-text leading-snug">
                          {feat.title}
                        </h2>
                        <p className="mt-2 text-sm sm:text-[15px] text-yorumi-muted leading-relaxed">
                          {feat.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 3. HORIZONTAL SCREENSHOT STRIP */}
            <section id="previews" className="scroll-mt-24">
              <ScreenshotShowcase />
            </section>

            {/* 4. CROSS-PLATFORM HIGHLIGHT BLOCK */}
            <section id="everywhere" className="max-w-[1200px] mx-auto px-5 sm:px-8 scroll-mt-24">
              <div className="tarsi-card rounded-[32px] p-7 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center overflow-hidden">
                <div className="lg:col-span-7">
                  <div className="relative rounded-[22px] overflow-hidden bg-black/40 select-none">
                    <video
                      src="/yorumi-vid.mp4"
                      autoPlay
                      loop
                      muted
                      playsInline
                      disablePictureInPicture
                      disableRemotePlayback
                      controlsList="nodownload noplaybackrate noremoteplayback"
                      onEnded={(e) => {
                        e.currentTarget.currentTime = 0;
                        void e.currentTarget.play();
                      }}
                      className="w-full h-auto block object-cover pointer-events-none select-none"
                    />
                    <div className="absolute inset-0 z-10" aria-hidden="true" />
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-4 text-center lg:text-left">
                  <h2 className="text-3xl sm:text-4xl font-display font-extrabold leading-tight tracking-tight text-yorumi-text">
                    On your phone and computer — all in sync.
                  </h2>
                  <p className="text-sm sm:text-base text-yorumi-muted leading-relaxed">
                    Start an episode on Windows, Mac, or Linux, then pick up right where you left off on Android or iOS. Sign in with Discord to keep your watchlist and reading progress backed up automatically.
                  </p>
                  <div className="flex flex-nowrap items-center justify-center lg:justify-start gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => navigateTo('get-started')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-yorumi-text text-yorumi-bg text-sm font-bold whitespace-nowrap hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      <span>Download Yorumi</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDoc('intro')}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-bold whitespace-nowrap text-yorumi-muted hover:text-yorumi-text transition-colors cursor-pointer"
                    >
                      <span>See docs</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* 4B. DESKTOP & WEB 2-ROW OPPOSITE MARQUEE SHOWCASE */}
            <section aria-label="Desktop and web previews">
              <DesktopScreenshotShowcase />
            </section>

            {/* 5 & 6. STACKED CLOSER CTA + COMMUNITY CARDS */}
            <section className="max-w-[1200px] mx-auto px-5 sm:px-8 space-y-6">
              {/* Closer CTA Card */}
              <div className="tarsi-card rounded-[32px] px-6 py-14 sm:py-16 text-center">
                <h2 className="text-3xl sm:text-5xl font-display font-extrabold tracking-tight text-yorumi-text">
                  Start watching today.
                </h2>
                <p className="mt-3 text-base sm:text-lg text-yorumi-muted max-w-lg mx-auto leading-relaxed">
                  No sign-up needed, no ads, and completely free. Download Yorumi on desktop, Android, or iOS in seconds.
                </p>
                <div className="mt-8 flex flex-nowrap items-center justify-center gap-2.5 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => navigateTo('get-started')}
                    className="inline-flex items-center gap-2 px-4 sm:px-7 py-3 sm:py-3.5 rounded-2xl bg-yorumi-main hover:bg-yorumi-main/90 text-white font-bold text-xs sm:text-base whitespace-nowrap transition-all hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span>Download Yorumi</span>
                  </button>
                  <a
                    href="https://github.com/davenarchives/Yorumi"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-3.5 rounded-2xl bg-yorumi-bg hover:opacity-90 text-yorumi-text font-bold text-xs sm:text-base whitespace-nowrap transition-all"
                  >
                    <GithubIcon className="w-4 h-4 shrink-0" />
                    <span>Star on GitHub</span>
                  </a>
                </div>
              </div>

              {/* Community Card with Floating Anime Avatars */}
              <div className="relative rounded-[32px] bg-[#EEF4FF] dark:bg-[#121622] px-6 py-14 sm:py-16 text-center overflow-hidden">
                {/* Scattered floating circular avatars on desktop/tablet */}
                {FLOATING_COMMUNITY_AVATARS.map((avatar) => (
                  <motion.img
                    key={avatar.name}
                    src={avatar.src}
                    alt={avatar.name}
                    animate={{ y: [0, -7, 0] }}
                    transition={{
                      duration: avatar.duration,
                      delay: avatar.delay,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className={`hidden md:block absolute rounded-full object-cover pointer-events-none select-none ${avatar.pos}`}
                  />
                ))}

                <div className="relative z-10 max-w-lg mx-auto">
                  <h2 className="text-2xl sm:text-4xl font-display font-extrabold tracking-tight text-yorumi-text">
                    Join the Yorumi community
                  </h2>
                  <p className="mt-3 text-sm sm:text-base text-yorumi-muted leading-relaxed">
                    Hang out with other anime fans, share your favorite lists, suggest new ideas, or support Yorumi on Ko-fi.
                  </p>
                  <div className="mt-7 flex flex-nowrap items-center justify-center gap-2.5 sm:gap-3">
                    <a
                      href="https://discord.gg/3xzCQvfanb"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 sm:px-6 py-3 rounded-2xl bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs sm:text-sm font-bold whitespace-nowrap transition-colors"
                    >
                      <DiscordIcon className="w-4 h-4 shrink-0" />
                      <span>Join Discord</span>
                    </a>
                    <a
                      href="https://ko-fi.com/yorumii"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 sm:px-6 py-3 rounded-2xl bg-yorumi-bg hover:opacity-90 text-yorumi-text text-xs sm:text-sm font-bold whitespace-nowrap transition-colors"
                    >
                      <KofiIcon className="w-4 h-4 text-yorumi-main shrink-0" />
                      <span>Support on Ko-fi</span>
                    </a>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* DOWNLOADS / GET STARTED PAGE */}
        {currentPage === 'get-started' && (
          <div id="start-using" className="max-w-[1140px] mx-auto space-y-12 sm:space-y-14">
            {/* Clean Header (centered on phone, split on desktop) */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col md:flex-row md:items-end justify-between gap-6 text-center md:text-left"
            >
              <div className="space-y-2.5 max-w-xl mx-auto md:mx-0">
                <h1 className="text-4xl sm:text-5xl font-display font-extrabold tracking-tight text-yorumi-text">
                  Download Yorumi
                </h1>
                <p className="text-base sm:text-lg text-yorumi-muted leading-relaxed">
                  Free and ad-free on Windows, Mac, Linux, Android, and iOS. Pick your device to get started.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenDoc('changelogs')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full tarsi-card hover:opacity-90 text-yorumi-text text-xs sm:text-sm font-bold transition-opacity cursor-pointer"
                >
                  <span>What&apos;s new in {RELEASE_TAG}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <a
                  href={RELEASES_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full tarsi-card hover:opacity-90 text-yorumi-muted hover:text-yorumi-text text-xs sm:text-sm font-bold transition-colors"
                >
                  <span>All releases</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
              </div>
            </motion.div>

            {/* Mobile-only Segmented Platform Switcher (shows Android & iOS immediately at top on phones) */}
            <div className="flex justify-center sm:hidden -mt-4">
              <div className="inline-flex items-center rounded-2xl tarsi-card p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setMobileDownloadTab('mobile')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    mobileDownloadTab === 'mobile'
                      ? 'bg-yorumi-main text-white shadow'
                      : 'text-yorumi-muted hover:text-yorumi-text'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileDownloadTab('desktop')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    mobileDownloadTab === 'desktop'
                      ? 'bg-yorumi-main text-white shadow'
                      : 'text-yorumi-muted hover:text-yorumi-text'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop</span>
                </button>
              </div>
            </div>

            {/* Platform Download Cards */}
            <div id="yorumi-desktop" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                {
                  id: 'windows',
                  group: 'desktop' as const,
                  name: 'Windows',
                  subtitle: 'Windows 10 & 11 (64-bit)',
                  icon: <WindowsIcon className="w-6 h-6" />,
                  cta: 'Download .exe',
                  href: releaseDownloadUrl('Yorumi.exe'),
                  primary: false,
                },
                {
                  id: 'macos',
                  group: 'desktop' as const,
                  name: 'macOS',
                  subtitle: 'Apple Silicon & Intel (10.15+)',
                  icon: <AppleIcon className="w-6 h-6" />,
                  cta: 'Download .dmg',
                  href: releaseDownloadUrl('Yorumi.dmg'),
                  primary: false,
                },
                {
                  id: 'linux',
                  group: 'desktop' as const,
                  name: 'Linux',
                  subtitle: 'Ubuntu, Fedora, Arch & more',
                  icon: <LinuxIcon className="w-6 h-6" />,
                  cta: 'Download .AppImage',
                  href: releaseDownloadUrl('Yorumi.AppImage'),
                  primary: false,
                },
                {
                  id: 'android',
                  group: 'mobile' as const,
                  name: 'Android',
                  subtitle: 'Android 7.0+ phones & tablets',
                  icon: <Smartphone className="w-6 h-6 text-yorumi-main" />,
                  cta: 'Download .apk',
                  href: releaseDownloadUrl('Yorumi.apk'),
                  secondaryLabel: 'All Android files',
                  secondaryHref: RELEASE_URL,
                  primary: true,
                },
                {
                  id: 'ios',
                  group: 'mobile' as const,
                  name: 'iOS (Beta)',
                  subtitle: 'iPhone & iPad via SideStore',
                  icon: <AppleIcon className="w-6 h-6 text-yorumi-main" />,
                  cta: 'Download .ipa',
                  href: releaseDownloadUrl('Yorumi.ipa'),
                  secondaryLabel: 'How to install',
                  onSecondaryClick: () => setIsIosInstallModalOpen(true),
                  primary: false,
                },
              ].map((platform) => (
                <div
                  key={platform.id}
                  id={platform.id === 'android' ? 'yorumi-android' : platform.id === 'ios' ? 'yorumi-ios' : undefined}
                  className={`${
                    platform.group === mobileDownloadTab ? 'flex' : 'hidden sm:flex'
                  } tarsi-card rounded-[28px] p-5 flex-col justify-between gap-7 hover:-translate-y-1 transition-transform duration-300`}
                >
                  <div className="space-y-3">
                    <div className="text-yorumi-text">
                      {platform.icon}
                    </div>
                    <div>
                      <h2 className="text-xl font-display font-extrabold text-yorumi-text">
                        {platform.name}
                      </h2>
                      <p className="mt-1 text-xs sm:text-[13px] text-yorumi-muted leading-relaxed">
                        {platform.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <a
                      href={platform.href}
                      className={`w-full h-11 flex items-center justify-center gap-1.5 px-2.5 rounded-2xl font-bold text-[12px] xl:text-[13px] hover:opacity-90 active:scale-[0.98] transition-all whitespace-nowrap ${
                        platform.primary
                          ? 'bg-yorumi-main text-white'
                          : 'bg-yorumi-text text-yorumi-bg'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span>{platform.cta}</span>
                    </a>
                    {'onSecondaryClick' in platform && platform.onSecondaryClick ? (
                      <button
                        type="button"
                        onClick={platform.onSecondaryClick}
                        className="w-full h-8 flex items-center justify-center text-xs font-semibold text-yorumi-main hover:opacity-80 transition-opacity cursor-pointer"
                      >
                        {platform.secondaryLabel}
                      </button>
                    ) : (
                      <a
                        href={'secondaryHref' in platform && platform.secondaryHref ? platform.secondaryHref : RELEASE_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full h-8 flex items-center justify-center text-xs font-semibold text-yorumi-muted hover:text-yorumi-text transition-colors"
                      >
                        {'secondaryLabel' in platform && platform.secondaryLabel ? platform.secondaryLabel : `All ${platform.name} files`}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* What's New Summary Card */}
            <div className="tarsi-card rounded-[28px] p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <h2 className="text-lg sm:text-xl font-display font-extrabold text-yorumi-text">
                  What&apos;s new in {RELEASE_TAG}
                </h2>
                <p className="text-sm text-yorumi-muted leading-relaxed">
                  Collapsible frosted-glass Tablet Navigation Rail, unsigned iOS (.ipa) beta with SideStore support, Anime/Manga/LN update notifications, faster alternative-title search, batch download picker on Desktop &amp; Tablet, and Explore watch-page fixes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenDoc('changelogs')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-yorumi-bg hover:opacity-90 text-yorumi-text text-sm font-bold transition-opacity shrink-0 self-start lg:self-center cursor-pointer"
              >
                <span>Read full changelog</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Standalone Yorumi CLI Section (Tabbed) */}
            <div id="yorumi-cli" className="tarsi-card rounded-[28px] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <Terminal className="w-5 h-5 text-yorumi-main" />
                    <h2 className="text-xl sm:text-2xl font-display font-extrabold text-yorumi-text">
                      Prefer the terminal? Try Yorumi CLI
                    </h2>
                  </div>
                  <p className="text-sm text-yorumi-muted">
                    Watch and download anime straight from your terminal with mpv or VLC — works on its own with no setup.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href="https://yorumi-cli.vercel.app/docs.html"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-yorumi-bg hover:opacity-90 text-yorumi-text text-xs font-bold transition-opacity"
                  >
                    <span>CLI Docs</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                  </a>
                  <a
                    href="https://github.com/davenarchives/yorumi-cli"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-yorumi-bg hover:opacity-90 text-yorumi-text text-xs font-bold transition-opacity"
                  >
                    <GithubIcon className="w-3.5 h-3.5" />
                    <span>GitHub</span>
                  </a>
                </div>
              </div>

              {(() => {
                const cliTabs = {
                  windows: {
                    label: 'Windows PowerShell',
                    cmd: 'iwr -useb https://raw.githubusercontent.com/davenarchives/yorumi-cli/main/install.ps1 | iex',
                  },
                  unix: {
                    label: 'macOS / Linux',
                    cmd: 'curl -fsSL https://raw.githubusercontent.com/davenarchives/yorumi-cli/main/install.sh | bash',
                  },
                  scoop: {
                    label: 'Scoop',
                    cmd: 'scoop bucket add yorumi https://github.com/davenarchives/yorumi-cli && scoop install yorumi-cli',
                  },
                };
                const activeCli = cliTabs[cliInstallTab];
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {(Object.keys(cliTabs) as Array<'windows' | 'unix' | 'scoop'>).map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setCliInstallTab(key)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                            cliInstallTab === key
                              ? 'bg-yorumi-main text-white'
                              : 'bg-yorumi-bg text-yorumi-muted hover:text-yorumi-text'
                          }`}
                        >
                          {cliTabs[key].label}
                        </button>
                      ))}
                    </div>

                    <div className="rounded-2xl bg-yorumi-bg p-4 flex items-center justify-between gap-4 font-mono text-xs sm:text-sm">
                      <span className="overflow-x-auto whitespace-nowrap no-scrollbar select-all text-yorumi-text font-medium">
                        {activeCli.cmd}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(activeCli.cmd, `cli-${cliInstallTab}`)}
                        className="px-3 py-1.5 rounded-xl tarsi-card hover:opacity-90 text-yorumi-text transition-all shrink-0 flex items-center gap-1.5 text-xs font-sans font-bold cursor-pointer"
                        aria-label="Copy Command"
                      >
                        {copiedCommand === `cli-${cliInstallTab}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-500 hidden sm:inline">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* DOCS PAGE */}
        {currentPage === 'docs' && (
          <div className="max-w-[1320px] mx-auto space-y-10">
            <DocumentationGuide
              activeTab={activeDocTab}
              scrollNonce={docScrollNonce}
              onTabChange={setActiveDocTab}
            />
          </div>
        )}
      </main>

      {/* Floating Back-to-Top Button */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Back to top"
        className={`fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full tarsi-card text-yorumi-text hover:bg-yorumi-main hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer ${
          showBackToTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
      >
        <ArrowUp className="w-5 h-5" />
      </button>

      {/* Join us on Discord Modal */}
      {isDiscordModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none"
          onClick={() => setIsDiscordModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="website-discord-invite-title"
            onClick={(e) => e.stopPropagation()}
            className="w-[360px] max-w-[calc(100vw-32px)] rounded-[24px] overflow-hidden bg-[#141417] shadow-2xl"
          >
            <div className="relative h-52 w-full overflow-hidden bg-[#141417]">
              <img
                src="/discord-invite-banner.gif"
                alt="Yorumi Discord Community"
                className="w-full h-full object-cover object-center"
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
                style={{
                  background:
                    'linear-gradient(to top, #141417 0%, #141417 16%, rgba(20,20,23,0.85) 38%, rgba(20,20,23,0.35) 68%, transparent 100%)',
                }}
              />
            </div>

            <div className="relative z-10 px-6 pb-6 -mt-8">
              <h2
                id="website-discord-invite-title"
                className="font-display text-[22px] font-extrabold tracking-tight text-white"
              >
                Join us on Discord
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-white/70">
                Hang out, suggest things, tell us if something&apos;s broken. Or just to support us.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsDiscordModalOpen(false)}
                  className="h-11 rounded-full bg-white/[0.12] hover:bg-white/[0.18] active:scale-[0.98] text-white text-sm font-bold transition-all cursor-pointer"
                >
                  Not now
                </button>
                <a
                  href="https://discord.gg/3xzCQvfanb"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setIsDiscordModalOpen(false)}
                  className="h-11 rounded-full bg-white hover:bg-white/90 active:scale-[0.98] text-neutral-950 text-sm font-bold inline-flex items-center justify-center gap-2 transition-all"
                >
                  <DiscordIcon className="w-4 h-4" />
                  <span>Join Discord</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* iOS SideStore Install Modal */}
      {isIosInstallModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none"
          onClick={() => setIsIosInstallModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="website-ios-install-title"
            onClick={(e) => e.stopPropagation()}
            className="w-[380px] max-w-[calc(100vw-32px)] rounded-[24px] bg-[#141417] border border-white/[0.08] text-white shadow-2xl p-6"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-white/[0.07] text-white flex items-center justify-center">
                <AppleIcon className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => setIsIosInstallModalOpen(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-full text-white/50 hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h2
              id="website-ios-install-title"
              className="mt-4 font-display text-[22px] font-extrabold tracking-tight text-white"
            >
              Install with SideStore
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/60">
              Install Yorumi on iPhone &amp; iPad and get automatic updates using{' '}
              <a
                href="https://sidestore.io"
                target="_blank"
                rel="noreferrer"
                className="text-white hover:underline font-semibold"
              >
                SideStore
              </a>
              .
            </p>

            <ol className="mt-5 space-y-2.5 text-[13px] text-white/75">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-white/[0.08] text-white/90 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  Set up{' '}
                  <a
                    href="https://sidestore.io"
                    target="_blank"
                    rel="noreferrer"
                    className="text-white underline underline-offset-2 hover:opacity-80"
                  >
                    SideStore
                  </a>{' '}
                  on your iPhone.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-white/[0.08] text-white/90 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span>Tap <strong className="text-white font-semibold">Open in SideStore</strong> below, or paste the source URL.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-white/[0.08] text-white/90 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <span>Tap <strong className="text-white font-semibold">Get</strong> to install Yorumi.</span>
              </li>
            </ol>

            <div className="mt-5 flex items-center gap-2 rounded-xl bg-white/[0.05] border border-white/[0.08] px-3 py-2">
              <code className="text-[11.5px] text-white/75 truncate flex-1 select-all">
                https://yorumi.cloud/source.json
              </code>
              <button
                type="button"
                onClick={() => handleCopy('https://yorumi.cloud/source.json', 'ios-source')}
                aria-label="Copy source URL"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/[0.08] text-[11.5px] font-semibold text-white/80 hover:text-white transition-colors shrink-0 cursor-pointer"
              >
                {copiedCommand === 'ios-source' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <a
                href={releaseDownloadUrl('Yorumi.ipa')}
                onClick={() => setIsIosInstallModalOpen(false)}
                className="h-11 rounded-full bg-white/[0.10] hover:bg-white/[0.16] active:scale-[0.98] text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>.ipa</span>
              </a>
              <a
                href="sidestore://source?url=https://yorumi.cloud/source.json"
                className="h-11 rounded-full bg-white hover:bg-white/90 active:scale-[0.98] text-neutral-950 text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-all"
              >
                <span>Open SideStore</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Clean Flat Multi-Column Footer */}
      <footer className="w-full bg-yorumi-bg">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-14 grid grid-cols-2 md:grid-cols-5 gap-10">
          <div className="col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <img src="/yorumi-app-icon.png" alt="Yorumi" className="w-7 h-7 rounded-lg" />
              <span className="font-display font-extrabold text-lg text-yorumi-text">Yorumi</span>
            </div>
            <p className="text-xs sm:text-sm text-yorumi-muted max-w-xs leading-relaxed">
              Free &amp; open-source anime, manga, and light novel app for desktop and Android.
            </p>
            <p className="text-xs text-yorumi-muted/70 pt-1">
              &copy; {new Date().getFullYear()} Yorumi. All rights reserved.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-yorumi-text">Product</h3>
            <ul className="space-y-2 text-sm text-yorumi-muted">
              <li><a href="/#features" onClick={(e) => handleSpaLinkClick(e, () => scrollToAnchor('features'))} className="hover:text-yorumi-text transition-colors cursor-pointer">Features</a></li>
              <li><a href="/#previews" onClick={(e) => handleSpaLinkClick(e, () => scrollToAnchor('previews'))} className="hover:text-yorumi-text transition-colors cursor-pointer">Previews</a></li>
              <li><a href="/download" onClick={(e) => handleSpaLinkClick(e, () => navigateTo('get-started'))} className="hover:text-yorumi-text transition-colors cursor-pointer">Download</a></li>
              <li><a href="/changelogs" onClick={(e) => handleSpaLinkClick(e, () => handleOpenDoc('changelogs'))} className="hover:text-yorumi-text transition-colors cursor-pointer">Changelogs</a></li>
              <li><a href={RELEASES_URL} target="_blank" rel="noreferrer" className="hover:text-yorumi-text transition-colors">Releases</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-yorumi-text">Learn</h3>
            <ul className="space-y-2 text-sm text-yorumi-muted">
              <li><a href="/docs" onClick={(e) => handleSpaLinkClick(e, () => handleOpenDoc('intro'))} className="hover:text-yorumi-text transition-colors cursor-pointer">User Guide</a></li>
              <li><a href="/docs/setup" onClick={(e) => handleSpaLinkClick(e, () => handleOpenDoc('setup'))} className="hover:text-yorumi-text transition-colors cursor-pointer">Self-Host Setup</a></li>
              <li><a href="/docs/scraper" onClick={(e) => handleSpaLinkClick(e, () => handleOpenDoc('scraper'))} className="hover:text-yorumi-text transition-colors cursor-pointer">Scraper API</a></li>
              <li><a href="/docs/cli" onClick={(e) => handleSpaLinkClick(e, () => handleOpenDoc('cli'))} className="hover:text-yorumi-text transition-colors cursor-pointer">Yorumi CLI</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-yorumi-text">Community</h3>
            <ul className="space-y-2 text-sm text-yorumi-muted">
              <li><a href="https://discord.gg/3xzCQvfanb" target="_blank" rel="noreferrer" className="hover:text-yorumi-text transition-colors">Discord</a></li>
              <li><a href="https://github.com/davenarchives/Yorumi" target="_blank" rel="noreferrer" className="hover:text-yorumi-text transition-colors">GitHub</a></li>
              <li><a href="https://ko-fi.com/yorumii" target="_blank" rel="noreferrer" className="hover:text-yorumi-text transition-colors">Ko-fi</a></li>
              <li><a href="https://github.com/davenarchives/yorumi-cli" target="_blank" rel="noreferrer" className="hover:text-yorumi-text transition-colors">Yorumi CLI</a></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
