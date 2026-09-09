import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { getCompanyConfig, updateCompanyConfig } from '../../api/company'
import { useToast } from '../../context/ToastContext'

export function ConfigVagasModal({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast()
  const [exigeAprovacao, setExigeAprovacao] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getCompanyConfig()
      .then((c) => setExigeAprovacao(c.exige_aprovacao_vaga))
      .catch(() => showToast('Não foi possível carregar a configuração', 'error'))
  }, [showToast])

  async function handleToggle(valor: boolean) {
    setExigeAprovacao(valor)
    setSaving(true)
    try {
      await updateCompanyConfig({ exige_aprovacao_vaga: valor })
      showToast('Configuração salva')
    } catch {
      setExigeAprovacao(!valor)
      showToast('Não foi possível salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Configuração de vagas</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        {exigeAprovacao === null ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : (
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={exigeAprovacao}
              disabled={saving}
              onChange={(e) => handleToggle(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Exigir aprovação do RH
              <span className="mt-0.5 block text-xs text-slate-400">
                Quando ligado, vagas criadas por setores entram como “Solicitada” e aguardam o RH
                aprovar antes de seguir no fluxo.
              </span>
            </span>
          </label>
        )}
      </div>
    </div>
  )
}
