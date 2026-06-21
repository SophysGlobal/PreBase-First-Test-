import { motion } from 'framer-motion'
import { FolderOpen, GitBranch, Sparkles, Zap } from 'lucide-react'
import { RecentProjectsBlock } from './RecentProjectsBlock'

interface WelcomeScreenProps {
  onOpenProject: () => void
  onOpenProjectPath: (path: string) => void
  isLoading: boolean
}

const features = [
  {
    icon: GitBranch,
    title: 'Dependency mapping',
    description: 'Visualize imports and module relationships in real time'
  },
  {
    icon: Zap,
    title: 'Live architecture',
    description: 'Watch your graph evolve as you change code'
  },
  {
    icon: Sparkles,
    title: 'Spatial navigation',
    description: 'Build a mental map of your system'
  }
]

export function WelcomeScreen({ onOpenProject, onOpenProjectPath, isLoading }: WelcomeScreenProps) {
  return (
    <div className="flex flex-1 items-center justify-center relative overflow-hidden overflow-y-auto py-10">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.08)_0%,_transparent_70%)]" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center max-w-2xl px-8 text-center"
      >
        <div className="flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-gradient-to-br from-accent/20 to-purple-500/10 border border-border-subtle">
          <Sparkles className="w-8 h-8 text-accent" />
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-text-primary mb-2">
          PreBase
        </h1>
        <p className="text-text-secondary text-sm leading-relaxed mb-8 max-w-lg">
          Transform your codebase into a living visual system. Open a local project to explore
          architecture, dependencies, and structure in real time.
        </p>

        <button
          onClick={onOpenProject}
          disabled={isLoading}
          className="group flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-surface font-medium text-sm hover:bg-zinc-100 disabled:opacity-50 transition-all shadow-lg shadow-black/20"
        >
          <FolderOpen className="w-4 h-4" />
          {isLoading ? 'Scanning project...' : 'Open Project'}
        </button>

        <RecentProjectsBlock onOpenProjectPath={onOpenProjectPath} isLoading={isLoading} />

        <div className="grid grid-cols-3 gap-4 mt-12 w-full max-w-xl">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08 }}
              className="flex flex-col items-center p-4 rounded-xl bg-surface-overlay/50 border border-border-subtle"
            >
              <f.icon className="w-5 h-5 text-accent mb-2" />
              <p className="text-xs font-medium text-text-primary mb-1">{f.title}</p>
              <p className="text-[10px] text-text-muted leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
