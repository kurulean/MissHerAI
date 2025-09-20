// src/lib/api.js

// Vite: reads VITE_API_BASE from frontend/.env.local
export const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  process.env.REACT_APP_API_BASE ||
  "http://127.0.0.1:8000";

export async function startSession({ text, images }) {
  const r = await fetch(`${API_BASE}/api/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, images }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json(); // { session_id, opening, profile }
}

export async function sendMessage(sessionId, { text, images = [] }) {
  const r = await fetch(`${API_BASE}/api/session/${sessionId}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, images }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json(); // { reply }
}
