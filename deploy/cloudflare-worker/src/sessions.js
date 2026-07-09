export async function getSession(env, chatId) {
  const key = `session:${chatId}`;
  const data = await env.SESSIONS_KV.get(key, "json");
  return data || null;
}

export async function setSession(env, chatId, session) {
  const key = `session:${chatId}`;
  await env.SESSIONS_KV.put(key, JSON.stringify(session), { expirationTtl: 3600 });
}

export async function clearSession(env, chatId) {
  const key = `session:${chatId}`;
  await env.SESSIONS_KV.delete(key);
}

export async function getUser(env, chatId) {
  const key = `user:${chatId}`;
  const data = await env.USERS_KV.get(key, "json");
  return data || null;
}

export async function setUser(env, chatId, user) {
  const key = `user:${chatId}`;
  await env.USERS_KV.put(key, JSON.stringify(user));
}

const processedUpdates = new Set();
const PROCESSED_TTL = 120_000;

export function markUpdateProcessed(_env, updateId) {
  processedUpdates.add(updateId);
  setTimeout(() => processedUpdates.delete(updateId), PROCESSED_TTL);
}

export function isUpdateProcessed(_env, updateId) {
  return processedUpdates.has(updateId);
}
