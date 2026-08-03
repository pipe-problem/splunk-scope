import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource-variable/inter'
import './index.css'
import App from './App.jsx'
import { AppProvider } from './context/AppContext.jsx'
import { ToastProvider } from './components/layout/Toast.jsx'
import ErrorBoundary from './components/layout/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <AppProvider>
        <ToastProvider>
          <ErrorBoundary fallbackMessage="Splunk Scope encountered an error. Your session data is preserved in localStorage.">
            <App />
          </ErrorBoundary>
        </ToastProvider>
      </AppProvider>
    </HashRouter>
  </StrictMode>,
)
