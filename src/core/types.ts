export type NodeKind = 'folder' | 'file' | 'function' | 'component' | 'service' | 'module'

export type EdgeKind = 'import' | 'export' | 'reference' | 'contains' | 'dependency'

export interface GraphNode {
  id: string
  kind: NodeKind
  label: string
  path?: string
  parentId?: string
  meta?: {
    exports?: string[]
    imports?: string[]
    isComponent?: boolean
    language?: string
  }
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  kind: EdgeKind
}

export interface LayoutPosition {
  x: number
  y: number
}

export interface GraphSnapshot {
  nodes: GraphNode[]
  edges: GraphEdge[]
  positions: Record<string, LayoutPosition>
  projectPath: string
  projectName: string
  scannedAt: number
}

export interface IncrementalUpdate {
  addedNodes: GraphNode[]
  removedNodeIds: string[]
  addedEdges: GraphEdge[]
  removedEdgeIds: string[]
  updatedNodes: GraphNode[]
  positions?: Record<string, LayoutPosition>
}

export interface ParseResult {
  filePath: string
  relativePath: string
  imports: ImportRef[]
  exports: ExportRef[]
  functions: string[]
  components: string[]
  isComponentFile: boolean
}

export interface ImportRef {
  source: string
  specifiers: string[]
  isDefault?: boolean
  line?: number
}

export interface ExportRef {
  name: string
  isDefault?: boolean
  isType?: boolean
}

export interface ScannedFile {
  absolutePath: string
  relativePath: string
  extension: string
}

export type LayoutMode = 'layered' | 'force' | 'clustered'
