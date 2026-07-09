const sessions = new Map();
const SESSION_TTL = 3_600_000;

export async function getSession(_env, chatId) {
  const key = `session:${chatId}`;
  const entry = sessions.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    sessions.delete(key);
    return null;
  }
  return entry.data;
}

export async function setSession(_env, chatId, session) {
  const key = `session:${chatId}`;
  sessions.set(key, { data: session, expiresAt: Date.now() + SESSION_TTL });
}

export async function clearSession(_env, chatId) {
  const key = `session:${chatId}`;
  sessions.delete(key);
}

// User data is persisted via D1 upsertUser; no KV writes needed.
export function getUser() { return null; }
export function setUser() {}

const processedUpdates = new Set();
const PROCESSED_TTL = 120_000;

export function markUpdateProcessed(_env, updateId) {
  processedUpdates.add(updateId);
  setTimeout(() => processedUpdates.delete(updateId), PROCESSED_TTL);
}

export function isUpdateProcessed(_env, updateId) {
  return processedUpdates.has(updateId);
}
