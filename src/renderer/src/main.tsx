import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import { setupMonaco } from './monaco/setup'
import { useTheme } from './hooks/useTheme'

setupMonaco()

function Root() {
  useTheme()
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
