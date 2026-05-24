import type { ReactNode } from 'react'
import { TitleBarChrome } from './TitleBarChrome'

interface AppShellProps {
  children: ReactNode
  showTitlebar?: boolean
}

export function AppShell({ children, showTitlebar = true }: AppShellProps) {
  return (
    <div className="flex flex-col h-screen w-screen bg-surface overflow-hidden">
      {showTitlebar && <TitleBarChrome />}
      <div className="flex flex-1 min-h-0 min-w-0">{children}</div>
    </div>
  )
}
