import React, { useEffect, useRef, useState } from "react";
import "./App.css";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  process.env.REACT_APP_API_BASE ||
  "http://127.0.0.1:8000";

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

export default function App() {
  // steps: hero → paste → chat
  const [step, setStep] = useState("hero");
  const [heroFading, setHeroFading] = useState(false);
  const [pasteFading, setPasteFading] = useState(false);

  // session + chat state
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState([]); // {role:'user'|'assistant', content, images?, ts}
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  // paste box state
  const pasteEditableRef = useRef(null);
  const [pasteImages, setPasteImages] = useState([]);

  // chat composer state
  const chatEditableRef = useRef(null);
  const [chatImages, setChatImages] = useState([]);

  const logEndRef = useRef(null);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ---------- HERO ----------
  function onStartClick() {
    setHeroFading(true);
    setTimeout(() => setStep("paste"), 450);
  }

  // ---------- Paste: handlers ----------
  async function onPasteToBox(e) {
    const items = e.clipboardData?.items || [];
    const files = [];
    for (const it of items) {
      if (it.kind === "file" && it.type.startsWith("image/")) files.push(it.getAsFile());
    }
    if (!files.length) return; // allow normal text paste
    e.preventDefault();
    const urls = await Promise.all(files.map(fileToDataUrl));
    setPasteImages((prev) => [...prev, ...urls]);
  }
  const onBoxDragOver = (e) => e.preventDefault();
  async function onBoxDrop(e) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith("image/"));
    if (!files.length) return;
    const urls = await Promise.all(files.map(fileToDataUrl));
    setPasteImages((prev) => [...prev, ...urls]);
  }

  async function onContinueFromPaste() {
    setErr("");
    const text = (pasteEditableRef.current?.innerText || "").trim();
    if (!text && pasteImages.length === 0) {
      setErr("Please paste some text or screenshots.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, images: pasteImages }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json(); // { session_id, opening, profile }
      setSessionId(data.session_id);

      // seed the chat with assistant opening + the user's initial content
      if (text || pasteImages.length) {
        setMessages([
          ...(data.opening ? [{ role: "assistant", content: data.opening, ts: Date.now() }] : []),
          { role: "user", content: text, images: pasteImages.slice(), ts: Date.now() }
        ]);
      } else if (data.opening) {
        setMessages([{ role: "assistant", content: data.opening, ts: Date.now() }]);
      }

      // fade out paste, move to chat
      setPasteFading(true);
      setTimeout(() => {
        setStep("chat");
        // move composer focus ready to type
        setTimeout(() => chatEditableRef.current?.focus(), 50);
      }, 380);
    } catch (e) {
      setErr(e.message || "Failed to start.");
    } finally {
      setSending(false);
    }
  }

  // ---------- Chat: handlers ----------
  async function onSendChat() {
    if (sending) return;
    setErr("");

    const text = (chatEditableRef.current?.innerText || "").trim();
    if (!text && chatImages.length === 0) return;

    const userMsg = { role: "user", content: text, images: chatImages.slice(), ts: Date.now() };
    setMessages((m) => [...m, userMsg]);

    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/session/${sessionId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, images: chatImages }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json(); // { reply }
      setMessages((m) => [...m, { role: "assistant", content: data.reply, ts: Date.now() }]);

      // clear composer
      if (chatEditableRef.current) chatEditableRef.current.innerText = "";
      setChatImages([]);
    } catch (e) {
      setErr(e.message || "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  // paste/drag into chat composer
  async function onPasteToChat(e) {
    const items = e.clipboardData?.items || [];
    const files = [];
    for (const it of items) {
      if (it.kind === "file" && it.type.startsWith("image/")) files.push(it.getAsFile());
    }
    if (!files.length) return;
    e.preventDefault();
    const urls = await Promise.all(files.map(fileToDataUrl));
    setChatImages((prev) => [...prev, ...urls]);
  }
  const onChatDragOver = (e) => e.preventDefault();
  async function onChatDrop(e) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith("image/"));
    if (!files.length) return;
    const urls = await Promise.all(files.map(fileToDataUrl));
    setChatImages((prev) => [...prev, ...urls]);
  }
  function onChatKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendChat();
    }
  }

  // ---------- RENDER ----------
  if (step === "hero") {
    return (
      <section className={`hero ${heroFading ? "fade-out" : ""}`}>
        <h1 className="hero-title">MISSHERAI</h1>
        <p className="hero-subtitle">Talk to the ghost of your past lover.</p>
        <button className="hero-btn" onClick={onStartClick}>START MISSING</button>
      </section>
    );
  }

  if (step === "paste") {
    return (
      <section
        className={`upload-box fade-up-in ${pasteFading ? "fade-up-out" : ""}`}
        onDragOver={onBoxDragOver}
        onDrop={onBoxDrop}
      >
        <div className="upload-title">Upload Messages</div>
        <div className="upload-instructions">
          Paste screenshots or text. We’ll build the style from these.
        </div>

        <div>
          <div
            ref={pasteEditableRef}
            className="screenshot-input editable"
            contentEditable
            data-placeholder="Paste screenshots and text here…"
            onPaste={onPasteToBox}
            suppressContentEditableWarning
          />
        </div>

        {pasteImages.length > 0 && (
          <div className="pending-tray">
            {pasteImages.map((src, i) => (
              <img key={i} src={src} alt="" className="pasted-image" />
            ))}
          </div>
        )}

        <button className="submit-btn" onClick={onContinueFromPaste} disabled={sending}>
          {sending ? "Starting…" : "Continue"}
        </button>

        {err && <div className="error-text">{err}</div>}
      </section>
    );
  }

  // chat
  return (
    <section className="upload-box fade-up-in" onDragOver={onChatDragOver} onDrop={onChatDrop}>
      <div className="upload-title">Chat</div>
      <div className="upload-instructions">
        Type or paste images. Press Enter to send.
      </div>

      <div className="chat-log">
        {messages.map((m, i) => (
          <div key={i} className={`message-row ${m.role}`}>
            <div>
              <div className="bubble">
                {m.content && (
                  <div className={`bubble-text ${m.images?.length ? "mb-8" : ""}`}>{m.content}</div>
                )}
                {Array.isArray(m.images) && m.images.length > 0 && (
                  <div className="bubble-images">
                    {m.images.map((src, idx) => (
                      <img key={idx} src={src} alt="" className="pasted-image" />
                    ))}
                  </div>
                )}
              </div>
              <div className="timestamp">
                {m.ts ? new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
              </div>
            </div>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>

      <div
        ref={chatEditableRef}
        className="screenshot-input editable"
        contentEditable
        data-placeholder="iMessage your ex’s ghost…"
        onPaste={onPasteToChat}
        onKeyDown={onChatKeyDown}
        suppressContentEditableWarning
      />

      {chatImages.length > 0 && (
        <div className="pending-tray">
          {chatImages.map((src, i) => (
            <img key={i} src={src} alt="" className="pasted-image" />
          ))}
        </div>
      )}

      <button className="submit-btn" onClick={onSendChat} disabled={sending}>
        {sending ? "Sending…" : "Send"}
      </button>

      {err && <div className="error-text">{err}</div>}
    </section>
  );
}
