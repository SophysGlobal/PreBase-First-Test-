import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { motion } from 'framer-motion'
import { Box, ChevronRight, FileCode, Folder, FolderOpen, Layers, Star, Zap } from 'lucide-react'

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
  isFolder?: boolean
  folderExpanded?: boolean
  childCount?: number
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
  const isFolder = d.isFolder || d.kind === 'folder'
  const Icon = d.isEntry
    ? Star
    : isFolder
      ? d.folderExpanded
        ? FolderOpen
        : Folder
      : (kindIcons[d.kind] ?? FileCode)

  const opacity = d.dimmed ? 0.6 : d.softDimmed ? 0.82 : 1

  let boxShadow: string
  if (d.selected) {
    boxShadow =
      '0 0 0 2px rgba(45,212,191,0.65), 0 0 24px rgba(45,212,191,0.28), 0 6px 32px rgba(16,185,129,0.18), 0 10px 40px rgba(0,0,0,0.35)'
  } else if (d.focused) {
    boxShadow = '0 0 0 1px rgba(45,212,191,0.2), 0 3px 16px rgba(45,212,191,0.08), 0 2px 12px rgba(0,0,0,0.22)'
  } else if (d.highlighted) {
    boxShadow = '0 0 0 1px rgba(45,212,191,0.14), 0 2px 14px rgba(0,0,0,0.2)'
  } else if (d.isEntry) {
    boxShadow = '0 0 28px rgba(245,158,11,0.12), 0 4px 16px rgba(0,0,0,0.22)'
  } else if (isFolder && d.folderExpanded) {
    boxShadow = '0 0 0 1px rgba(113,113,122,0.25), 0 3px 14px rgba(0,0,0,0.2)'
  } else {
    boxShadow = '0 2px 10px rgba(0,0,0,0.18)'
  }

  let background: string
  if (d.selected) {
    background =
      'linear-gradient(145deg, rgba(45,212,191,0.32) 0%, rgba(16,185,129,0.22) 48%, rgba(22, 22, 26, 0.92) 100%)'
  } else if (d.isEntry) {
    background = 'rgba(245,158,11,0.06)'
  } else if (isFolder) {
    background = d.folderExpanded
      ? 'rgba(36,36,40,0.92)'
      : 'rgba(22, 22, 24, 0.94)'
  } else if (d.highlighted && !d.selected) {
    background = 'rgba(45,212,191,0.07)'
  } else {
    background = 'rgba(22, 22, 24, 0.94)'
  }

  let borderColor: string
  if (d.selected) {
    borderColor = 'rgba(45,212,191,0.75)'
  } else if (d.focused && !d.selected) {
    borderColor = 'rgba(45,212,191,0.28)'
  } else if (d.isEntry) {
    borderColor = 'rgba(245,158,11,0.38)'
  } else if (isFolder) {
    borderColor = d.folderExpanded ? 'rgba(161,161,170,0.28)' : 'rgba(255,255,255,0.08)'
  } else if (d.highlighted && !d.selected) {
    borderColor = 'rgba(45,212,191,0.22)'
  } else {
    borderColor = 'rgba(255,255,255,0.06)'
  }

  return (
    <>
      <Handle type="target" position={Position.Left} className="!opacity-0 !w-2 !h-2" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity, scale: 1 }}
        whileHover={{
          scale: 1.025,
          boxShadow: d.selected
            ? boxShadow
            : '0 0 0 1px rgba(45,212,191,0.28), 0 3px 18px rgba(45,212,191,0.1), 0 4px 20px rgba(0,0,0,0.24)'
        }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        title={
          isFolder
            ? `${d.label} — click to ${d.folderExpanded ? 'collapse' : 'expand'}`
            : d.path
              ? `${d.path}\n\n${d.description ?? ''}`
              : d.description
        }
        className={`group relative flex items-center gap-2 rounded-xl backdrop-blur-md cursor-pointer select-none px-3 py-2.5 border ${
          d.selected ? 'ring-1 ring-teal-400/30' : ''
        }`}
        style={{
          width: NODE_WIDTH,
          minHeight: d.isEntry ? ENTRY_HEIGHT : NODE_HEIGHT,
          maxHeight: d.isEntry ? ENTRY_HEIGHT : NODE_HEIGHT,
          background,
          borderColor,
          boxShadow,
          transition: 'background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease'
        }}
      >
        {isFolder && (
          <ChevronRight
            className="w-3 h-3 text-text-muted shrink-0 transition-transform duration-200"
            style={{ transform: d.folderExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
        )}
        <div
          className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-colors duration-150"
          style={{ backgroundColor: `${d.color}1a` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: d.color }} />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span
            className={`text-xs font-medium truncate leading-tight ${
              d.selected ? 'text-teal-50' : 'text-text-primary'
            }`}
          >
            {d.label}
          </span>
          {d.isEntry ? (
            <span className="text-[9px] text-amber-400/80 uppercase tracking-wider mt-0.5">
              Entry
            </span>
          ) : isFolder ? (
            <span className="text-[10px] text-text-muted mt-0.5">
              {d.childCount ?? 0} items · {d.folderExpanded ? 'expanded' : 'collapsed'}
            </span>
          ) : (
            <span
              className="text-[10px] truncate leading-tight mt-0.5"
              style={{ color: d.selected ? 'rgba(45,212,191,0.7)' : 'rgba(161,161,170,0.8)' }}
            >
              {d.path?.split('/').slice(-2).join('/') ?? ''}
            </span>
          )}
        </div>
        {d.meta?.imports && d.meta.imports.length > 0 && !d.isEntry && !isFolder && (
          <span
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] border"
            style={{
              background: d.selected ? 'rgba(45,212,191,0.18)' : 'rgba(36,36,40,1)',
              borderColor: d.selected ? 'rgba(45,212,191,0.35)' : 'rgba(255,255,255,0.08)',
              color: d.selected ? 'rgba(45,212,191,0.9)' : 'rgba(161,161,170,0.9)'
            }}
          >
            {d.meta.imports.length}
          </span>
        )}
      </motion.div>
      <Handle type="source" position={Position.Right} className="!opacity-0 !w-2 !h-2" />
    </>
  )
}

export const ArchitectureNode = memo(ArchitectureNodeComponent)
