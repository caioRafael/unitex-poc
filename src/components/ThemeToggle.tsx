import { THEME_LABELS } from "../theme/theme"
import { useTheme } from "../theme/useTheme"

export function ThemeToggle() {
  const { preference, cycle } = useTheme()
  const label = THEME_LABELS[preference]

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Tema: ${label}. Alternar tema.`}
      className="shrink-0 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-well"
    >
      {label}
    </button>
  )
}
