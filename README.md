<div align="center">
  <img src="./public/Yorumi.png" alt="Yorumi" width="200" />

  # Y O R U M I &nbsp; ヨルミ
  
  **A N I M E &nbsp; & &nbsp; M A N G A &nbsp; S T R E A M I N G**
  
  ---

  <br>

  <img src="https://img.shields.io/badge/REACT-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TYPESCRIPT-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/ELECTRON-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/EXPRESS.JS-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/REDIS-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/FIREBASE-FFCA28?style=for-the-badge&logo=firebase&logoColor=white" alt="Firebase" />
  <img src="https://img.shields.io/badge/FANART.TV-3B5998?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNOCA0TDEwIDhMOCAxMkw2IDhaIiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==&logoColor=white" alt="Fanart.tv" />
</div>

<br>

> A modern, feature-rich desktop and web platform for streaming anime and reading manga with a premium UI/UX experience.

<br>

> [!CAUTION]
> ## ⚠️ EDUCATIONAL PURPOSE ONLY - HEAVY DISCLAIMER
> 
> **PLEASE READ CAREFULLY BEFORE USING OR CONTRIBUTING:**
>
> 1.  **No Content Ownership**: This project does **NOT** host, store, or distribute any copyrighted files (videos, images, or audio). All content is scraped in real-time from third-party publicly available sources (e.g., AnimePahe, MangaKatana, AniList).
> 2.  **Educational Use**: This source code is strictly for **educational and research purposes**. It demonstrates modern web development techniques, scraping algorithms, and application architecture.
> 3.  **Legal Liability**: The developers and contributors of this repository assume **NO LIABILITY** for any misuse of this software. Users are solely responsible for ensuring their usage complies with local laws and the Terms of Service of the source websites.
> 4.  **No Commercial Use**: This project is **NOT** for sale and should not be used for any commercial activities.

<br>

![Yorumi Banner](./screenshots/animepage.png)

## ✨ Features

- **🎬 Unified Streaming Experience**: Seamlessly watch anime with HLS support and auto-quality selection.
- **📚 Integrated Manga Reader**: High-performance manga reader with vertical/horizontal modes and infinite scrolling.
- **⚡ Advanced Scraper Engine**: 
    - Real-time data fetching from multiple sources.
    - **Fuzzy Matching**: Intelligent title matching using `fuzzball` to bridge metadata differences between AniList and content sources.
    - **Cloudflare Bypass**: Integrated Puppeteer strategies to handle protected sources.
- **🚀 Performance First**: 
    - **Redis Caching**: Server-side caching for API responses, search results, and stream links.
    - **Lazy Loading**: Progressive image loading and component code-splitting.
- **🎨 Premium UI/UX**: 
    - Glassmorphic design system using **Tailwind CSS**.
    - Smooth animations with **Framer Motion** (implied via UI quality).
    - Responsive layout for Desktop (Electron) and Web.
- **☁️ Cloud Sync**: **Firebase** integration for syncing user progress, bookmarks, and settings across devices.
- **🖥️ Cross-Platform**: Built with **Electron** to run natively on Windows, macOS, and Linux.

## 📸 Screenshots

### Desktop View
<table>
  <tr>
    <td width="50%">
      <img src="./screenshots/animepage.png" alt="Anime Page" width="100%" />
      <p align="center"><b>Anime Discovery</b></p>
    </td>
    <td width="50%">
      <img src="./screenshots/animedetails.png" alt="Anime Details" width="100%" />
      <p align="center"><b>Anime Details</b></p>
    </td>
  </tr>
  <tr>
    <td>
      <img src="./screenshots/mangapage.png" alt="Manga Page" width="100%" />
      <p align="center"><b>Manga Discovery</b></p>
    </td>
    <td>
      <img src="./screenshots/mangadetails.png" alt="Manga Details" width="100%" />
      <p align="center"><b>Manga Details</b></p>
    </td>
  </tr>
  <tr>
    <td>
      <img src="./screenshots/animeplayer.png" alt="Anime Player" width="100%" />
      <p align="center"><b>Video Player</b></p>
    </td>
    <td>
      <img src="./screenshots/mangareader.png" alt="Manga Reader" width="100%" />
      <p align="center"><b>Manga Reader</b></p>
    </td>
  </tr>
   <tr>
    <td colspan="2">
      <img src="./screenshots/profilepage.png" alt="User Profile" width="100%" />
      <p align="center"><b>User Profile</b></p>
    </td>
  </tr>
</table>

