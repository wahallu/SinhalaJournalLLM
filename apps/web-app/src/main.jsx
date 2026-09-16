import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthProvider.jsx'

/* The splash lives in index.html so it can paint before this bundle parses.
   Removed here rather than left for React: React only owns #root's children
   from the first render onward, and letting it reconcile the node away costs
   a visible extra frame. */
document.getElementById('sinai-splash')?.remove()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

