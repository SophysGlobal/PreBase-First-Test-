import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface InfoTooltipProps {
  title: string
  body: string
  side?: 'top' | 'bottom' | 'right'
}

export function InfoTooltip({ title, body, side = 'right' }: InfoTooltipProps) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open || !anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const gap = 8
    if (side === 'right') {
      setPos({ top: rect.top, left: rect.right + gap })
    } else if (side === 'bottom') {
      setPos({ top: rect.bottom + gap, left: rect.left })
    } else {
      setPos({ top: rect.top - gap, left: rect.left })
    }
  }, [open, side])

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="titlebar-no-drag p-0.5 rounded text-text-muted/70 hover:text-text-secondary hover:bg-surface-muted/60 transition-colors"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={`Info: ${title}`}
      >
        <Info className="w-3 h-3" />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
              className="pointer-events-none w-56 p-3 rounded-xl border border-border-subtle bg-surface-overlay/95 backdrop-blur-xl shadow-panel"
              onMouseEnter={() => setOpen(true)}
              onMouseLeave={() => setOpen(false)}
            >
              <p className="text-[11px] font-medium text-text-primary mb-1">{title}</p>
              <p className="text-[10px] text-text-secondary leading-relaxed">{body}</p>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
