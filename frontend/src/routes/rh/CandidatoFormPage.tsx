import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { UploadCloud } from 'lucide-react'
import {
  analisarCurriculo,
  createCandidato,
  getUploadUrl,
  uploadCurriculo,
} from '../../api/candidatos'
import { listVagas } from '../../api/vagas'
import { useToast } from '../../context/ToastContext'
import type { Vaga } from '../../types'

const MAX_CURRICULO_SIZE_BYTES = 10 * 1024 * 1024

export function CandidatoFormPage() {
  const navigate = useNavigate()
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

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setError('O currículo deve ter no máximo 10MB.')
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
    setSubmitting(true)
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
      const candidato = await createCandidato(payload)
      showToast('Candidato cadastrado com sucesso')
      navigate(`/rh/pessoas/candidato/${candidato.id}`)
    } catch {
      setError('Não foi possível salvar o candidato. Confira os campos e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-6 text-xl font-semibold text-slate-800">Novo candidato</h1>

      <div className="mb-6 rounded border border-dashed border-slate-300 p-4">
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
          disabled={uploading || analyzing}
          className="flex w-full items-center justify-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <UploadCloud size={16} />
          {fileName ?? 'Selecionar currículo (PDF) — opcional'}
        </button>
        {uploading && <p className="mt-2 text-xs text-slate-500">Enviando currículo...</p>}
        {analyzing && <p className="mt-2 text-xs text-slate-500">Analisando currículo com IA...</p>}
        {justificativa && !analyzing && (
          <p className="mt-2 text-xs text-slate-500">Sugestão da IA: {justificativa}</p>
        )}
        {!fileName && !uploading && (
          <p className="mt-2 text-xs text-slate-400">
            Sem currículo, é só preencher os campos abaixo manualmente.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Nome</label>
          <input
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-600">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-600">Telefone</label>
            <input
              required
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-600">CPF</label>
            <input
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-600">LinkedIn</label>
            <input
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="Opcional"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Formação</label>
            <textarea
              rows={3}
              value={perfilFormacao}
              onChange={(e) => setPerfilFormacao(e.target.value)}
              placeholder="Formação acadêmica e cursos"
              className="min-h-[4rem] max-h-[12rem] w-full resize-y rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Experiência</label>
            <textarea
              rows={3}
              value={perfilExperiencia}
              onChange={(e) => setPerfilExperiencia(e.target.value)}
              placeholder="Experiências profissionais relevantes"
              className="min-h-[4rem] max-h-[12rem] w-full resize-y rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Habilidades</label>
            <textarea
              rows={3}
              value={perfilHabilidades}
              onChange={(e) => setPerfilHabilidades(e.target.value)}
              placeholder="Principais habilidades técnicas e ferramentas"
              className="min-h-[4rem] max-h-[12rem] w-full resize-y rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Certificações</label>
            <textarea
              rows={3}
              value={perfilCertificacoes}
              onChange={(e) => setPerfilCertificacoes(e.target.value)}
              placeholder="Certificações obtidas"
              className="min-h-[4rem] max-h-[12rem] w-full resize-y rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Vaga</label>
          <select
            required
            value={vagaId}
            disabled={Boolean(vagaPreselecionada)}
            onChange={(e) => setVagaId(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="" disabled>
              Selecione uma vaga
            </option>
            {vagas.map((vaga) => (
              <option key={vaga.id} value={vaga.id}>
                {vaga.titulo}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting || uploading || analyzing}
          className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
        >
          {submitting ? 'Salvando...' : 'Cadastrar candidato'}
        </button>
      </form>
    </div>
  )
}
