import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud } from 'lucide-react'
import { analisarCurriculo, createCandidato, getUploadUrl, uploadCurriculo } from '../../api/candidatos'
import { listVagas } from '../../api/vagas'
import type { Vaga } from '../../types'

export function CandidatoFormPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [vagas, setVagas] = useState<Vaga[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [curriculoKey, setCurriculoKey] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [justificativa, setJustificativa] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cpf, setCpf] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [resumoPerfil, setResumoPerfil] = useState('')
  const [vagaId, setVagaId] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listVagas()
      .then(setVagas)
      .catch(() => setVagas([]))
  }, [])

  const MAX_CURRICULO_SIZE_BYTES = 10 * 1024 * 1024

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
          setCpf(extraido.cpf ?? '')
          setLinkedinUrl(extraido.linkedin_url ?? '')
          setResumoPerfil(extraido.resumo_perfil ?? '')
          if (extraido.vaga_sugerida_id) setVagaId(extraido.vaga_sugerida_id)
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
    if (!curriculoKey) {
      setError('Envie o currículo em PDF antes de cadastrar o candidato.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const candidato = await createCandidato({
        nome,
        email,
        telefone,
        cpf,
        linkedin_url: linkedinUrl || null,
        resumo_perfil: resumoPerfil,
        curriculo_key: curriculoKey,
        vaga_id: vagaId,
      })
      navigate(`/rh/kanban/candidato/${candidato.id}`)
    } catch {
      setError('Não foi possível cadastrar o candidato. Confira os campos e tente novamente.')
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
          {fileName ?? 'Selecionar currículo (PDF)'}
        </button>
        {uploading && <p className="mt-2 text-xs text-slate-500">Enviando currículo...</p>}
        {analyzing && <p className="mt-2 text-xs text-slate-500">Analisando currículo com IA...</p>}
        {justificativa && !analyzing && (
          <p className="mt-2 text-xs text-slate-500">Sugestão da IA: {justificativa}</p>
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
              required
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

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">
            Resumo do perfil
          </label>
          <textarea
            rows={4}
            value={resumoPerfil}
            onChange={(e) => setResumoPerfil(e.target.value)}
            placeholder="Formação, cursos, experiências e outras informações relevantes extraídas do currículo"
            className="min-h-[5rem] max-h-[16rem] w-full resize-y rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Vaga</label>
          <select
            required
            value={vagaId}
            onChange={(e) => setVagaId(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
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
