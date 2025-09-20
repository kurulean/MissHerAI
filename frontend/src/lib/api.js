const fromVite =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_URL) || "";

const devFallback =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.DEV)
    ? "http://127.0.0.1:8000"
    : "";


export const API_BASE = (fromVite || devFallback).replace(/\/+$/, "");

if (typeof window !== "undefined") {
  window.__API_BASE = API_BASE;
}


async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

export async function startSession({ text, images = [] }) {
  if (!API_BASE) {
    throw new Error(
      "API base is not configured. Set VITE_API_URL in Vercel (Production & Preview) or .env.local for dev."
    );
  }
  const r = await fetch(`${API_BASE}/api/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, images }),
  });
  if (!r.ok) throw new Error(await safeText(r));
  return r.json(); // { session_id, opening, profile }
}

export async function sendMessage(sessionId, { text, images = [] }) {
  if (!API_BASE) {
    throw new Error(
      "API base is not configured. Set VITE_API_URL in Vercel (Production & Preview) or .env.local for dev."
    );
  }
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
