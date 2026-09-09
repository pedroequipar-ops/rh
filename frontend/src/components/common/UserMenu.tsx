import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, ChevronDown, ChevronLeft, Eye, EyeOff, KeyRound, LogOut, UserPlus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { alterarMinhaSenha, createSetor, createUsuario } from '../../api/accounts'
import { listSetores } from '../../api/vagas'
import { Avatar } from '../ui/Avatar'
import { cn } from '../ui/cn'
import type { Setor } from '../../types'

type PainelAtivo = 'menu' | 'setor' | 'usuario' | 'senha'

function UsuarioMiniForm({ setorFixo, onDone }: { setorFixo?: Setor; onDone: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [setores, setSetores] = useState<Setor[]>([])
  const [setorId, setSetorId] = useState(setorFixo?.id ?? '')
  const [outroSetor, setOutroSetor] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  useEffect(() => {
    if (setorFixo) return
    listSetores()
      .then((lista) => {
        setSetores(lista)
        if (lista.length > 0) setSetorId(lista[0].id)
      })
      .catch(() => setSetores([]))
  }, [setorFixo])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await createUsuario({ username, password, setor_id: setorId })
      onDone()
      showToast('Usuário criado com sucesso')
    } catch {
      setError('Não foi possível criar. Confira os campos.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5 px-3 py-2.5">
      {setorFixo && <p className="text-xs text-slate-500">Setor: {setorFixo.nome}</p>}
      <input
        required
        autoFocus
        placeholder="Usuário"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
      />
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          required
          minLength={8}
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-slate-300 px-2.5 py-1.5 pr-9 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400 hover:text-slate-600"
          tabIndex={-1}
          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {!setorFixo && (
        <div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={outroSetor}
              onChange={(e) => setOutroSetor(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300"
            />
            Selecionar outro setor
          </label>
          {outroSetor && (
            <select
              required
              value={setorId}
              onChange={(e) => setSetorId(e.target.value)}
              className="mt-1.5 w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
            >
              {setores.map((setor) => (
                <option key={setor.id} value={setor.id}>
                  {setor.nome}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !setorId}
        className="w-full rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
      >
        {submitting ? 'Salvando...' : 'Criar usuário'}
      </button>
    </form>
  )
}

function SetorMiniForm({ onDone }: { onDone: () => void }) {
  const [nome, setNome] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setorCriado, setSetorCriado] = useState<Setor | null>(null)
  const [criarUsuarioAgora, setCriarUsuarioAgora] = useState(false)
  const { showToast } = useToast()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const setor = await createSetor({ nome })
      setSetorCriado(setor)
      showToast('Setor criado com sucesso')
    } catch {
      setError('Não foi possível criar. Confira o nome.')
    } finally {
      setSubmitting(false)
    }
  }

  if (setorCriado && criarUsuarioAgora) {
    return <UsuarioMiniForm setorFixo={setorCriado} onDone={onDone} />
  }

  if (setorCriado) {
    return (
      <div className="space-y-2.5 px-3 py-2.5">
        <p className="text-xs text-slate-600">
          Setor <span className="font-medium">{setorCriado.nome}</span> criado. Criar um usuário
          para ele agora?
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setCriarUsuarioAgora(true)}
            className="flex-1 rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900"
          >
            Criar usuário
          </button>
          <button
            onClick={onDone}
            className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            Agora não
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5 px-3 py-2.5">
      <input
        required
        autoFocus
        placeholder="Nome do setor"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
      >
        {submitting ? 'Salvando...' : 'Criar setor'}
      </button>
    </form>
  )
}

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
              {isRh && (
                <>
                  <button
                    onClick={() => setPainel('setor')}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Building2 size={14} />
                    Novo setor
                  </button>
                  <button
                    onClick={() => setPainel('usuario')}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <UserPlus size={14} />
                    Novo usuário
                  </button>
                </>
              )}
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

          {painel === 'setor' && <SetorMiniForm onDone={fecharMenu} />}
          {painel === 'usuario' && <UsuarioMiniForm onDone={fecharMenu} />}
          {painel === 'senha' && <AlterarSenhaForm onDone={fecharMenu} />}
        </div>
      )}
    </div>
  )
}
