import type { LayoutMode } from '../../../../core/types'
import { useGraphStore } from '../../state/graph-store'
import { CodeExplorerSidebar } from '../sidebar/CodeExplorerSidebar'
import { GraphSidebar } from '../sidebar/GraphSidebar'

interface SecondarySidebarProps {
  onOpenProject: () => void
  onRelayout: (mode: LayoutMode) => void
}

export function SecondarySidebar({ onOpenProject, onRelayout }: SecondarySidebarProps) {
  const viewMode = useGraphStore((s) => s.viewMode)
  const snapshot = useGraphStore((s) => s.snapshot)

  if (!snapshot) return null

  if (viewMode === 'code') {
    return <CodeExplorerSidebar onOpenProject={onOpenProject} />
  }

  return <GraphSidebar onRelayout={onRelayout} />
}
