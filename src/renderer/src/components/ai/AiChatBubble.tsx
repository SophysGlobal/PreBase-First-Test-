import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Loader2, PanelRightClose, Send, Sparkles } from 'lucide-react'
import { useGraphStore } from '../../state/graph-store'
import { useSettingsStore, MAGNUS_MODELS } from '../../state/settings-store'
import { useGraphViewportInsets } from '../../features/graph-shared/useGraphViewportInsets'
import type { MagnusMessage } from '../../../../main/ai/magnusService'

interface ChatMessage {
  role: 'user' | 'model'
  content: string
}

/** A concise, externally-visible activity step — never hidden reasoning. */
interface ActivityEvent {
  id: string
  label: string
  status: 'active' | 'done'
}

const SIDEBAR_WIDTH = 268

function buildProjectContext(snapshot: ReturnType<typeof useGraphStore.getState>['snapshot']) {
  if (!snapshot) return {}
  const projectRoot = snapshot.projectPath ?? ''
  const projectName = projectRoot.split('/').pop() ?? 'this project'
  const fileNodes = snapshot.nodes.filter((n) => n.kind !== 'folder')
  const fileCount = fileNodes.length
  const entryNode = snapshot.nodes.find((n) => n.isEntry || n.id === snapshot.entryNodeId)
  const entryFile = entryNode?.path ?? entryNode?.label ?? ''

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

/** Renders a markdown message with styled headings, lists, code, and bold. */
function MdMessage({ content, isUser }: { content: string; isUser: boolean }) {
  if (isUser) {
    return (
      <span className="text-xs leading-relaxed break-words overflow-wrap-anywhere whitespace-pre-wrap">
        {content}
      </span>
    )
  }
  return (
    <div className="magnus-md text-xs leading-relaxed break-words overflow-wrap-anywhere min-w-0">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          h1: ({ children }) => <p className="font-semibold text-text-primary mb-1">{children}</p>,
          h2: ({ children }) => <p className="font-semibold text-text-primary mb-1">{children}</p>,
          h3: ({ children }) => <p className="font-medium text-text-primary mb-0.5">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="leading-snug">{children}</li>,
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-')
            if (isBlock) {
              return (
                <code className="block bg-black/30 border border-white/10 rounded px-2.5 py-2 font-mono text-[11px] text-cyan-300/90 whitespace-pre overflow-x-auto my-1.5">
                  {children}
                </code>
              )
            }
            return (
              <code className="bg-black/25 border border-white/10 rounded px-1 py-0.5 font-mono text-[11px] text-cyan-300/90">
                {children}
              </code>
            )
          },
          pre: ({ children }) => <>{children}</>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-accent/40 pl-2.5 text-text-muted italic my-1">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-accent underline underline-offset-2 hover:opacity-80"
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

/** Compact model picker — shows current model, opens an upward dropdown to change it. */
function ModelPicker({
  selectedId,
  onChange,
  dropdownAlign = 'left'
}: {
  selectedId: string
  onChange: (id: string) => void
  dropdownAlign?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const current = MAGNUS_MODELS.find((m) => m.id === selectedId) ?? MAGNUS_MODELS[0]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-text-secondary hover:text-text-primary hover:bg-white/[0.06] transition-colors"
        title="Select AI model"
      >
        <span className="max-w-[110px] truncate">{current.label}</span>
        <ChevronDown className="w-2.5 h-2.5 opacity-50" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className={`absolute bottom-full mb-2 w-64 rounded-xl border border-border-subtle bg-[#1a1c22] shadow-[0_8px_32px_rgba(0,0,0,0.65)] overflow-hidden z-50 ${
              dropdownAlign === 'left' ? 'left-0' : 'right-0'
            }`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-border-subtle">
              <p className="text-[10px] uppercase tracking-wider text-text-muted">Select model</p>
            </div>
            <div className="p-1.5 space-y-0.5 max-h-64 overflow-y-auto sidebar-scroll">
              {MAGNUS_MODELS.map((m) => {
                const isActive = m.id === selectedId
                const disabled = !m.enabled
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => { if (!disabled) { onChange(m.id); setOpen(false) } }}
                    title={disabled ? m.disabledReason : undefined}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                      disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : isActive
                          ? 'bg-accent/12 border border-accent/20'
                          : 'hover:bg-white/[0.05] border border-transparent'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-medium truncate ${isActive ? 'text-accent' : 'text-text-primary'}`}>
                        {m.label}
                      </p>
                      <p className="text-[10px] text-text-muted truncate">
                        {disabled && m.disabledReason ? m.disabledReason : m.description}
                      </p>
                    </div>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click-outside to close */}
      {open && (
        <div className="fixed inset-0 z-40" onPointerDown={() => setOpen(false)} />
      )}
    </div>
  )
}

/** Cursor-like activity/status feed. Shows only externalized actions — never hidden reasoning. */
function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) return null
  const visible = events.slice(-6)
  return (
    <div className="flex flex-col gap-1 py-0.5">
      {visible.map((ev) => (
        <div key={ev.id} className="flex items-center gap-1.5">
          {ev.status === 'active' ? (
            <span className="magnus-shimmer text-[11px] font-medium">{ev.label}</span>
          ) : (
            <>
              <span className="w-1 h-1 rounded-full bg-accent/60 shrink-0" />
              <span className="text-[11px] text-text-muted">{ev.label}</span>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

/** Small reopen handle shown when Magnus is minimized. */
function MagnusNub({
  isSidebar,
  onOpen,
  rightPx
}: {
  isSidebar: boolean
  onOpen: () => void
  rightPx: number
}) {
  if (isSidebar) {
    return (
      <motion.button
        type="button"
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 8 }}
        whileHover={{ x: -2 }}
        onClick={onOpen}
        title="Open Magnus"
        className="absolute top-1/2 right-0 -translate-y-1/2 z-30 flex items-center gap-1.5 pl-2.5 pr-1.5 py-2.5 rounded-l-xl border border-r-0 border-border-subtle bg-[#141518] text-accent shadow-[-4px_0_16px_rgba(0,0,0,0.35)] hover:shadow-[-4px_0_20px_rgba(45,212,191,0.18)] transition-shadow titlebar-no-drag"
      >
        <Sparkles className="w-3.5 h-3.5" />
      </motion.button>
    )
  }
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.97 }}
      onClick={onOpen}
      title="Open Magnus"
      className="absolute bottom-6 z-30 flex items-center gap-2 px-3.5 py-2 rounded-full border border-border-subtle bg-[#141518] text-text-secondary hover:text-accent hover:border-accent/35 transition-colors shadow-panel titlebar-no-drag"
      style={{ right: rightPx, boxShadow: 'var(--shadow-panel), 0 0 20px rgba(45, 212, 191, 0.08)' }}
    >
      <Sparkles className="w-3.5 h-3.5 text-accent" />
      <span className="text-xs font-medium">Magnus</span>
    </motion.button>
  )
}

/** Shared header bar used in both float and sidebar modes. */
function MagnusHeader({
  onMinimize,
  onClear,
  onPing,
  hasMsgs,
  pinging
}: {
  onMinimize: () => void
  onClear: () => void
  onPing: () => void
  hasMsgs: boolean
  pinging: boolean
}) {
  return (
    <div className="flex items-center justify-between px-3.5 py-3 border-b border-border-subtle bg-gradient-to-r from-accent-soft/30 to-transparent shrink-0">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent-soft border border-accent/20">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
        </div>
        <span className="text-sm font-medium text-text-primary tracking-tight">Magnus</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-surface-muted text-text-muted border border-border-subtle">
          AI
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPing}
          disabled={pinging}
          className="p-1 rounded hover:bg-surface-muted text-text-muted text-[10px] px-2 disabled:opacity-40"
          title="Test Gemini API connection"
        >
          {pinging ? '…' : 'Test'}
        </button>
        {hasMsgs && (
          <button
            type="button"
            onClick={onClear}
            className="p-1 rounded hover:bg-surface-muted text-text-muted text-[10px] px-2"
            title="Clear conversation"
          >
            Clear
          </button>
        )}
        <button
          type="button"
          onClick={onMinimize}
          className="p-1 rounded hover:bg-surface-muted text-text-muted"
          title="Minimize Magnus"
        >
          <PanelRightClose className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

/** Shared messages + input area. */
function MagnusBody({
  messages,
  activity,
  streamingText,
  loading,
  input,
  inputRef,
  messagesEndRef,
  onInput,
  onKeyDown,
  onSend,
  selectedModel,
  onModelChange
}: {
  messages: ChatMessage[]
  activity: ActivityEvent[]
  streamingText: string | null
  loading: boolean
  input: string
  inputRef: React.RefObject<HTMLInputElement>
  messagesEndRef: React.RefObject<HTMLDivElement>
  onInput: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onSend: () => void
  selectedModel: string
  onModelChange: (id: string) => void
}) {
  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto sidebar-scroll p-3 flex flex-col gap-2.5">
        {messages.length === 0 && !loading && (
          <p className="text-xs text-text-secondary leading-relaxed">
            Ask anything — code questions, general knowledge, or project architecture.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col gap-0.5 min-w-0 w-full ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <span className="text-[9px] uppercase tracking-wider text-text-muted">
              {msg.role === 'user' ? 'You' : 'Magnus'}
            </span>
            <div
              className={`rounded-xl px-3 py-2 min-w-0 max-w-[95%] ${
                msg.role === 'user'
                  ? 'bg-accent/15 border border-accent/20 text-text-primary'
                  : 'bg-surface-muted border border-border-subtle text-text-secondary'
              }`}
            >
              <MdMessage content={msg.content} isUser={msg.role === 'user'} />
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex flex-col gap-1 min-w-0 w-full items-start">
            <span className="text-[9px] uppercase tracking-wider text-text-muted">Magnus</span>
            <div className="rounded-xl px-3 py-2 min-w-0 max-w-[95%] bg-surface-muted border border-border-subtle text-text-secondary">
              {streamingText === null ? (
                <ActivityFeed events={activity} />
              ) : (
                <MdMessage content={streamingText} isUser={false} />
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input box — Cursor-style: text on top, toolbar row below */}
      <div className="p-3 border-t border-border-subtle shrink-0">
        <div className="rounded-xl border border-border bg-surface-muted focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/20 transition-colors">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask Magnus anything…"
            disabled={loading}
            className="w-full px-3 pt-2.5 pb-1 text-xs appearance-none bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {/* Bottom toolbar: model picker left, send right */}
          <div className="flex items-center justify-between px-2 pb-2">
            <ModelPicker selectedId={selectedModel} onChange={onModelChange} dropdownAlign="left" />
            <button
              type="button"
              onClick={onSend}
              disabled={!input.trim() || loading}
              className="p-1.5 rounded-lg bg-accent/15 hover:bg-accent/25 border border-accent/20 text-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export function AiChatBubble() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [pinging, setPinging] = useState(false)
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const { magnusRightPx } = useGraphViewportInsets()
  const magnusMode = useSettingsStore((s) => s.magnusMode)
  const magnusModel = useSettingsStore((s) => s.magnusModel)
  const setMagnusModel = useSettingsStore((s) => s.setMagnusModel)
  // Shared across Architecture Graph and Network Graph, and persisted across mode switches.
  const panelState = useSettingsStore((s) => s.magnusPanelState)
  const setPanelState = useSettingsStore((s) => s.setMagnusPanelState)
  const inputRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>
  const messagesEndRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>
  const snapshot = useGraphStore((s) => s.snapshot)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const activityTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isSidebar = magnusMode === 'sidebar'
  const isOpen = panelState === 'open'

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 80)
  }, [isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activity, streamingText])

  useEffect(
    () => () => {
      activityTimersRef.current.forEach(clearTimeout)
      if (streamTimerRef.current) clearInterval(streamTimerRef.current)
    },
    []
  )

  const runPing = async () => {
    setPinging(true)
    try {
      const result = await window.prebase.geminiPing()
      const lines = [
        `Key found: ${result.keyFound} (length: ${result.keyLength})`,
        `Success: ${result.success}`,
        result.response ? `Response: ${result.response}` : '',
        result.rawError ? `Error:\n\`\`\`\n${result.rawError}\n\`\`\`` : ''
      ].filter(Boolean).join('\n')
      setMessages((prev) => [...prev, { role: 'model', content: `**API Test**\n${lines}` }])
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'model', content: `**API Test failed:** ${String(e)}` }])
    } finally {
      setPinging(false)
    }
  }

  /** Streams already-fetched text into view progressively (frontend simulated streaming). */
  const streamInResponse = (fullText: string) =>
    new Promise<void>((resolve) => {
      setStreamingText('')
      let i = 0
      const chunk = Math.max(2, Math.round(fullText.length / 90))
      streamTimerRef.current = setInterval(() => {
        i += chunk
        setStreamingText(fullText.slice(0, i))
        if (i >= fullText.length) {
          if (streamTimerRef.current) clearInterval(streamTimerRef.current)
          streamTimerRef.current = null
          resolve()
        }
      }, 14)
    })

  const sendMessage = async () => {
    const query = input.trim()
    if (!query || loading) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: query }])
    setLoading(true)
    setStreamingText(null)

    const analyzingId = `analyzing-${Date.now()}`
    setActivity([{ id: analyzingId, label: 'Analyzing', status: 'active' }])
    activityTimersRef.current.forEach(clearTimeout)
    activityTimersRef.current = []

    try {
      const ctx = buildProjectContext(snapshot)
      const selectedNode = snapshot?.nodes.find((n) => n.id === selectedNodeId)
      const selectedFilePath = selectedNode?.path ?? selectedNode?.label ?? undefined
      const history: MagnusMessage[] = messages.map((m) => ({ role: m.role, content: m.content }))

      // Externalized activity timeline — status only, no hidden reasoning is ever shown.
      activityTimersRef.current.push(
        setTimeout(() => {
          setActivity((prev) => [
            ...prev.map((e) => (e.id === analyzingId ? { ...e, status: 'done' as const } : e)),
            {
              id: 'ctx',
              label: selectedFilePath ? `Reading ${selectedFilePath}` : 'Reading project context',
              status: 'active'
            }
          ])
        }, 380)
      )
      activityTimersRef.current.push(
        setTimeout(() => {
          setActivity((prev) => [
            ...prev.map((e) => (e.id === 'ctx' ? { ...e, status: 'done' as const } : e)),
            { id: 'gen', label: 'Generating answer', status: 'active' }
          ])
        }, 820)
      )

      const responsePromise = window.prebase.magnusChat({
        query,
        projectRoot: ctx.projectRoot ?? '',
        projectName: ctx.projectName ?? 'this project',
        selectedFilePath,
        fileCount: ctx.fileCount,
        model: magnusModel,
        entryFile: ctx.entryFile,
        topFiles: ctx.topFiles,
        conversationHistory: history
      })

      const { text: response, usedWebSearch, sources } = await responsePromise
      activityTimersRef.current.forEach(clearTimeout)
      setActivity((prev) => {
        const done = prev.map((e) => ({ ...e, status: 'done' as const }))
        // Only ever shown when Gemini's grounding metadata confirms a real search happened.
        if (usedWebSearch) {
          const label = sources.length ? `Searched the web — ${sources[0]}` : 'Searched the web'
          return [...done, { id: 'web', label, status: 'done' as const }]
        }
        return done
      })
      // Brief pause so the completed activity trail (incl. web-search status) is visible
      // before the answer starts streaming in.
      await new Promise((r) => setTimeout(r, usedWebSearch ? 500 : 220))
      await streamInResponse(response)
      setMessages((prev) => [...prev, { role: 'model', content: response }])
    } catch {
      const errorText = 'Error reaching Magnus. Please try again.'
      activityTimersRef.current.forEach(clearTimeout)
      await streamInResponse(errorText)
      setMessages((prev) => [...prev, { role: 'model', content: errorText }])
    } finally {
      setLoading(false)
      setActivity([])
      setStreamingText(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const bodyProps = {
    messages, activity, streamingText, loading, input, inputRef, messagesEndRef,
    onInput: setInput, onKeyDown: handleKeyDown, onSend: sendMessage,
    selectedModel: magnusModel,
    onModelChange: setMagnusModel
  }
  const headerProps = {
    onMinimize: () => setPanelState('minimized'),
    onClear: () => setMessages([]),
    onPing: runPing,
    hasMsgs: messages.length > 0,
    pinging
  }

  // ── SIDEBAR MODE ──────────────────────────────────────────────────────────
  if (isSidebar) {
    return (
      <>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="magnus-sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: SIDEBAR_WIDTH, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              className="absolute top-0 right-0 bottom-0 z-30 flex flex-col bg-[#141518] border-l border-border-subtle overflow-hidden titlebar-no-drag"
              style={{ boxShadow: '-4px 0 24px rgba(0,0,0,0.35)' }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <MagnusHeader {...headerProps} />
              <MagnusBody {...bodyProps} />
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {!isOpen && (
            <MagnusNub isSidebar onOpen={() => setPanelState('open')} rightPx={0} />
          )}
        </AnimatePresence>
      </>
    )
  }

  // ── FLOAT MODE (default) ──────────────────────────────────────────────────
  return (
    <div
      className="absolute bottom-6 z-30 flex flex-col items-end gap-2 titlebar-no-drag transition-[right] duration-200"
      style={{ right: magnusRightPx }}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="magnus-float"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="w-[min(296px,calc(100vw-4rem))] rounded-2xl border border-border-subtle bg-[#141518] shadow-panel overflow-hidden flex flex-col"
            style={{
              maxHeight: 'min(520px, calc(100vh - 120px))',
              boxShadow: 'var(--shadow-panel), 0 0 32px rgba(45, 212, 191, 0.08)'
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <MagnusHeader {...headerProps} />
            <MagnusBody {...bodyProps} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trigger pill also acts as the reopen nub when minimized */}
      {!isOpen && (
        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setPanelState('open')}
          title="Open Magnus"
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-full border border-border-subtle bg-[#141518] text-text-secondary hover:text-text-primary hover:border-accent/35 transition-colors shadow-panel"
          style={{ boxShadow: 'var(--shadow-panel), 0 0 24px rgba(45, 212, 191, 0.06)' }}
        >
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="text-xs font-medium">Magnus</span>
        </motion.button>
      )}
    </div>
  )
}
