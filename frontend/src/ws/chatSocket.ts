export type ChatSocketStatus = 'connecting' | 'open' | 'closed'

interface ChatSocketOptions {
  candidatoId: string
  token: string
  companyId: string
  onMessage: (data: unknown) => void
  onStatusChange?: (status: ChatSocketStatus) => void
}

const MAX_BACKOFF_MS = 15000
const BASE_BACKOFF_MS = 1000

export class ChatSocket {
  private options: ChatSocketOptions
  private ws: WebSocket | null = null
  private attempts = 0
  private closedByClient = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor(options: ChatSocketOptions) {
    this.options = options
  }

  connect() {
    this.closedByClient = false
    this.open()
  }

  private open() {
    const { candidatoId, token, companyId } = this.options
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${protocol}://${window.location.host}/ws/v1/chat/candidato/${candidatoId}/?token=${encodeURIComponent(
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
        this.options.onMessage(JSON.parse(event.data))
      } catch {
        // ignora payload não-JSON
      }
    }

    ws.onclose = () => {
      this.options.onStatusChange?.('closed')
      if (!this.closedByClient) {
        this.scheduleReconnect()
      }
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

  send(payload: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
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
