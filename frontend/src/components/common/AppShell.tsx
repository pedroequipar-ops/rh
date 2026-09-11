import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileTopBar } from './MobileTopBar'
import { CommandPalette } from './CommandPalette'
import { ShortcutHelp } from './ShortcutHelp'
import { CommandPaletteProvider } from '../../context/CommandPaletteContext'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

export function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toLowerCase().includes('mac')
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      } else if (e.key === '?' && !isTypingTarget(e.target)) {
        e.preventDefault()
        setHelpOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <CommandPaletteProvider openPalette={() => setPaletteOpen(true)}>
      <div className="flex h-full overflow-hidden bg-slate-50">
        <Sidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileTopBar onOpenMenu={() => setMobileNavOpen(true)} />
          <main className="min-h-0 flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
        {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
        <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      </div>
    </CommandPaletteProvider>
  )
}
