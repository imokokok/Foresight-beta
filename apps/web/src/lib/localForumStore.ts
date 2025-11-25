import fs from 'fs'
import path from 'path'

export interface Thread {
  id: number
  event_id: number
  title: string
  content: string
  user_id: string
  created_at: string
  upvotes: number
  downvotes: number
}

export interface Comment {
  id: number
  thread_id: number
  event_id: number
  user_id: string
  content: string
  created_at: string
  upvotes: number
  downvotes: number
  parent_id?: number | null
}

const DATA_DIR = path.join(process.cwd(), '.data')
const THREAD_PATH = path.join(DATA_DIR, 'forum_threads.json')
const COMMENT_PATH = path.join(DATA_DIR, 'forum_comments.json')

function ensureDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
  } catch {}
}

async function readFileSafe(file: string): Promise<string | null> {
  try { return await fs.promises.readFile(file, 'utf-8') } catch { return null }
}

async function loadThreads(): Promise<Thread[]> {
  ensureDir()
  const content = await readFileSafe(THREAD_PATH)
  if (!content) return []
  try { const data = JSON.parse(content); return Array.isArray(data) ? data as Thread[] : [] } catch { return [] }
}

async function loadComments(): Promise<Comment[]> {
  ensureDir()
  const content = await readFileSafe(COMMENT_PATH)
  if (!content) return []
  try { const data = JSON.parse(content); return Array.isArray(data) ? data as Comment[] : [] } catch { return [] }
}

async function saveThreads(records: Thread[]): Promise<void> {
  ensureDir(); const json = JSON.stringify(records, null, 2); await fs.promises.writeFile(THREAD_PATH, json, 'utf-8')
}

async function saveComments(records: Comment[]): Promise<void> {
  ensureDir(); const json = JSON.stringify(records, null, 2); await fs.promises.writeFile(COMMENT_PATH, json, 'utf-8')
}

export async function getThreadsByEvent(eventId: number): Promise<Thread[]> {
  const threads = await loadThreads()
  const list = threads.filter(t => t.event_id === eventId)
  // 默认按热度排序（upvotes - downvotes），相同热度按时间新到旧
  list.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return list
}

export async function getThreadWithComments(eventId: number): Promise<Array<Thread & { comments: Comment[] }>> {
  const [threads, comments] = await Promise.all([loadThreads(), loadComments()])
  const map: Record<number, Comment[]> = {}
  comments.forEach(c => {
    if (!map[c.thread_id]) map[c.thread_id] = []
    map[c.thread_id].push(c)
  })
  Object.values(map).forEach(list => list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()))
  return threads.filter(t => t.event_id === eventId).map(t => ({ ...t, comments: map[t.id] || [] }))
}

export async function addThread(userId: string, eventId: number, title: string, content: string): Promise<Thread> {
  const threads = await loadThreads()
  const nextId = (threads.reduce((max, t) => Math.max(max, t.id), 0) || 0) + 1
  const now = new Date().toISOString()
  const thread: Thread = {
    id: nextId,
    event_id: eventId,
    title: String(title || '').slice(0, 200),
    content: String(content || '').slice(0, 4000),
    user_id: userId || 'guest',
    created_at: now,
    upvotes: 0,
    downvotes: 0
  }
  threads.push(thread)
  await saveThreads(threads)
  return thread
}

export async function addComment(userId: string, eventId: number, threadId: number, content: string, parentId?: number | null): Promise<Comment> {
  const comments = await loadComments()
  const nextId = (comments.reduce((max, c) => Math.max(max, c.id), 0) || 0) + 1
  const now = new Date().toISOString()
  const comment: Comment = {
    id: nextId,
    thread_id: threadId,
    event_id: eventId,
    user_id: userId || 'guest',
    content: String(content || '').slice(0, 4000),
    created_at: now,
    upvotes: 0,
    downvotes: 0,
    parent_id: parentId ?? null
  }
  comments.push(comment)
  await saveComments(comments)
  return comment
}

export async function voteThread(threadId: number, dir: 'up' | 'down'): Promise<Thread | null> {
  const threads = await loadThreads()
  const t = threads.find(x => x.id === threadId)
  if (!t) return null
  if (dir === 'up') t.upvotes += 1; else t.downvotes += 1
  await saveThreads(threads)
  return t
}

export async function voteComment(commentId: number, dir: 'up' | 'down'): Promise<Comment | null> {
  const comments = await loadComments()
  const c = comments.find(x => x.id === commentId)
  if (!c) return null
  if (dir === 'up') c.upvotes += 1; else c.downvotes += 1
  await saveComments(comments)
  return c
}

export async function getThreadById(threadId: number): Promise<Thread | null> {
  const threads = await loadThreads()
  return threads.find(x => x.id === threadId) || null
}

export async function getCommentById(commentId: number): Promise<Comment | null> {
  const comments = await loadComments()
  return comments.find(x => x.id === commentId) || null
}