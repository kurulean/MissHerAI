// src/lib/api.js

// Resolve API base from Vite env; fall back to localhost *only* in dev.
// Then normalize by stripping any trailing slash.
const RAW_API =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_URL) ||
  (typeof import.meta !== "undefined" &&
  import.meta.env &&
  import.meta.env.DEV
    ? "http://127.0.0.1:8000"
    : "");

export const API_BASE = RAW_API.replace(/\/+$/, "");

if (!API_BASE) {
  throw new Error(
    "Missing VITE_API_URL. Set it in Vercel (Production & Preview) or in frontend/.env.local for dev."
  );
}

// Expose for quick verification in the browser console: window.__API_BASE
if (typeof window !== "undefined") {
  window.__API_BASE = API_BASE;
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

// Helper to avoid unreadable error bodies
async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}
