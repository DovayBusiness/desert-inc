import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import gsap from 'gsap'

// GSAP's default lag smoothing counts any frame gap over 500ms as 33ms, so
// on a slow device the 4s camera intro would crawl in slow motion. Keep
// animations on real wall-clock time instead.
gsap.ticker.lagSmoothing(0)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
