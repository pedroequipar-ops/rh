import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { FileText, Loader2, Sparkles, UploadCloud } from 'lucide-react'
import {
  analisarCurriculo,
  getUploadUrl,
  uploadCurriculo,
} from '../../api/candidatos'
import { useCreateCandidato } from '../../api/hooks/useCandidatos'
import { listVagas } from '../../api/vagas'
import { useToast } from '../../context/ToastContext'
import { Button, Field, FormModal, Input, Select, Textarea } from '../../components/ui'
import type { Vaga } from '../../types'

const MAX_CURRICULO_SIZE_BYTES = 25 * 1024 * 1024
const FORM_ID = 'candidato-form'

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</h2>
  )
}

export function CandidatoFormPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { showToast } = useToast()
  const [searchParams] = useSearchParams()
  const vagaPreselecionada = searchParams.get('vaga')
  const etapaDestino = searchParams.get('etapa')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [vagas, setVagas] = useState<Vaga[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [curriculoKey, setCurriculoKey] = useState<string | null>(null)
  const [cpf, setCpf] = useState('')
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [justificativa, setJustificativa] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [perfilFormacao, setPerfilFormacao] = useState('')
  const [perfilExperiencia, setPerfilExperiencia] = useState('')
  const [perfilHabilidades, setPerfilHabilidades] = useState('')
  const [perfilCertificacoes, setPerfilCertificacoes] = useState('')
  const [vagaId, setVagaId] = useState(vagaPreselecionada ?? '')

  const [error, setError] = useState<string | null>(null)
  const criarCandidato = useCreateCandidato()

  const ocupado = uploading || analyzing

  function fechar() {
    const base = pathname.replace(/\/novo-candidato\/?$/, '') || '/rh/pessoas'
    navigate(vagaPreselecionada ? `${base}/vaga/${vagaPreselecionada}` : base)
  }

  useEffect(() => {
    listVagas()
      .then(setVagas)
      .catch(() => setVagas([]))
  }, [])

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setError('Selecione um arquivo PDF.')
      event.target.value = ''
      return
    }
    if (file.size > MAX_CURRICULO_SIZE_BYTES) {
      setError('O currículo deve ter no máximo 25MB.')
      event.target.value = ''
      return
    }

    setFileName(file.name)
    setCurriculoKey(null)
    setJustificativa(null)
    setError(null)
    setUploading(true)

    try {
      const { upload_url, curriculo_key } = await getUploadUrl(file.name, file.type || 'application/pdf')
      await uploadCurriculo(upload_url, file)
      setCurriculoKey(curriculo_key)
      setUploading(false)

      setAnalyzing(true)
      try {
        const extraido = await analisarCurriculo(curriculo_key)
        if (extraido.erro) {
          setError('Não foi possível extrair os dados automaticamente. Preencha os campos manualmente.')
        } else {
          setNome(extraido.nome ?? '')
          setEmail(extraido.email ?? '')
          setTelefone(extraido.telefone ?? '')
          setLinkedinUrl(extraido.linkedin_url ?? '')
          setPerfilFormacao(extraido.perfil_formacao ?? '')
          setPerfilExperiencia(extraido.perfil_experiencia ?? '')
          setPerfilHabilidades(extraido.perfil_habilidades ?? '')
          setPerfilCertificacoes(extraido.perfil_certificacoes ?? '')
          if (extraido.vaga_sugerida_id && !vagaPreselecionada)
            setVagaId(extraido.vaga_sugerida_id)
          setJustificativa(extraido.justificativa ?? null)
        }
      } catch {
        setError('Não foi possível extrair os dados automaticamente. Preencha os campos manualmente.')
      } finally {
        setAnalyzing(false)
      }
    } catch {
      setUploading(false)
      setError('Falha ao enviar o currículo. Tente novamente.')
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const payload = {
      nome,
      email,
      telefone,
      cpf,
      linkedin_url: linkedinUrl || null,
      perfil_formacao: perfilFormacao,
      perfil_experiencia: perfilExperiencia,
      perfil_habilidades: perfilHabilidades,
      perfil_certificacoes: perfilCertificacoes,
      curriculo_key: curriculoKey ?? '',
      vaga_id: vagaId,
      ...(etapaDestino ? { etapa_atual_id: etapaDestino } : {}),
    }
    try {
      const candidato = await criarCandidato.mutateAsync(payload)
      showToast('Candidato cadastrado com sucesso')
      navigate(`/rh/pessoas/candidato/${candidato.id}`)
    } catch {
      setError('Não foi possível salvar o candidato. Confira os campos e tente novamente.')
    }
  }

  return (
    <FormModal
      title="Novo candidato"
      description="Anexe um currículo em PDF para preencher automaticamente, ou digite os dados à mão."
      onClose={fechar}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={fechar}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} disabled={criarCandidato.isPending || ocupado}>
            {criarCandidato.isPending ? 'Salvando...' : 'Cadastrar candidato'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-lg border border-slate-200 p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={ocupado}
            className="group flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors group-hover:bg-blue-100 group-hover:text-blue-600">
              {fileName ? <FileText size={18} /> : <UploadCloud size={18} />}
            </span>
            <span className="text-sm font-medium text-slate-700">
              {fileName ?? 'Selecionar currículo (PDF)'}
            </span>
            <span className="text-xs text-slate-400">Opcional · PDF de até 25 MB</span>
          </button>

          {ocupado && (
            <p className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 size={13} className="animate-spin" />
              {uploading ? 'Enviando currículo...' : 'Analisando currículo com IA...'}
            </p>
          )}
          {justificativa && !analyzing && (
            <div className="mt-3 flex gap-2 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
              <Sparkles size={14} className="mt-px shrink-0 text-blue-500" />
              <span>
                <span className="font-semibold">Sugestão da IA:</span> {justificativa}
              </span>
            </div>
          )}
        </div>

        <section className="space-y-4 border-t border-slate-100 pt-5">
          <SectionTitle>Contato</SectionTitle>
          <Field label="Nome" htmlFor="cand-nome">
            <Input
              id="cand-nome"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="cand-email">
              <Input
                id="cand-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Telefone" htmlFor="cand-tel">
              <Input
                id="cand-tel"
                required
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
            </Field>
            <Field label="CPF" htmlFor="cand-cpf">
              <Input id="cand-cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} />
            </Field>
            <Field label="LinkedIn" htmlFor="cand-linkedin">
              <Input
                id="cand-linkedin"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="Opcional"
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-5">
          <SectionTitle>Perfil profissional</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Formação" htmlFor="cand-formacao">
              <Textarea
                id="cand-formacao"
                rows={3}
                value={perfilFormacao}
                onChange={(e) => setPerfilFormacao(e.target.value)}
                placeholder="Formação acadêmica e cursos"
              />
            </Field>
            <Field label="Experiência" htmlFor="cand-exp">
              <Textarea
                id="cand-exp"
                rows={3}
                value={perfilExperiencia}
                onChange={(e) => setPerfilExperiencia(e.target.value)}
                placeholder="Experiências profissionais relevantes"
              />
            </Field>
            <Field label="Habilidades" htmlFor="cand-hab">
              <Textarea
                id="cand-hab"
                rows={3}
                value={perfilHabilidades}
                onChange={(e) => setPerfilHabilidades(e.target.value)}
                placeholder="Principais habilidades técnicas e ferramentas"
              />
            </Field>
            <Field label="Certificações" htmlFor="cand-cert">
              <Textarea
                id="cand-cert"
                rows={3}
                value={perfilCertificacoes}
                onChange={(e) => setPerfilCertificacoes(e.target.value)}
                placeholder="Certificações obtidas"
              />
            </Field>
          </div>
        </section>

        <section className="border-t border-slate-100 pt-5">
          <Field
            label="Vaga"
            htmlFor="cand-vaga"
            hint={vagaPreselecionada ? 'Definida pela vaga de origem.' : undefined}
          >
            <Select
              id="cand-vaga"
              required
              value={vagaId}
              disabled={Boolean(vagaPreselecionada)}
              onChange={(e) => setVagaId(e.target.value)}
            >
              <option value="" disabled>
                Selecione uma vaga
              </option>
              {vagas.map((vaga) => (
                <option key={vaga.id} value={vaga.id}>
                  {vaga.titulo}
                </option>
              ))}
            </Select>
          </Field>
        </section>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </FormModal>
  )
}
