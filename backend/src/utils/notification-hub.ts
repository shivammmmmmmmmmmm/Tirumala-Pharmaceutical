type Sender = (chunk: string) => void

const subscribers = new Map<string, Set<Sender>>()

export function subscribe(userId: string, send: Sender): () => void {
  if (!subscribers.has(userId)) subscribers.set(userId, new Set())
  subscribers.get(userId)!.add(send)
  return () => {
    subscribers.get(userId)?.delete(send)
    if (subscribers.get(userId)?.size === 0) subscribers.delete(userId)
  }
}

export function broadcast(userId: string, payload: Record<string, unknown>) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`
  subscribers.get(userId)?.forEach(fn => {
    try { fn(msg) } catch { /* client disconnected */ }
  })
}

export function broadcastMany(userIds: string[], payload: Record<string, unknown>) {
  for (const id of userIds) broadcast(id, payload)
}