### Mobile Responsiveness
<table>
  <tr>
    <td width="33%"><img src="./screenshots/mobileresponsiveness.png" alt="Mobile Home" width="100%" /></td>
    <td width="33%"><img src="./screenshots/mobileresponsiveness2.png" alt="Mobile Details" width="100%" /></td>
    <td width="33%"><img src="./screenshots/mobileresponsiveness3.png" alt="Mobile Player" width="100%" /></td>
  </tr>
</table>

## 🏗️ Architecture

Yorumi allows for a hybrid architecture, running as a standalone Electron application or a traditional Client-Server web app.

```mermaid
graph TD
    User[End User] --> Client[Electron / Web Client]
    
    subgraph Frontend [Frontend Layer]
        Client
        React[React 19]
        State[Context API + Hooks]
    end
    
    subgraph Backend [Backend Layer]
        API[Express API]
        Scraper[Scraper Engine]
        Cache[Redis / Upstash]
    end
    
    subgraph External [External Services]
        AniList[AniList API]
        Fanart[Fanart.tv API]
        Sources[AnimePahe / MangaKatana]
        Firebase[Firebase Auth & DB]
    end

    Client -- HTTP/REST --> API
    Client -- Auth --> Firebase
    
    API -- GraphQL --> AniList
    API -- REST --> Fanart
    API -- Caching --> Cache
    API -- Scraping --> Scraper
    
    Scraper -- Puppeteer/Cheerio --> Sources
```

### 🛠️ Tech Stack

#### **Frontend (Electron / Web)**
- **Core**: React 19, TypeScript
- **Build Tool**: Vite (Rolldown)
- **Styling**: Tailwind CSS, PostCSS
- **State Management**: React Hooks & Context
- **Routing**: React Router v7
- **Video**: HLS.js
- **Icons**: Lucide React
- **Electron**: Electron 28 (Main/Renderer process IPC)

#### **Backend (API & Scraper)**
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database / Cache**: Redis (@upstash/redis) for high-performance caching.
- **Scraping**: 
    - **Puppeteer Core**: Headless browser automation for dynamic sites.
    - **Cheerio**: Lightweight HTML parsing for static content.
    - **Fuzzball**: Fuzzy logic string matching for reliable search results.
- **API Clients**: 
    - GraphQL Request (for AniList)
    - Axios (for Fanart.tv and HTTP requests)
- **External APIs**:
    - **Fanart.tv**: Anime title logo artwork
    - **AniList**: Anime/manga metadata
    - **Fribb/anime-lists**: AniList to TVDB ID mapping

#### **DevOps & Tools**
- **Linting**: ESLint, Prettier
- **Package Manager**: npm
- **Bundler**: Electron Builder

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** or **yarn**
- **Redis Instance** (Optional but recommended for performance. Local or Upstash)

### Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/davenarchives/yorumi.git
    cd yorumi
    ```

2.  **Install Root Dependencies (Frontend + Electron)**
    ```bash
    npm install
    ```

3.  **Install Backend Dependencies**
    ```bash
    cd backend
    npm install
    cd ..
    ```

### Running Locally (Web Mode)

To run the application as a standard web app (Client + Server):

1.  **Start the Backend**
    ```bash
    cd backend
    npm run dev
    ```
    *Server runs on `http://localhost:3001`*

2.  **Start the Frontend** (in a new terminal)
    ```bash
    npm run dev
    ```
    *Client runs on `http://localhost:5173`*

### Running Locally (Electron Mode)

To launch the full desktop experience:

```bash
npm run electron:dev
```
*This concurrently starts the Vite dev server, Backend API, and Electron wrapper.*

## 📁 Project Structure

```bash
yorumi/
├── backend/                 # Express API & Scraper Server
│   ├── src/
│   │   ├── api/             # REST API Controllers (AniList, Manga, etc.)
│   │   ├── scraper/         # Scraping Logic (AnimePahe, MangaKatana)
│   │   └── index.ts         # Server Entry Point
├── electron/                # Electron Main Process Code
├── src/                     # React Frontend Code
│   ├── components/          # Reusable UI Components
│   ├── features/            # Feature-based Modules (Anime, Manga, Player)
│   ├── hooks/               # Custom React Hooks
│   ├── pages/               # Page Views
│   ├── services/            # Frontend API Services
│   ├── types/               # TypeScript Definitions
│   └── App.tsx              # Main App Component
├── public/                  # Static Assets
└── package.json             # Root Config & Scripts
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1.  Fork the repository.
2.  Create a feature branch: `git checkout -b feature/amazing-feature`.
3.  Commit your changes: `git commit -m 'feat: Add amazing feature'`.
4.  Push to the branch: `git push origin feature/amazing-feature`.
5.  Open a Pull Request.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

**Made with ❤️ by Daven**
