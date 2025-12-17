import { getMessagesByEvent } from '@/lib/localChatStore'
import { logApiError } from '@/lib/serverUtils'

function toNum(v: unknown): number | null { const n = Number(v); return Number.isFinite(n) ? n : null }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const eventId = toNum(searchParams.get('eventId'))
  if (!eventId) {
    return new Response('eventId required', { status: 400 })
  }

  const encoder = new TextEncoder()
  let lastTs: string | undefined

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      async function flush(messages: any[]) {
        if (!messages.length) return
        const data = JSON.stringify(messages)
        controller.enqueue(encoder.encode(`event: messages\n`))
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        lastTs = messages[messages.length - 1]?.created_at
      }

      try {
        const initial = await getMessagesByEvent(eventId!, 50)
        await flush(initial)
      } catch (e) {
        logApiError('GET /api/chat/stream initial load failed', e)
      }

      const ping = setInterval(() => {
        try { controller.enqueue(encoder.encode(`event: ping\n` + `data: keepalive\n\n`)) } catch (e) {
          logApiError('GET /api/chat/stream ping enqueue failed', e)
        }
      }, 15000)

      const poll = setInterval(async () => {
        try {
          const next = await getMessagesByEvent(eventId!, 50, lastTs)
          if (next.length) await flush(next)
        } catch (e) {
          logApiError('GET /api/chat/stream poll failed', e)
        }
      }, 1000)

      ;(req as any).signal?.addEventListener?.('abort', () => {
        clearInterval(ping)
        clearInterval(poll)
        try { controller.close() } catch (e) {
          logApiError('GET /api/chat/stream close failed', e)
        }
      })
    }
  })

  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive'
  })
  return new Response(stream, { headers })
}
