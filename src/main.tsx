import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

import { AnimeProvider } from './context/AnimeContext';
import { AuthProvider } from './context/AuthContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AnimeProvider>
          <App />
        </AnimeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
