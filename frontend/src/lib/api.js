// src/lib/api.js

// Hardcoded for stability. We'll switch back to env after it's stable.
export const API_BASE = "https://missherai-backend.onrender.com";

// (Optional) expose for debugging in the browser console
if (typeof window !== "undefined") window.__API_BASE = API_BASE;

// Helper to avoid unreadable error bodies
async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

export async function startSession({ text, images = [] }) {
  const r = await fetch(`${API_BASE}/api/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, images }),
  });
  if (!r.ok) throw new Error(await safeText(r));
  return r.json(); // { session_id, opening, profile }
}

export async function sendMessage(sessionId, { text, images = [] }) {
  const r = await fetch(
    `${API_BASE}/api/session/${encodeURIComponent(sessionId)}/send`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, images }),
    }
  );
  if (!r.ok) throw new Error(await safeText(r));
  return r.json(); // { reply }
}
