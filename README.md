<div align="center">
  <img src="./public/yorumi-icon.svg" alt="Yorumi" width="200" />

  # Y O R U M I &nbsp; ヨルミ
  
  **A N I M E &nbsp; & &nbsp; M A N G A &nbsp; S T R E A M I N G**
  
  ---

  <br>

  <img src="https://img.shields.io/badge/REACT-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TYPESCRIPT-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/EXPRESS.JS-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/TAILWIND-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
</div>

<br>

> A modern, feature-rich platform for streaming anime and reading manga with a premium UI/UX experience.

> [!IMPORTANT]
> **Disclaimer**: This is a personal project built for educational purposes and fun only. It is not intended for commercial use or distribution.

![Yorumi Banner](./screenshots/image.png)

## 📸 Screenshots

<table>
  <tr>
    <td><img src="./screenshots/image-1.png" alt="Anime Streaming" /></td>
    <td><img src="./screenshots/image-2.png" alt="Manga Reader" /></td>
  </tr>
  <tr>
    <td><img src="./screenshots/image-3.png" alt="Search & Filter" /></td>
    <td><img src="./screenshots/image.png" alt="Home View" /></td>
  </tr>
</table>

## ✨ Features

- 🎬 **Anime Streaming**: Seamless video playback with AnimePahe integration
- 📚 **Manga Reader**: Optimized reading experience with MangaKatana scraper
- 🔍 **Advanced Search**: Real-time search and filtering for episodes/chapters
- 🎨 **Premium UI**: Dark-themed, glassmorphic design with smooth animations
- ⚡ **Progressive Loading**: Smart pagination and data fetching for optimal performance
- 🎯 **Episode/Chapter Jump**: Quick search by number for easy navigation
- 📱 **Responsive Design**: Works beautifully across all device sizes

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   App.tsx    │  │  Components  │  │    Styles    │      │
│  │              │  │              │  │  (Tailwind)  │      │
│  └──────┬───────┘  └──────────────┘  └──────────────┘      │
│         │                                                    │
│         │ HTTP Requests (Axios)                             │
└─────────┼────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express.js)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Routes     │  │   Services   │  │   Scrapers   │      │
│  │              │  │              │  │              │      │
│  │ - /api/mal   │  │ - Anime      │  │ - AnimePahe  │      │
│  │ - /api/manga │  │ - Manga      │  │ - MangaKatana│      │
│  │ - /scraper   │  │ - Scraper    │  │ - MAL        │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │               │
│         └─────────────────┴──────────────────┘               │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │  External Sources  │
                    │                    │
                    │  - AnimePahe       │
                    │  - MangaKatana     │
                    │  - MyAnimeList     │
                    └────────────────────┘
```

### Tech Stack

**Frontend**
- React 18 (TypeScript)
- Vite (Build Tool)
- Tailwind CSS (Styling)
- Axios (HTTP Client)

**Backend**
- Node.js (TypeScript)
- Express.js (Server Framework)
- Puppeteer (Browser Automation)
- Cheerio (HTML Parsing)
- Axios (HTTP Requests)

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/davenarchives/yorumi.git
   cd yorumi
   ```

2. Install frontend dependencies
   ```bash
   npm install
   ```

3. Install backend dependencies
   ```bash
   cd backend
   npm install
   cd ..
   ```

### Running the Application

1. Start the backend server
   ```bash
   cd backend
   npm run dev
   ```
   Backend will run on `http://localhost:3001`

2. In a new terminal, start the frontend
   ```bash
   npm run dev
   ```
   Frontend will run on `http://localhost:5173`

3. Open your browser and navigate to `http://localhost:5173`

## 📁 Project Structure

```
yorumi/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── mal/           # MyAnimeList routes
│   │   │   └── scraper/       # Scraper routes & services
│   │   ├── scraper/
│   │   │   ├── animepahe.ts   # AnimePahe scraper
│   │   │   ├── mangakatana.ts # MangaKatana scraper
│   │   │   └── mal.ts         # MAL scraper
│   │   └── index.ts           # Express server entry
│   └── package.json
├── src/
│   ├── App.tsx                # Main React component
│   ├── index.css              # Global styles
│   └── main.tsx               # React entry point
├── public/                    # Static assets
├── README.md
└── package.json
```

## 🔌 API Documentation

### Anime Endpoints

#### Search Anime
```
GET /api/mal/search?q={query}
```

#### Get Top Anime
```
GET /api/mal/top?limit={limit}
```

#### Get Anime Episodes
```
GET /api/scraper/episodes?session={session_id}
```

#### Get Stream Links
```
GET /api/scraper/stream?session={session_id}&episode={episode_id}
```

### Manga Endpoints

#### Search Manga
```
GET /api/manga/search?q={query}
```

#### Get Manga Details
```
GET /api/manga/details/{manga_id}
```

#### Get Chapter List
```
GET /api/manga/chapters/{manga_id}
```

#### Get Chapter Pages
```
GET /api/manga/pages?url={chapter_url}
```

## 🤝 Contributing

This is a personal project, but suggestions and feedback are welcome! Feel free to open an issue if you find bugs or have feature requests.

## 📄 License

This project is licensed under the MIT License - see below for details:

```
MIT License

Copyright (c) 2026 Daven

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## ⚠️ Legal Notice

This project is for **educational purposes only**. The scrapers used in this project access publicly available data. Please respect the terms of service of the websites being scraped. The author is not responsible for any misuse of this software.

---

Made with ❤️ for the anime and manga community.
