export type NotificacoesSocketStatus = 'connecting' | 'open' | 'closed'

export interface NotificacaoEvento {
  tipo: 'candidato' | 'vaga'
  mensagem: string
  candidato_id?: string
  vaga_id?: string
}

interface NotificacoesSocketOptions {
  token: string
  companyId: string
  onEvento: (evento: NotificacaoEvento) => void
  onStatusChange?: (status: NotificacoesSocketStatus) => void
}

const MAX_BACKOFF_MS = 15000
const BASE_BACKOFF_MS = 1000

/** Canal único por usuário (`notificacoes_<user_id>` no backend) — dispara
 * `onEvento` a cada notificação de candidato/vaga criada, pra substituir o
 * polling de 20s do sino por atualização em tempo real. Mesmo padrão de
 * reconexão com backoff do ChatSocket (ver ../ws/chatSocket.ts). */
export class NotificacoesSocket {
  private options: NotificacoesSocketOptions
  private ws: WebSocket | null = null
  private attempts = 0
  private closedByClient = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor(options: NotificacoesSocketOptions) {
    this.options = options
  }

  connect() {
    this.closedByClient = false
    this.open()
  }

  private open() {
    const { token, companyId } = this.options
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${protocol}://${window.location.host}/ws/v1/notificacoes/?token=${encodeURIComponent(
      token,
    )}&company_id=${encodeURIComponent(companyId)}`

    this.options.onStatusChange?.('connecting')
    const ws = new WebSocket(url)
    this.ws = ws

    ws.onopen = () => {
      this.attempts = 0
      this.options.onStatusChange?.('open')
    }

    ws.onmessage = (event) => {
      try {
        this.options.onEvento(JSON.parse(event.data))
      } catch {
        // ignora payload não-JSON
      }
    }

    ws.onclose = () => {
      this.options.onStatusChange?.('closed')
      if (!this.closedByClient) this.scheduleReconnect()
    }

    ws.onerror = () => {
      ws.close()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    const delay = Math.min(BASE_BACKOFF_MS * 2 ** this.attempts, MAX_BACKOFF_MS)
    this.attempts += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.open()
    }, delay)
  }

  close() {
    this.closedByClient = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
  }
}
