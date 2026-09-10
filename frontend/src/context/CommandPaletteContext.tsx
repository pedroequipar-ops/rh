import { createContext, useContext, type ReactNode } from 'react'

interface CommandPaletteContextValue {
  openPalette: () => void
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | undefined>(undefined)

export function CommandPaletteProvider({
  openPalette,
  children,
}: {
  openPalette: () => void
  children: ReactNode
}) {
  return (
    <CommandPaletteContext.Provider value={{ openPalette }}>{children}</CommandPaletteContext.Provider>
  )
}

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) {
    throw new Error('useCommandPalette deve ser usado dentro de CommandPaletteProvider')
  }
  return ctx
}
