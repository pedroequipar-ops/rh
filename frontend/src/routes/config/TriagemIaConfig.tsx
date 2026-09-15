import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle, Mail, Trash2 } from 'lucide-react'
import { Button, Card, Field, Input, Select } from '../../components/ui'
import {
  useAdicionarCaixaEntradaEmail,
  useCaixasEntradaEmail,
  useConectarGoogle,
  useRemoverCaixaEntradaEmail,
  useRotearTriagemIa,
  useTriagemIaNaoRoteados,
} from '../../api/hooks/useTriagemIa'
import { useVagas } from '../../api/hooks/useVagas'
import { useToast } from '../../context/ToastContext'
import type { CaixaEntradaEmail, CandidatoTriagemIA, Vaga } from '../../types'

function GoogleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 15.8 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4c-7.5 0-14 4.2-17.7 10.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.5C29.4 34.9 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.9 39.6 16.4 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.7l6.5 5.5C41.5 36 44 30.5 44 24c0-1.3-.1-2.6-.4-3.5z"
      />
    </svg>
  )
}

function CaixaConectadaRow({ caixa }: { caixa: CaixaEntradaEmail }) {
  const remover = useRemoverCaixaEntradaEmail()

  return (
    <div className="space-y-1 rounded border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-sm text-slate-800">
          {caixa.provider === 'GOOGLE' ? <GoogleLogo /> : <Mail size={16} className="text-slate-400" />}
          <span className="truncate font-medium">{caixa.usuario}</span>
          {!caixa.ativo && (
            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
              inativa
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          className="shrink-0 !p-1.5 text-slate-400 hover:text-red-600"
          disabled={remover.isPending}
          onClick={() => remover.mutate(caixa.id)}
          title="Desconectar"
        >
          <Trash2 size={14} />
        </Button>
      </div>
      {caixa.ultimo_erro && (
        <p className="flex items-center gap-1 text-xs text-red-700">
          <AlertCircle size={12} className="shrink-0" />
          {caixa.ultimo_erro}
        </p>
      )}
    </div>
  )
}

function FormularioImap({ onSalvo }: { onSalvo: () => void }) {
  const adicionar = useAdicionarCaixaEntradaEmail()

  const [host, setHost] = useState('')
  const [porta, setPorta] = useState('993')
  const [usarSsl, setUsarSsl] = useState(true)
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [pasta, setPasta] = useState('INBOX')

  async function salvarConfig() {
    await adicionar.mutateAsync({
      host,
      porta: Number(porta) || 993,
      usar_ssl: usarSsl,
      usuario,
      senha,
      pasta,
    })
    setHost('')
    setUsuario('')
    setSenha('')
    onSalvo()
  }

  return (
    <div className="space-y-3 rounded border border-slate-200 bg-white p-3">
      <Field label="Servidor IMAP">
        <Input placeholder="imap.gmail.com" value={host} onChange={(e) => setHost(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Porta">
          <Input type="number" value={porta} onChange={(e) => setPorta(e.target.value)} />
        </Field>
        <Field label="Pasta">
          <Input value={pasta} onChange={(e) => setPasta(e.target.value)} />
        </Field>
      </div>
      <Field label="E-mail">
        <Input
          type="email"
          placeholder="vagas@suaempresa.com"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
        />
      </Field>
      <Field label="Senha">
        <Input
          type="password"
          placeholder="Senha ou senha de app"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={usarSsl} onChange={(e) => setUsarSsl(e.target.checked)} />
        Usar SSL
      </label>
      <Button
        variant="secondary"
        disabled={!host || !usuario || !senha || adicionar.isPending}
        onClick={salvarConfig}
      >
        Conectar
      </Button>
    </div>
  )
}

function EmailNaoRoteadoRow({ item, vagas }: { item: CandidatoTriagemIA; vagas: Vaga[] }) {
  const [vagaId, setVagaId] = useState('')
  const rotear = useRotearTriagemIa()
  const nome = item.nome_extraido || item.nome_remetente || item.email_remetente

  return (
    <div className="space-y-2 rounded border border-slate-200 bg-white p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-800">{nome}</p>
        <p className="truncate text-xs text-slate-500">{item.assunto_email || item.email_remetente}</p>
      </div>
      <div className="flex gap-1.5">
        <Select
          className="flex-1"
          value={vagaId}
          onChange={(e) => setVagaId(e.target.value)}
        >
          <option value="" disabled>
            Selecione a vaga
          </option>
          {vagas.map((vaga) => (
            <option key={vaga.id} value={vaga.id}>
              {vaga.titulo}
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          disabled={!vagaId || rotear.isPending}
          onClick={() => rotear.mutate({ id: item.id, vagaId })}
        >
          Rotear
        </Button>
      </div>
    </div>
  )
}

export function TriagemIaConfig() {
  const [params, setParams] = useSearchParams()
  const { showToast } = useToast()
  const caixasQuery = useCaixasEntradaEmail()
  const conectarGoogle = useConectarGoogle()
  const naoRoteadosQuery = useTriagemIaNaoRoteados()
  const vagasQuery = useVagas()
  const [mostrarImap, setMostrarImap] = useState(false)

  useEffect(() => {
    const status = params.get('google')
    if (!status) return
    if (status === 'conectado') showToast('Conta Google conectada')
    if (status === 'erro') showToast('Não foi possível conectar com o Google', 'error')
    params.delete('google')
    setParams(params, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const caixas = caixasQuery.data ?? []
  const naoRoteados = naoRoteadosQuery.data ?? []

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {naoRoteados.length > 0 && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-slate-800">
              E-mails não roteados ({naoRoteados.length})
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            A IA não conseguiu identificar a vaga desses e-mails (sem tag <code>+vaga@</code> nem{' '}
            <code>[VAGA:codigo]</code> no assunto). Escolha a vaga certa pra pontuar o currículo.
          </p>
          <div className="space-y-2">
            {naoRoteados.map((item) => (
              <EmailNaoRoteadoRow key={item.id} item={item} vagas={vagasQuery.data ?? []} />
            ))}
          </div>
        </Card>
      )}

      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Mail size={16} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-800">Triagem de currículos por e-mail</h2>
        </div>
        <p className="text-xs text-slate-500">
          Conecte quantas caixas de e-mail forem necessárias pra receber candidaturas — a IA lê os
          currículos recebidos em todas elas e pontua contra a vaga certa. Depois de conectar, cada
          vaga mostra um endereço próprio (aba "Triagem IA") pra divulgar no anúncio.
        </p>

        {caixasQuery.isLoading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : (
          <div className="space-y-2">
            {caixas.map((caixa) => (
              <CaixaConectadaRow key={caixa.id} caixa={caixa} />
            ))}
          </div>
        )}

        <div className="space-y-3 border-t border-slate-100 pt-3">
          <Button
            variant="secondary"
            className="w-full justify-center gap-2"
            disabled={conectarGoogle.isPending}
            onClick={() => conectarGoogle.mutate()}
          >
            <GoogleLogo /> Conectar outra conta Google
          </Button>

          {!mostrarImap ? (
            <button
              type="button"
              className="text-xs text-slate-400 underline hover:text-slate-600"
              onClick={() => setMostrarImap(true)}
            >
              Conectar por outro provedor de e-mail (IMAP manual)
            </button>
          ) : (
            <FormularioImap onSalvo={() => setMostrarImap(false)} />
          )}
        </div>
      </Card>
    </div>
  )
}
