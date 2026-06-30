import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Send, Sparkles, X } from 'lucide-react'
import { useGraphStore } from '../../state/graph-store'
import { useGraphViewportInsets } from '../../features/graph-shared/useGraphViewportInsets'
import type { MagnusMessage } from '../../../../main/ai/magnusService'

interface ChatMessage {
  role: 'user' | 'model'
  content: string
}

function buildProjectContext(snapshot: ReturnType<typeof useGraphStore.getState>['snapshot']) {
  if (!snapshot) return {}
  const projectRoot = snapshot.projectPath ?? ''
  const projectName = projectRoot.split('/').pop() ?? 'this project'
  const fileNodes = snapshot.nodes.filter((n) => n.kind !== 'folder')
  const fileCount = fileNodes.length
  const entryNode = snapshot.nodes.find((n) => n.isEntry || n.id === snapshot.entryNodeId)
  const entryFile = entryNode?.path ?? entryNode?.label ?? ''

  // Top files by connection count
  const connectionCount = new Map<string, number>()
  for (const edge of snapshot.edges) {
    connectionCount.set(edge.source, (connectionCount.get(edge.source) ?? 0) + 1)
    connectionCount.set(edge.target, (connectionCount.get(edge.target) ?? 0) + 1)
  }
  const topFiles = fileNodes
    .filter((n) => n.path)
    .sort((a, b) => (connectionCount.get(b.id) ?? 0) - (connectionCount.get(a.id) ?? 0))
    .slice(0, 8)
    .map((n) => n.path ?? n.label)

  return { projectRoot, projectName, fileCount, entryFile, topFiles }
}

export function AiChatBubble() {
  const [expanded, setExpanded] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [pinging, setPinging] = useState(false)
  const { magnusRightPx } = useGraphViewportInsets()
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const snapshot = useGraphStore((s) => s.snapshot)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)

  const runPing = async () => {
    setPinging(true)
    try {
      const result = await window.prebase.geminiPing()
      const lines = [
        `Key found: ${result.keyFound} (length: ${result.keyLength})`,
        `Success: ${result.success}`,
        result.response ? `Response: ${result.response}` : '',
        result.rawError ? `Error: ${result.rawError}` : ''
      ].filter(Boolean).join('\n')
      setMessages((prev) => [...prev, { role: 'model', content: `[API Test]\n${lines}` }])
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'model', content: `[API Test] IPC failed: ${String(e)}` }])
    } finally {
      setPinging(false)
    }
  }

  useEffect(() => {
    if (expanded) {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [expanded])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const sendMessage = async () => {
    const query = input.trim()
    if (!query || loading) return

    setInput('')
    const userMsg: ChatMessage = { role: 'user', content: query }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    try {
      const ctx = buildProjectContext(snapshot)
      const selectedNode = snapshot?.nodes.find((n) => n.id === selectedNodeId)
      const selectedFilePath = selectedNode?.path ?? selectedNode?.label ?? undefined

      const history: MagnusMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content
      }))

      const response = await window.prebase.magnusChat({
        query,
        projectRoot: ctx.projectRoot ?? '',
        projectName: ctx.projectName ?? 'this project',
        selectedFilePath,
        fileCount: ctx.fileCount,
        entryFile: ctx.entryFile,
        topFiles: ctx.topFiles,
        conversationHistory: history
      })

      setMessages((prev) => [...prev, { role: 'model', content: response }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'model', content: 'Error reaching Magnus. Please try again.' }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div
      className="absolute bottom-6 z-30 flex flex-col items-end gap-2 titlebar-no-drag transition-[right] duration-200"
      style={{ right: magnusRightPx }}
    >
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="w-[min(320px,calc(100vw-4rem))] rounded-2xl border border-border-subtle bg-[#141518] shadow-panel overflow-hidden"
            style={{
              boxShadow: 'var(--shadow-panel), 0 0 32px rgba(45, 212, 191, 0.08)'
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-gradient-to-r from-accent-soft/30 to-transparent">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent-soft border border-accent/20">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                </div>
                <span className="text-sm font-medium text-text-primary tracking-tight">Magnus</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-surface-muted/80 text-text-muted border border-border-subtle">
                  AI
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={runPing}
                  disabled={pinging}
                  className="p-1 rounded hover:bg-surface-muted text-text-muted text-[10px] px-2 disabled:opacity-40"
                  title="Test Gemini API connection and show raw diagnostic"
                >
                  {pinging ? '…' : 'Test API'}
                </button>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMessages([])}
                    className="p-1 rounded hover:bg-surface-muted text-text-muted text-[10px] px-2"
                    title="Clear conversation"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="p-1 rounded hover:bg-surface-muted text-text-muted"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex flex-col min-h-[80px] max-h-[320px] overflow-y-auto sidebar-scroll p-3 gap-2.5">
              {messages.length === 0 && !loading && (
                <p className="text-xs text-text-secondary leading-relaxed">
                  Ask me about this project&apos;s code, architecture, files, or dependencies.
                </p>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col gap-0.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[9px] uppercase tracking-wider text-text-muted">
                    {msg.role === 'user' ? 'You' : 'Magnus'}
                  </span>
                  <div
                    className={`rounded-xl px-3 py-2 text-xs leading-relaxed max-w-[92%] whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-accent/15 border border-accent/20 text-text-primary'
                        : 'bg-surface-muted/60 border border-border-subtle text-text-secondary'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-text-muted">
                  <Loader2 className="w-3 h-3 animate-spin text-accent/70" />
                  <span className="text-[11px] italic">Magnus is thinking…</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border-subtle flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about this project's code…"
                disabled={loading}
                className="flex-1 px-3 py-2 text-xs rounded-xl appearance-none bg-surface-muted border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="p-2 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent/20 text-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-full border border-border-subtle bg-[#141518] text-text-secondary hover:text-text-primary hover:border-accent/35 transition-colors shadow-panel"
        style={{ boxShadow: 'var(--shadow-panel), 0 0 24px rgba(45, 212, 191, 0.06)' }}
      >
        <Sparkles className="w-4 h-4 text-accent" />
        {!expanded && <span className="text-xs font-medium">Magnus</span>}
      </motion.button>
    </div>
  )
}
