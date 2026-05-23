import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { motion } from 'framer-motion'
import { Box, FileCode, Folder, Layers, Zap } from 'lucide-react'

export interface ArchitectureNodeData {
  label: string
  kind: string
  path?: string
  color: string
  dimmed?: boolean
  highlighted?: boolean
  focused?: boolean
  meta?: {
    exports?: string[]
    imports?: string[]
    isComponent?: boolean
  }
}

const kindIcons: Record<string, typeof FileCode> = {
  folder: Folder,
  file: FileCode,
  component: Layers,
  function: Zap,
  service: Box,
  module: FileCode
}

function ArchitectureNodeComponent({ data }: NodeProps) {
  const d = data as unknown as ArchitectureNodeData
  const Icon = kindIcons[d.kind] ?? FileCode

  return (
    <>
      <Handle type="target" position={Position.Left} className="!opacity-0 !w-2 !h-2" />
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{
          opacity: d.dimmed ? 0.25 : 1,
          scale: d.focused ? 1.04 : 1
        }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className={`
          group relative flex items-center gap-2 px-3 py-2 rounded-xl
          border backdrop-blur-sm cursor-pointer select-none
          transition-shadow duration-300
          ${d.focused ? 'border-accent/60 shadow-glow' : 'border-border-subtle'}
          ${d.highlighted ? 'bg-accent-soft' : 'bg-surface-overlay/90'}
        `}
        style={{
          minWidth: d.kind === 'folder' ? 120 : 100,
          boxShadow: d.focused ? `0 0 24px ${d.color}33` : undefined
        }}
      >
        <div
          className="flex items-center justify-center w-6 h-6 rounded-lg shrink-0"
          style={{ backgroundColor: `${d.color}22` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: d.color }} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-medium text-text-primary truncate max-w-[140px]">
            {d.label}
          </span>
          {d.path && d.kind !== 'folder' && (
            <span className="text-[10px] text-text-muted truncate max-w-[140px]">{d.path}</span>
          )}
        </div>
        {d.meta?.imports && d.meta.imports.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-muted px-1 text-[9px] text-text-secondary">
            {d.meta.imports.length}
          </span>
        )}
      </motion.div>
      <Handle type="source" position={Position.Right} className="!opacity-0 !w-2 !h-2" />
    </>
  )
}

export const ArchitectureNode = memo(ArchitectureNodeComponent)
