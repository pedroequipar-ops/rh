import { useState } from 'react'
import { Button, Dialog, Textarea } from '../ui'

interface MotivoLixeiraModalProps {
  titulo: string
  onCancel: () => void
  onConfirm: (motivo: string) => void
}

/** Confirmação obrigatória com motivo antes de mandar candidato ou vaga pra
 * lixeira — usado tanto no drag pro LixeiraDock quanto no menu ⋮ "Lixeira"
 * do board Vagas. Sem motivo escrito, não dá pra confirmar. */
export function MotivoLixeiraModal({ titulo, onCancel, onConfirm }: MotivoLixeiraModalProps) {
  const [motivo, setMotivo] = useState('')
  const podeConfirmar = motivo.trim().length > 0

  return (
    <Dialog
      role="alertdialog"
      onClose={onCancel}
      title={titulo}
      description="Motivo obrigatório."
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={!podeConfirmar}
            onClick={() => onConfirm(motivo.trim())}
          >
            Confirmar
          </Button>
        </>
      }
    >
      <Textarea
        autoFocus
        rows={3}
        placeholder="Motivo..."
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
    </Dialog>
  )
}
