import { Sparkles } from 'lucide-react'
import { useGraphStore } from '../../state/graph-store'

const isMac =
  typeof navigator !== 'undefined' &&
  (navigator.platform?.includes('Mac') || /Mac/i.test(navigator.userAgent))

export function TitleBarChrome() {
  const snapshot = useGraphStore((s) => s.snapshot)
  const projectName = snapshot?.projectName

  return (
    <header
      className={`app-titlebar shrink-0 flex items-center border-b border-border-subtle bg-surface/95 backdrop-blur-md z-50 ${
        isMac ? 'app-titlebar--mac' : 'app-titlebar--default'
      }`}
    >
      {/* Traffic-light safe zone + brand chrome */}
      <div className="titlebar-safe-zone flex items-center h-full shrink-0">
        <div className="titlebar-chrome-pill flex items-center gap-2 px-3 py-1.5 ml-1">
          <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
          <span className="text-xs font-semibold tracking-tight text-text-primary">PreBase</span>
          {projectName && (
            <>
              <span className="text-text-muted/50 text-[10px]">/</span>
              <span className="text-[11px] text-text-muted truncate max-w-[140px] titlebar-no-drag">
                {projectName}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Draggable title region */}
      <div className="flex-1 h-full min-w-[80px] titlebar-drag-region" />

      {/* Right spacer balances traffic lights on macOS */}
      {isMac && <div className="titlebar-safe-spacer shrink-0" aria-hidden />}
    </header>
  )
}
