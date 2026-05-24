import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'

export function AiChatBubble() {
  const [expanded, setExpanded] = useState(false)
  const [input, setInput] = useState('')

  return (
    <div className="absolute bottom-6 left-6 z-30 flex flex-col items-start gap-2 titlebar-no-drag">
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="w-[min(340px,calc(100vw-3rem))] rounded-2xl border border-border-subtle bg-surface-overlay/85 backdrop-blur-xl shadow-panel overflow-hidden"
            style={{
              boxShadow: 'var(--shadow-panel), 0 0 32px rgba(45, 212, 191, 0.08)'
            }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-gradient-to-r from-accent-soft/30 to-transparent">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent-soft border border-accent/20">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                </div>
                <span className="text-sm font-medium text-text-primary tracking-tight">Magnus</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-surface-muted/80 text-text-muted border border-border-subtle">
                  Soon
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="p-1 rounded hover:bg-surface-muted text-text-muted"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-4 min-h-[100px]">
              <p className="text-xs text-text-secondary leading-relaxed">
                PreBase&apos;s Magnus will understand your dependency graph and explain architecture,
                trace impact, and answer codebase questions — all in context.
              </p>
            </div>
            <div className="p-3 border-t border-border-subtle">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Magnus about your architecture…"
                disabled
                className="w-full px-3 py-2.5 text-xs rounded-xl bg-surface-muted/60 border border-border-subtle text-text-muted placeholder:text-text-muted/70 cursor-not-allowed"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-full border border-border-subtle bg-surface-overlay/75 backdrop-blur-md text-text-secondary hover:text-text-primary hover:border-accent/35 transition-colors shadow-panel"
        style={{ boxShadow: 'var(--shadow-panel), 0 0 24px rgba(45, 212, 191, 0.06)' }}
      >
        <Sparkles className="w-4 h-4 text-accent" />
        {!expanded && <span className="text-xs font-medium">Magnus</span>}
      </motion.button>
    </div>
  )
}
