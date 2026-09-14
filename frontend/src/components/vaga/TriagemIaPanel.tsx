import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, Mail, Settings, Star, UserCheck, XCircle } from 'lucide-react'
import { Badge, Button, IconAction, Textarea } from '../ui'
import { useDecidirTriagemIa, useTriagemIaConfig, useTriagemIaDaVaga } from '../../api/hooks/useTriagemIa'
import type { CandidatoTriagemIA } from '../../types'

function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function CaixaNaoConfiguradaAviso() {
  const navigate = useNavigate()
  return (
    <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm font-medium text-amber-800">
        Nenhuma caixa de e-mail configurada ainda.
      </p>
      <p className="text-xs text-amber-700">
        Configure em Configurações → Triagem por IA pra começar a receber currículos por e-mail.
      </p>
      <Button variant="secondary" onClick={() => navigate('/config/triagem-ia')}>
        <Settings size={14} /> Ir pra Configurações
      </Button>
    </div>
  )
}

function CandidatoTriagemCard({
  item,
  onDecidir,
}: {
  item: CandidatoTriagemIA
  onDecidir: (acao: 'funil' | 'banco_talentos' | 'descartar', motivo?: string) => void
}) {
  const [descartando, setDescartando] = useState(false)
  const [motivo, setMotivo] = useState(item.justificativa_ia)
  const resolvido = item.status === 'RESOLVIDO'
  const nome = item.nome_extraido || item.nome_remetente || item.email_remetente

  return (
    <div className="rounded border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-800">
            {item.destaque && <Star size={14} className="shrink-0 fill-amber-400 text-amber-400" />}
            {nome || 'Sem nome identificado'}
          </p>
          <p className="truncate text-xs text-slate-500">{item.email_extraido || item.email_remetente}</p>
        </div>
        {item.score != null && (
          <Badge tone={item.score >= 70 ? 'emerald' : item.score >= 40 ? 'amber' : 'slate'}>
            {item.score}/100
          </Badge>
        )}
      </div>

      {item.status === 'ERRO' && (
        <p className="mt-2 rounded bg-red-50 p-1.5 text-xs text-red-700">{item.erro_detalhe}</p>
      )}
      {item.justificativa_ia && (
        <p className="mt-2 text-xs text-slate-600">{item.justificativa_ia}</p>
      )}
      {resolvido && (
        <p className="mt-2 text-xs font-medium text-slate-400">
          Resolvido em {item.resolvido_em ? fmtDataHora(item.resolvido_em) : '—'}
        </p>
      )}

      {!resolvido && item.status !== 'ERRO' && (
        <>
          {descartando ? (
            <div className="mt-2 space-y-1.5">
              <Textarea
                rows={2}
                autoFocus
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo do descarte"
              />
              <div className="flex gap-1.5">
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={() => {
                    onDecidir('descartar', motivo)
                    setDescartando(false)
                  }}
                >
                  Confirmar descarte
                </Button>
                <Button variant="secondary" onClick={() => setDescartando(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <IconAction
                icon={UserCheck}
                label="Trazer pro funil"
                variant="success"
                onClick={() => onDecidir('funil')}
              />
              <IconAction
                icon={Archive}
                label="Banco de talentos"
                onClick={() => onDecidir('banco_talentos')}
              />
              <IconAction
                icon={XCircle}
                label="Descartar"
                variant="danger"
                onClick={() => setDescartando(true)}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function TriagemIaPanel({ vagaId }: { vagaId: string }) {
  const configQuery = useTriagemIaConfig(vagaId)
  const itensQuery = useTriagemIaDaVaga(vagaId)
  const decidir = useDecidirTriagemIa(vagaId)

  if (configQuery.isLoading) return <p className="text-sm text-slate-400">Carregando...</p>

  if (!configQuery.data?.caixa_configurada) {
    return <CaixaNaoConfiguradaAviso />
  }

  const itens = itensQuery.data ?? []
  const pendentes = itens.filter((i) => i.status !== 'RESOLVIDO')
  const resolvidos = itens.filter((i) => i.status === 'RESOLVIDO')

  return (
    <div className="space-y-3">
      {configQuery.data.vaga_codigo_email && (
        <p className="flex items-center gap-1.5 rounded bg-slate-50 p-2 text-xs text-slate-600">
          <Mail size={13} className="shrink-0" />
          Peça pra mandarem currículo pra{' '}
          <span className="font-mono font-medium text-slate-800">
            vagas+{configQuery.data.vaga_codigo_email}@{configQuery.data.caixa_usuario.split('@')[1]}
          </span>
        </p>
      )}

      {itensQuery.isLoading && <p className="text-sm text-slate-400">Carregando...</p>}
      {!itensQuery.isLoading && itens.length === 0 && (
        <p className="text-sm text-slate-400">Nenhum currículo recebido por e-mail ainda.</p>
      )}

      {pendentes.map((item) => (
        <CandidatoTriagemCard
          key={item.id}
          item={item}
          onDecidir={(acao, motivo) => decidir.mutate({ id: item.id, acao, motivo })}
        />
      ))}

      {resolvidos.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-400">
            Já resolvidos ({resolvidos.length})
          </summary>
          <div className="mt-2 space-y-2">
            {resolvidos.map((item) => (
              <CandidatoTriagemCard key={item.id} item={item} onDecidir={() => {}} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
