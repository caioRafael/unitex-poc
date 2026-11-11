import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/cascadia-mono/latin-400.css'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './theme/ThemeProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
