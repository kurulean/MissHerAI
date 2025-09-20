// src/lib/api.js

// src/lib/api.js
export const API_BASE = import.meta.env?.VITE_API_URL;
if (!API_BASE?.startsWith('http')) {
  throw new Error('Missing VITE_API_URL. Set it in Vercel (or .env.local for dev).');
}

export async function startSession({ text, images }) {
  const r = await fetch(`${API_BASE}/api/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, images }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function sendMessage(sessionId, { text, images = [] }) {
  const r = await fetch(`${API_BASE}/api/session/${sessionId}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, images }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
