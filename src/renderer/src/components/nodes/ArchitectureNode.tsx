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
  softDimmed?: boolean
  highlighted?: boolean
  focused?: boolean
  selected?: boolean
  isEntry?: boolean
  description?: string
  meta?: {
    exports?: string[]
    imports?: string[]
    isComponent?: boolean
  }
}

const NODE_WIDTH = 168
const NODE_HEIGHT = 52
const ENTRY_HEIGHT = 58

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

  const opacity = d.dimmed ? 0.72 : d.softDimmed ? 0.88 : 1

  return (
    <>
      <Handle type="target" position={Position.Left} className="!opacity-0 !w-2 !h-2" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity, scale: 1 }}
        whileHover={{ scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        title={d.path ? `${d.path}\n\n${d.description ?? ''}` : d.description}
        className={`
          group relative flex items-center gap-2 rounded-xl
          border backdrop-blur-md cursor-pointer select-none
          transition-[box-shadow,border-color,background-color] duration-250
          px-3 py-2.5
          ${d.selected ? 'border-accent/45 bg-accent-soft' : 'border-border-subtle bg-surface-overlay/94'}
          ${d.focused && !d.selected ? 'border-accent/30' : ''}
          ${d.isEntry ? '!border-amber-500/35 !bg-amber-500/6' : ''}
          ${d.highlighted && !d.selected && !d.isEntry ? 'border-accent/25 bg-accent-soft/60' : ''}
        `}
        style={{
          width: NODE_WIDTH,
          minHeight: d.isEntry ? ENTRY_HEIGHT : NODE_HEIGHT,
          maxHeight: d.isEntry ? ENTRY_HEIGHT : NODE_HEIGHT,
          boxShadow: d.selected
            ? '0 0 0 1px rgba(45,212,191,0.12), 0 4px 20px rgba(45,212,191,0.1)'
            : d.isEntry
              ? '0 0 24px rgba(245,158,11,0.1), 0 2px 12px rgba(0,0,0,0.2)'
              : '0 2px 10px rgba(0,0,0,0.18)'
        }}
      >
        <div
          className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
          style={{ backgroundColor: `${d.color}1a` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: d.color }} />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-medium text-text-primary truncate leading-tight">
            {d.label}
          </span>
          {d.isEntry ? (
            <span className="text-[9px] text-amber-400/75 uppercase tracking-wider mt-0.5">
              Entry
            </span>
          ) : (
            <span className="text-[10px] text-text-muted truncate leading-tight mt-0.5">
              {d.path?.split('/').slice(-2).join('/') ?? ''}
            </span>
          )}
        </div>
        {d.meta?.imports && d.meta.imports.length > 0 && !d.isEntry && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-muted px-1 text-[9px] text-text-secondary border border-border-subtle">
            {d.meta.imports.length}
          </span>
        )}
      </motion.div>
      <Handle type="source" position={Position.Right} className="!opacity-0 !w-2 !h-2" />
    </>
  )
}

export const ArchitectureNode = memo(ArchitectureNodeComponent)
