import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { ThemeContext } from "./context"
import {
  applyTheme,
  cyclePreference,
  readPreference,
  resolveTheme,
  writePreference,
  type ThemePreference,
} from "./theme"

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(readPreference)
  // Forces a new read of the OS theme while the preference stays on system.
  const [systemTick, setSystemTick] = useState(0)
  const resolved = resolveTheme(preference)

  useEffect(() => {
    writePreference(preference)
    applyTheme(resolved)
  }, [preference, resolved, systemTick])

  useEffect(() => {
    if (preference !== "system") return
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const sync = () => setSystemTick((tick) => tick + 1)
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [preference])

  const cycle = useCallback(() => {
    setPreference((current) => cyclePreference(current))
  }, [])

  const value = useMemo(
    () => ({ preference, resolved, cycle }),
    [preference, resolved, cycle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
