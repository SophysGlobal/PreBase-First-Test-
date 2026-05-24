import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { motion } from 'framer-motion'
import { Box, FileCode, Folder, Layers, Star, Zap } from 'lucide-react'

export interface ArchitectureNodeData {
  label: string
  kind: string
  path?: string
  color: string
  dimmed?: boolean
  highlighted?: boolean
  focused?: boolean
  selected?: boolean
  isEntry?: boolean
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
  const Icon = d.isEntry ? Star : (kindIcons[d.kind] ?? FileCode)
  const scale = d.isEntry ? 1.08 : d.focused ? 1.04 : d.selected ? 1.02 : 1

  return (
    <>
      <Handle type="target" position={Position.Left} className="!opacity-0 !w-2 !h-2" />
      <motion.div
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{
          opacity: d.dimmed ? 0.2 : 1,
          scale
        }}
        whileHover={{ scale: scale * 1.03 }}
        transition={{ type: 'spring', stiffness: 420, damping: 26 }}
        className={`
          group relative flex items-center gap-2.5 rounded-xl
          border backdrop-blur-md cursor-pointer select-none
          transition-[box-shadow,border-color] duration-300
          ${d.isEntry ? 'px-4 py-3 border-amber-500/40 bg-amber-500/5' : 'px-3 py-2'}
          ${d.selected ? 'border-accent/50 ring-1 ring-accent/20' : ''}
          ${d.focused && !d.isEntry ? 'border-accent/60 shadow-glow' : ''}
          ${!d.isEntry && !d.focused && !d.selected ? 'border-border-subtle' : ''}
          ${d.highlighted && !d.isEntry ? 'bg-accent-soft/60' : !d.isEntry ? 'bg-surface-overlay/92' : ''}
        `}
        style={{
          minWidth: d.isEntry ? 160 : d.kind === 'folder' ? 120 : 110,
          boxShadow: d.isEntry
            ? '0 0 32px rgba(245,158,11,0.15), 0 4px 24px rgba(0,0,0,0.3)'
            : d.focused
              ? `0 0 24px ${d.color}33`
              : '0 2px 12px rgba(0,0,0,0.2)'
        }}
      >
        <div
          className={`flex items-center justify-center rounded-lg shrink-0 ${d.isEntry ? 'w-8 h-8' : 'w-6 h-6'}`}
          style={{ backgroundColor: `${d.color}22` }}
        >
          <Icon className={d.isEntry ? 'w-4 h-4' : 'w-3.5 h-3.5'} style={{ color: d.color }} />
        </div>
        <div className="flex flex-col min-w-0">
          <span
            className={`font-medium text-text-primary truncate ${d.isEntry ? 'text-sm max-w-[160px]' : 'text-xs max-w-[140px]'}`}
          >
            {d.label}
          </span>
          {d.path && d.kind !== 'folder' && (
            <span className="text-[10px] text-text-muted truncate max-w-[150px]">{d.path}</span>
          )}
          {d.isEntry && (
            <span className="text-[9px] text-amber-400/80 uppercase tracking-wider mt-0.5">
              Entry point
            </span>
          )}
        </div>
        {d.meta?.imports && d.meta.imports.length > 0 && !d.isEntry && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-muted px-1 text-[9px] text-text-secondary border border-border-subtle">
            {d.meta.imports.length}
          </span>
        )}
      </motion.div>
      <Handle type="source" position={Position.Right} className="!opacity-0 !w-2 !h-2" />
    </>
  )
}

export const ArchitectureNode = memo(ArchitectureNodeComponent)
