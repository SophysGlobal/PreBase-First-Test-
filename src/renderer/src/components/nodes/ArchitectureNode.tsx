import { memo, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Box, ChevronRight, FileCode, Folder, FolderOpen, Layers, Star, Zap } from 'lucide-react'

export interface ArchitectureNodeData {
  label: string
  kind: string
  path?: string
  color: string
  dimmed?: boolean
  softDimmed?: boolean
  highlighted?: boolean
  searchHighlight?: 'none' | 'soft' | 'strong'
  focused?: boolean
  selected?: boolean
  canDrag?: boolean
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

// Four-sided handles so edges can attach to the side facing the connected node.
// Each side carries both a source and a target handle (ids `s-<side>` / `t-<side>`);
// the edge builder picks the pair based on relative node position.
const SIDE_HANDLES = [
  { side: 'top', position: Position.Top },
  { side: 'right', position: Position.Right },
  { side: 'bottom', position: Position.Bottom },
  { side: 'left', position: Position.Left }
] as const

const kindIcons: Record<string, typeof FileCode> = {
  folder: Folder,
  file: FileCode,
  component: Layers,
  function: Zap,
  service: Box,
  module: FileCode
}

function ArchitectureNodeComponent({ data, selected: rfSelected }: NodeProps) {
  const d = data as unknown as ArchitectureNodeData
  const [hovered, setHovered] = useState(false)
  const isSelected = d.selected || rfSelected
  const isFolder = d.isFolder || d.kind === 'folder'
  const canDrag = d.canDrag === true
  const Icon = d.isEntry
    ? Star
    : isFolder
      ? d.folderExpanded
        ? FolderOpen
        : Folder
      : (kindIcons[d.kind] ?? FileCode)

  const opacity = d.dimmed ? 0.6 : d.softDimmed ? 0.82 : 1

  // LOD shadows: blurred/glowing shadows are expensive to composite and, applied
  // to every node, exhaust raster tile memory. Reserve blur for the few emphasized
  // states (selected / search / entry / hover); the common default uses a flat,
  // blur-free ring so hundreds of nodes stay cheap to paint.
  let boxShadow: string
  if (isSelected) {
    boxShadow = '0 0 0 2px rgba(45,212,191,0.75), 0 4px 14px rgba(0,0,0,0.24)'
  } else if (hovered) {
    boxShadow = '0 0 0 1px rgba(45,212,191,0.42)'
  } else if (d.focused) {
    boxShadow = '0 0 0 1px rgba(45,212,191,0.22)'
  } else if (d.searchHighlight === 'strong') {
    boxShadow = '0 0 0 1.5px rgba(45,212,191,0.5), 0 0 20px rgba(45,212,191,0.2)'
  } else if (d.searchHighlight === 'soft') {
    boxShadow = '0 0 0 1px rgba(45,212,191,0.28)'
  } else if (d.highlighted) {
    boxShadow = '0 0 0 1px rgba(45,212,191,0.18)'
  } else if (d.isEntry) {
    boxShadow = '0 0 0 1px rgba(245,158,11,0.3)'
  } else if (isFolder && d.folderExpanded) {
    boxShadow = '0 0 0 1px rgba(113,113,122,0.25)'
  } else {
    boxShadow = 'none'
  }

  let background: string
  if (isSelected) {
    background =
      'linear-gradient(145deg, rgba(45,212,191,0.38) 0%, rgba(16,185,129,0.26) 50%, rgba(20, 24, 28, 0.95) 100%)'
  } else if (d.isEntry) {
    background = 'rgba(245,158,11,0.06)'
  } else if (isFolder) {
    background = d.folderExpanded
      ? 'rgba(36,36,40,0.92)'
      : 'rgba(22, 22, 24, 0.94)'
  } else if (d.searchHighlight === 'strong' && !isSelected) {
    background = 'rgba(45,212,191,0.14)'
  } else if (d.searchHighlight === 'soft' && !isSelected) {
    background = 'rgba(45,212,191,0.08)'
  } else if (d.highlighted && !isSelected) {
    background = 'rgba(45,212,191,0.07)'
  } else {
    background = 'rgba(22, 22, 24, 0.94)'
  }

  let borderColor: string
  if (isSelected) {
    borderColor = 'rgba(45,212,191,0.85)'
  } else if (hovered) {
    borderColor = 'rgba(45,212,191,0.45)'
  } else if (d.focused && !isSelected) {
    borderColor = 'rgba(45,212,191,0.28)'
  } else if (d.isEntry) {
    borderColor = 'rgba(245,158,11,0.38)'
  } else if (isFolder) {
    borderColor = d.folderExpanded ? 'rgba(161,161,170,0.28)' : 'rgba(255,255,255,0.08)'
  } else if (d.searchHighlight === 'strong' && !isSelected) {
    borderColor = 'rgba(45,212,191,0.55)'
  } else if (d.searchHighlight === 'soft' && !isSelected) {
    borderColor = 'rgba(45,212,191,0.32)'
  } else if (d.highlighted && !isSelected) {
    borderColor = 'rgba(45,212,191,0.22)'
  } else {
    borderColor = 'rgba(255,255,255,0.06)'
  }

  const cursorClass = canDrag ? 'prebase-drag-ready' : 'prebase-nodrag'

  return (
    <>
      {SIDE_HANDLES.map(({ side, position }) => (
        <Handle
          key={`s-${side}`}
          id={`s-${side}`}
          type="source"
          position={position}
          isConnectable={false}
          className="!opacity-0 !w-1.5 !h-1.5 !border-0 !bg-transparent !pointer-events-none"
        />
      ))}
      {SIDE_HANDLES.map(({ side, position }) => (
        <Handle
          key={`t-${side}`}
          id={`t-${side}`}
          type="target"
          position={position}
          isConnectable={false}
          className="!opacity-0 !w-1.5 !h-1.5 !border-0 !bg-transparent !pointer-events-none"
        />
      ))}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={
          isFolder
            ? `${d.label} — click to select, click again to ${d.folderExpanded ? 'collapse' : 'expand'}`
            : d.path
              ? `${d.path}\n\n${d.description ?? ''}`
              : d.description
        }
        className={`architecture-node relative flex items-center gap-2 rounded-xl select-none px-3 py-2.5 border ${cursorClass} ${
          isSelected ? 'ring-1 ring-teal-400/40' : ''
        }`}
        style={{
          width: NODE_WIDTH,
          minHeight: d.isEntry ? ENTRY_HEIGHT : NODE_HEIGHT,
          maxHeight: d.isEntry ? ENTRY_HEIGHT : NODE_HEIGHT,
          background,
          borderColor,
          boxShadow,
          opacity,
          // CSS-only hover scale. Avoids framer-motion promoting EVERY node to its
          // own compositor layer (the main raster-tile-memory contributor).
          transform: hovered && !isSelected ? 'scale(1.05)' : 'none',
          transition:
            'background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.16s ease, opacity 0.18s ease'
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
              isSelected ? 'text-teal-50' : 'text-text-primary'
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
              style={{ color: isSelected ? 'rgba(45,212,191,0.85)' : 'rgba(161,161,170,0.8)' }}
            >
              {d.path?.split('/').slice(-2).join('/') ?? ''}
            </span>
          )}
        </div>
        {d.meta?.imports && d.meta.imports.length > 0 && !d.isEntry && !isFolder && (
          <span
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] border"
            style={{
              background: isSelected ? 'rgba(45,212,191,0.22)' : 'rgba(36,36,40,1)',
              borderColor: isSelected ? 'rgba(45,212,191,0.45)' : 'rgba(255,255,255,0.08)',
              color: isSelected ? 'rgba(45,212,191,0.95)' : 'rgba(161,161,170,0.9)'
            }}
          >
            {d.meta.imports.length}
          </span>
        )}
      </div>
    </>
  )
}

export const ArchitectureNode = memo(ArchitectureNodeComponent)
