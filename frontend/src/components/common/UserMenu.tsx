import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronLeft, Eye, EyeOff, KeyRound, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { alterarMinhaSenha } from '../../api/accounts'
import { Avatar } from '../ui/Avatar'
import { cn } from '../ui/cn'

type PainelAtivo = 'menu' | 'senha'

function AlterarSenhaForm({ onDone }: { onDone: () => void }) {
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await alterarMinhaSenha(senhaAtual, senhaNova)
      showToast('Senha alterada com sucesso')
      onDone()
    } catch (err) {
      const detalhe =
        (err as { response?: { data?: { senha_atual?: string[] } } })?.response?.data
          ?.senha_atual?.[0]
      setError(detalhe ?? 'Não foi possível alterar a senha.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5 px-3 py-2.5">
      <input
        type="password"
        required
        autoFocus
        placeholder="Senha atual"
        value={senhaAtual}
        onChange={(e) => setSenhaAtual(e.target.value)}
        className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
      />
      <div className="relative">
        <input
          type={mostrarSenha ? 'text' : 'password'}
          required
          minLength={8}
          placeholder="Nova senha"
          value={senhaNova}
          onChange={(e) => setSenhaNova(e.target.value)}
          className="w-full rounded border border-slate-300 px-2.5 py-1.5 pr-9 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setMostrarSenha((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400 hover:text-slate-600"
          tabIndex={-1}
          aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
      >
        {submitting ? 'Salvando...' : 'Alterar senha'}
      </button>
    </form>
  )
}

export function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [painel, setPainel] = useState<PainelAtivo>('menu')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
        setPainel('menu')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!me) return null
  const isRh = me.role === 'RH'

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function fecharMenu() {
    setMenuOpen(false)
    setPainel('menu')
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen((v) => !v)}
        title={collapsed ? me.username : undefined}
        className={cn(
          'flex h-11 w-full items-center gap-2.5 rounded-md px-1.5 text-left transition-fast hover:bg-slate-100',
          collapsed && 'justify-center px-0',
        )}
      >
        <Avatar name={me.username} size="sm" />
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-slate-800">
              {me.username}
            </span>
            <span className="block text-[11px] text-slate-400">{isRh ? 'RH' : 'Setor'}</span>
          </span>
        )}
        {!collapsed && <ChevronDown size={14} className="shrink-0 text-slate-400" />}
      </button>

      {menuOpen && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {painel !== 'menu' && (
            <button
              onClick={() => setPainel('menu')}
              className="flex w-full items-center gap-1.5 border-b border-slate-100 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
            >
              <ChevronLeft size={12} />
              Voltar
            </button>
          )}

          {painel === 'menu' && (
            <>
              <button
                onClick={() => setPainel('senha')}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <KeyRound size={14} />
                Alterar senha
              </button>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut size={14} />
                Sair
              </button>
            </>
          )}

          {painel === 'senha' && <AlterarSenhaForm onDone={fecharMenu} />}
        </div>
      )}
    </div>
  )
}
