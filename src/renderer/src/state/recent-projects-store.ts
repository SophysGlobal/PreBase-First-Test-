import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface RecentProject {
  id: string
  name: string
  path: string
  lastOpenedAt: string
  fileCount?: number
  dominantLanguage?: string
}

const MAX_RECENT = 3

/** Stable project identity for deduplication (normalized absolute path). */
export function normalizeProjectPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

export function projectIdFromPath(path: string): string {
  return normalizeProjectPath(path)
}

export function projectNameFromPath(path: string): string {
  const normalized = normalizeProjectPath(path)
  const segments = normalized.split('/')
  return segments[segments.length - 1] || normalized
}

interface RecentProjectsStore {
  projects: RecentProject[]
  recordProjectOpen: (input: {
    path: string
    fileCount?: number
    dominantLanguage?: string
  }) => void
  getRecentProjects: () => RecentProject[]
}

export const useRecentProjectsStore = create<RecentProjectsStore>()(
  persist(
    (set, get) => ({
      projects: [],
      recordProjectOpen: ({ path, fileCount, dominantLanguage }) => {
        const id = projectIdFromPath(path)
        const normalizedPath = normalizeProjectPath(path)
        const name = projectNameFromPath(path)
        const now = new Date().toISOString()

        set((state) => {
          const withoutDuplicate = state.projects.filter((p) => p.id !== id)
          const entry: RecentProject = {
            id,
            name,
            path: normalizedPath,
            lastOpenedAt: now,
            ...(fileCount !== undefined ? { fileCount } : {}),
            ...(dominantLanguage ? { dominantLanguage } : {})
          }
          return {
            projects: [entry, ...withoutDuplicate].slice(0, MAX_RECENT)
          }
        })
      },
      getRecentProjects: () => get().projects
    }),
    { name: 'prebase-recent-projects-v1' }
  )
)
