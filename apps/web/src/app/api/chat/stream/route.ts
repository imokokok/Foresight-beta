import { getMessagesByEvent } from '@/lib/localChatStore'

function toNum(v: any): number | null { const n = Number(v); return Number.isFinite(n) ? n : null }

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

      // 发送初始消息
      try {
        const initial = await getMessagesByEvent(eventId!, 50)
        await flush(initial)
      } catch {}

      // 心跳保持
      const ping = setInterval(() => {
        try { controller.enqueue(encoder.encode(`event: ping\n` + `data: keepalive\n\n`)) } catch {}
      }, 15000)

      // 轮询新消息
      const poll = setInterval(async () => {
        try {
          const next = await getMessagesByEvent(eventId!, 50, lastTs)
          if (next.length) await flush(next)
        } catch {}
      }, 1000)

      // 关闭处理
      ;(req as any).signal?.addEventListener?.('abort', () => {
        clearInterval(ping)
        clearInterval(poll)
        try { controller.close() } catch {}
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