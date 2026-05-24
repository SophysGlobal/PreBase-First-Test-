import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Sparkles, X } from 'lucide-react'

export function AiChatBubble() {
  const [expanded, setExpanded] = useState(false)
  const [input, setInput] = useState('')

  return (
    <div className="absolute bottom-6 right-6 z-30 flex flex-col items-end gap-2">
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="w-80 rounded-2xl border border-border-subtle bg-surface-overlay/80 backdrop-blur-xl shadow-panel overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <span className="text-xs font-medium text-text-primary">Architecture AI</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-muted text-text-muted">
                  Soon
                </span>
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="p-1 rounded hover:bg-surface-muted text-text-muted"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-4 min-h-[120px]">
              <p className="text-xs text-text-muted leading-relaxed">
                PreBase will understand your dependency graph and explain architecture,
                trace impact, and answer codebase questions — all in context.
              </p>
            </div>
            <div className="p-3 border-t border-border-subtle">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask PreBase about your architecture..."
                disabled
                className="w-full px-3 py-2.5 text-xs rounded-xl bg-surface-muted/80 border border-border-subtle text-text-muted placeholder:text-text-muted/70 cursor-not-allowed"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-border-subtle bg-surface-overlay/70 backdrop-blur-md text-text-secondary hover:text-text-primary hover:border-accent/30 transition-colors shadow-panel"
      >
        <MessageCircle className="w-4 h-4 text-accent" />
        {!expanded && (
          <span className="text-xs">Ask PreBase...</span>
        )}
      </motion.button>
    </div>
  )
}
