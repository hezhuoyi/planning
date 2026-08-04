import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { enablePressFeedback } from './lib/pressFeedback'
import { registerPwaUpdates } from './lib/pwa'
import { initTheme } from './lib/theme'

initTheme()
registerPwaUpdates()
enablePressFeedback()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
