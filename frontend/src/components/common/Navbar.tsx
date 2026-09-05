import { useEffect, useRef, useState, type FormEvent } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  LogOut,
  KanbanSquare,
  List,
  Plus,
  UserPlus,
  Building2,
  ChevronDown,
  ChevronLeft,
  Eye,
  EyeOff,
  Bell,
  MessageCircle,
  ArrowRightLeft,
  Briefcase,
  Inbox,
  KeyRound,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import {
  alterarMinhaSenha,
  createSetor,
  createUsuario,
} from '../../api/accounts'
import {
  listSetores,
  getVagaNotificacoes,
  marcarVagaNotificacoesComoLidas,
  type VagaNotificacaoNova,
} from '../../api/vagas'
import { getNaoLidas, type NaoLidasResumo } from '../../api/chat'
import {
  getNotificacoesEtapa,
  marcarNotificacoesEtapaComoLidas,
  type CandidatoNotificacaoEtapa,
} from '../../api/candidatos'
import type { Setor } from '../../types'

type PainelAtivo = 'menu' | 'setor' | 'usuario' | 'senha'

const NOTIFICACOES_POLL_MS = 20000

function tempoRelativo(iso: string): string {
  const segundos = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (segundos < 60) return 'agora'
  const minutos = Math.floor(segundos / 60)
  if (minutos < 60) return `${minutos} min atrás`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `${horas}h atrás`
  const dias = Math.floor(horas / 24)
  return `${dias}d atrás`
}

function NotificacoesBell() {
  const navigate = useNavigate()
  const { me } = useAuth()
  const isRh = me?.role === 'RH'
  const [open, setOpen] = useState(false)
  const [resumoChat, setResumoChat] = useState<NaoLidasResumo | null>(null)
  const [notificacoesEtapa, setNotificacoesEtapa] = useState<CandidatoNotificacaoEtapa[]>([])
  const [notificacoesVaga, setNotificacoesVaga] = useState<VagaNotificacaoNova[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    function carregar() {
      getNaoLidas()
        .then((data) => {
          if (active) setResumoChat(data)
        })
        .catch(() => {})
      getNotificacoesEtapa()
        .then((data) => {
          if (active) setNotificacoesEtapa(data)
        })
        .catch(() => {})
      if (isRh) {
        getVagaNotificacoes()
          .then((data) => {
            if (active) setNotificacoesVaga(data)
          })
          .catch(() => {})
      }
    }
    carregar()
    const interval = setInterval(carregar, NOTIFICACOES_POLL_MS)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [isRh])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const base = isRh ? '/rh/kanban' : '/setor/kanban'
  const totalChat = resumoChat?.total ?? 0
  const total = totalChat + notificacoesEtapa.length + notificacoesVaga.length

  function handleToggle() {
    setOpen((v) => {
      const next = !v
      if (next && notificacoesEtapa.length > 0) {
        marcarNotificacoesEtapaComoLidas().catch(() => {})
      }
      if (next && notificacoesVaga.length > 0) {
        marcarVagaNotificacoesComoLidas().catch(() => {})
      }
      return next
    })
  }

  function handleAbrirCandidato(candidatoId: string) {
    setOpen(false)
    navigate(`${base}/candidato/${candidatoId}`)
  }

  function handleAbrirVagas() {
    setOpen(false)
    navigate('/rh/listagem')
  }

  const semNotificacoes =
    (!resumoChat || resumoChat.candidatos.length === 0) &&
    notificacoesEtapa.length === 0 &&
    notificacoesVaga.length === 0

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        className="relative flex items-center rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        aria-label="Notificações"
      >
        <Bell size={18} />
        {total > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">Notificações</h3>
          </div>

          <div className="scrollbar-thin max-h-96 overflow-y-auto">
            {semNotificacoes ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <Inbox size={22} className="text-slate-300" />
                <p className="text-sm text-slate-400">Nenhuma novidade por aqui.</p>
              </div>
            ) : (
              <>
                {resumoChat && resumoChat.candidatos.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Mensagens
                    </p>
                    {resumoChat.candidatos.map((item) => (
                      <button
                        key={item.candidato_id}
                        onClick={() => handleAbrirCandidato(item.candidato_id)}
                        className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                      >
                        <MessageCircle size={16} className="mt-0.5 shrink-0 text-blue-500" />
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                          {item.candidato_nome}
                        </span>
                        <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-600">
                          {item.quantidade}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {notificacoesEtapa.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Atividade
                    </p>
                    {notificacoesEtapa.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleAbrirCandidato(item.candidato_id)}
                        className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                      >
                        <ArrowRightLeft size={16} className="mt-0.5 shrink-0 text-slate-400" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-slate-700">{item.mensagem}</span>
                          <span className="text-xs text-slate-400">{tempoRelativo(item.created_at)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {notificacoesVaga.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Vagas novas
                    </p>
                    {notificacoesVaga.map((item) => (
                      <button
                        key={item.id}
                        onClick={handleAbrirVagas}
                        className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                      >
                        <Briefcase size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-slate-700">{item.mensagem}</span>
                          <span className="text-xs text-slate-400">{tempoRelativo(item.created_at)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function UsuarioMiniForm({
  setorFixo,
  onDone,
}: {
  setorFixo?: Setor
  onDone: () => void
}) {
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

export function Navbar() {
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

  const base = me.role === 'RH' ? '/rh' : '/setor'
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
    <nav className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-3 sm:px-6">
      <div className="scrollbar-thin flex min-w-0 flex-1 items-center gap-4 overflow-x-auto sm:gap-6">
        <span className="hidden shrink-0 text-lg font-semibold text-slate-800 sm:inline-block">
          RH · Vagas
        </span>
        <NavLink
          to={`${base}/kanban`}
          className={({ isActive }) =>
            clsx(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 text-sm',
              isActive ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:text-slate-900',
            )
          }
        >
          <KanbanSquare size={16} />
          Kanban
        </NavLink>
        <NavLink
          to={`${base}/vagas/nova`}
          className={({ isActive }) =>
            clsx(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 text-sm',
              isActive ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:text-slate-900',
            )
          }
        >
          <Plus size={16} />
          Nova vaga
        </NavLink>
        {isRh && (
          <NavLink
            to="/rh/candidatos/novo"
            className={({ isActive }) =>
              clsx(
                'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 text-sm',
                isActive ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:text-slate-900',
              )
            }
          >
            <UserPlus size={16} />
            Novo candidato
          </NavLink>
        )}
        <NavLink
          to={`${base}/listagem`}
          className={({ isActive }) =>
            clsx(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 text-sm',
              isActive ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:text-slate-900',
            )
          }
        >
          <List size={16} />
          Listagem
        </NavLink>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <NotificacoesBell />
        {isRh ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-1 rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {me.username}
              <ChevronDown size={14} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-20 mt-2 w-48 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
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
                    <button
                      onClick={() => setPainel('senha')}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <KeyRound size={14} />
                      Alterar senha
                    </button>
                  </>
                )}

                {painel === 'setor' && <SetorMiniForm onDone={fecharMenu} />}
                {painel === 'usuario' && <UsuarioMiniForm onDone={fecharMenu} />}
                {painel === 'senha' && <AlterarSenhaForm onDone={fecharMenu} />}
              </div>
            )}
          </div>
        ) : (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-1 rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {me.username}
              <ChevronDown size={14} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
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
                  <button
                    onClick={() => setPainel('senha')}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <KeyRound size={14} />
                    Alterar senha
                  </button>
                )}

                {painel === 'senha' && <AlterarSenhaForm onDone={fecharMenu} />}
              </div>
            )}
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </nav>
  )
}
