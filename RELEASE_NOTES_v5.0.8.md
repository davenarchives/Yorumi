Yorumi **v5.0.8** introduces a **collapsible frosted-glass Tablet Navigation Rail**, **unsigned iOS (`.ipa`) Beta builds** with SideStore/AltStore support, **Manga & Light Novel chapter push notifications**, **faster alternative-title Search**, a **batch download picker on Desktop & Tablet**, and **Explore & caption polish**.

## New Features
- **Tablet Navigation Rail & Collapsible Sidebar**: Tablets (`>= 768px`) now get a clean bare-icon frosted-glass navigation rail (`84px`) with a Hide/Show toggle, PC-style frosted `SearchModal`, frosted-glass Menu & sub-drawers extending cleanly to the top edge, and full desktop-style Explore in landscape.
- **iOS Unsigned `.ipa` (Beta) & SideStore Repo**: Added native iOS Swift plugins (`ImmersiveModePlugin`, `LocalMediaProxyPlugin` with HLS `.m3u8` + image referer proxying, and YouTube HUD cleaner), automated `macos-latest` unsigned `Yorumi.ipa` builds, and a 1-tap SideStore/AltStore repository at `https://yorumi.cloud/source.json`.
- **Manga & Light Novel Update Notifications**: Extended native Android push notifications and the in-app **Updates** list to notify for new **Manga** and **Light Novel** chapters alongside airing **Anime** episodes, deep-linking straight to the matching details page.
- **Batch Download Picker on Desktop & Tablet**: Clicking the Download button on Anime, Manga, or Light Novel details on Desktop and Tablet now opens the same batch selector (`Next 1`, `Next 5`, `Next 10`, `Next 25`, `Unread/Unwatched`, `All`, `Custom`) as phones.

## Improvements
- **Faster Search & Full Alternative-Title Matching**: Switched Anime search to AniList-first with 3-minute in-memory caching so English, Romaji, Native, and official synonyms resolve in ~200ms; bounded slow NovelBin/MangaKatana scraping (`2.2s`) and Render User Search (`2.5s`); and tightened debounce to `140ms`.
- **Japanese Light Novel Edition Priority**: Updated the novel resolver across Desktop and Mobile to probe `<slug>-ln` / `<slug>-light-novel` first and skip explicit `(WN)` / `Web Novel` pages when a Japanese Light Novel edition exists (while keeping Korean & Chinese Web Novels on AllNovelFull/NovelFire).
- **Full-Screen Manga & Light Novel Readers**: Removed the hardcoded `70px` left sidebar offset and hid the sidebar on `/manga/read/` and `/ln/read/` so readers run 100% edge-to-edge on tablets and desktop.
- **Refined Caption Sizing**: Scaled video player subtitles cleanly across phones (`11px` portrait, `clamp(13px, 3.4vh, 22px)` fullscreen), tablets, and desktop (`15px` inline, `clamp(16px, 2.5vh, 21px)` fullscreen).
- **Website Polish (`yorumi.cloud`)**: Centered all landing page sections on phone view and added the **iOS (Beta)** `.ipa` + SideStore download card.

## Fixes
- **Explore Swipe-to-Details Watch Page**: Fixed tapping an episode or **Play** inside mobile Explore's swipe-to-details sheet failing to display the watch player, and updated Android hardware Back to close the player before closing the details sheet.
- **Zero-Jump Explore Scrolling**: Fixed the 16:9 trailer jumping upward by ~27px after settling on mobile Explore by keeping the `Full screen` pill rendered consistently on every slide.
- **Tablet Landscape Orientation Lock**: Fixed opening Explore on tablets forcing portrait orientation by leaving tablets in free rotation on `exitLandscape`.

## Under the hood
- **Release Alignment**: Updated app, Tauri, Android (`versionCode 508`), iOS (`508`), website (`yorumi.cloud`), SideStore `source.json`, and CI/CD release workflows (Desktop + Android + iOS) to `v5.0.8`.
