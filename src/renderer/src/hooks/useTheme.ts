import { useEffect } from 'react'
import { resolveTheme, useSettingsStore } from '../state/settings-store'

export function useTheme() {
  const theme = useSettingsStore((s) => s.theme)
  const reduceMotion = useSettingsStore((s) => s.reduceMotion)
  const uiDensity = useSettingsStore((s) => s.uiDensity)

  useEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(theme)
      document.documentElement.dataset.theme = resolved
      document.documentElement.dataset.density = uiDensity
      document.documentElement.classList.toggle('reduce-motion', reduceMotion)
    }

    apply()

    if (theme !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme, reduceMotion, uiDensity])
}
