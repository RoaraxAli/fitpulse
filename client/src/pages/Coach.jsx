import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth, useToast } from '../state';
import { navigate } from '../router';
import { Avatar, Button, Card, CardHead, Empty, PageHeader, Skeleton } from '../components/ui';
import { Icon } from '../icons';
import { API_BASE, api } from '../api';
import { classNames } from '../utils';

const SUGGESTIONS = [
  'Build me a 3-day full-body plan',
  'How much protein should I eat?',
  'Review my week and suggest one change',
  'I feel tired — should I train today?',
  'Help me hit my calorie goal with high-protein foods',
];

function renderMarkdown(text) {
  // Lightweight markdown → HTML: bold, bullets, line breaks. Safe: escape HTML first.
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const lines = escaped.split('\n');
  const out = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push('<div class="md-gap"></div>');
      continue;
    }
    if (/^#{1,3}\s/.test(line)) {
      if (inList) { out.push('</ul>'); inList = false; }
      const t = line.replace(/^#{1,3}\s/, '');
      out.push(`<p class="md-h">${applyInline(t)}</p>`);
      continue;
    }
    if (/^[-*]\s/.test(line)) {
      if (!inList) { out.push('<ul class="md-list">'); inList = true; }
      out.push(`<li>${applyInline(line.replace(/^[-*]\s/, ''))}</li>`);
      continue;
    }
    if (inList) { out.push('</ul>'); inList = false; }
    out.push(`<p>${applyInline(line)}</p>`);
  }
  if (inList) out.push('</ul>');
  return out.join('');
}

function applyInline(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>');
}

export function CoachPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [proStatus, setProStatus] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const listRef = useRef(null);
  const abortRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hashQuery = window.location.hash.split('?')[1] || '';
        const query = new URLSearchParams(hashQuery);
        const sessionId = query.get('checkout_session_id');
        if (sessionId) {
          const verified = await api.post('/billing/verify', { sessionId });
          if (cancelled) return;
          if (!verified.active) toast('Payment is still processing. Refresh in a moment.', 'error');
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/coach`);
        }
        const status = await api.get('/billing/status');
        if (!cancelled) setProStatus(status.active);
        if (!status.active) return;
        const data = await fetch(`${API_BASE}/chat`, { credentials: 'same-origin' }).then((r) => r.json());
        if (!cancelled) setMessages(data.messages || []);
      } catch {
        if (!cancelled) setProStatus(false);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  useEffect(() => { scrollToBottom(); }, [messages, streaming]);

  const send = async (text) => {
    const content = (text || input).trim();
    if (!content || streaming) return;
    setInput('');
    const userMsg = { role: 'user', content, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    // placeholder assistant message
    setMessages((prev) => [...prev, { role: 'assistant', content: '', createdAt: new Date().toISOString(), pending: true }]);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload) continue;
          let json;
          try { json = JSON.parse(payload); } catch { continue; }
          if (json.text) {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.pending) last.content += json.text;
              return next;
            });
          }
          if (json.message) {
            toast(json.message, 'error');
          }
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        toast(error.message || 'Chat failed.', 'error');
        setMessages((prev) => prev.filter((m) => !(m.pending && !m.content)));
      }
    } finally {
      setMessages((prev) => prev.map((m) => (m.pending ? { ...m, pending: false } : m)));
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const clearHistory = async () => {
    if (streaming) return;
    try {
      await fetch(`${API_BASE}/chat`, { method: 'DELETE', credentials: 'same-origin' });
      setMessages([]);
      toast('Conversation cleared.');
    } catch {
      toast('Could not clear history.', 'error');
    }
  };

  const startCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const result = await api.post('/billing/checkout', {});
      if (result.url) window.location.assign(result.url);
      else if (result.active) setProStatus(true);
    } catch (error) {
      toast(error.message || 'Could not start checkout.', 'error');
      setCheckoutLoading(false);
    }
  };

  if (proStatus !== true) {
    return (
      <div className="page-stack">
        <PageHeader eyebrow="AI Coach" title="Your personal trainer, on demand" subtitle="Unlock personalized AI coaching for your training and nutrition." />
        <Card className="coach-empty">
          <span className="empty-icon"><Icon name="sparkles" size={26} /></span>
          <h3>{loadingHistory ? 'Checking Coach Pro access…' : 'Unlock Coach Pro'}</h3>
          <p>A one-time $5 payment gives this account access to the AI Coach.</p>
          <Button icon="sparkles" onClick={startCheckout} disabled={loadingHistory || checkoutLoading}>
            {checkoutLoading ? 'Opening secure checkout…' : 'Unlock for $5'}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="AI Coach"
        title="Your personal trainer, on demand"
        subtitle="Ask anything about workouts, nutrition, recovery, or your tracked data."
        actions={
          <Button variant="ghost" size="sm" icon="trash" onClick={clearHistory} disabled={streaming || !messages.length}>
            Clear
          </Button>
        }
      />

      <Card className="coach-card">
        <div className="coach-messages" ref={listRef}>
          {loadingHistory ? (
            <div className="loading-block"><span className="spinner" /> Loading conversation…</div>
          ) : messages.length === 0 ? (
            <div className="coach-empty">
              <span className="empty-icon"><Icon name="sparkles" size={26} /></span>
              <h3>Hi {user?.name?.split(' ')[0] || 'there'} — ready when you are.</h3>
              <p>Try one of these, or type your own question.</p>
              <div className="coach-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className="chip" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={classNames('coach-msg', m.role === 'user' ? 'is-user' : 'is-assistant')}>
                {m.role === 'assistant' && (
                  <span className="coach-avatar"><Icon name="sparkles" size={14} /></span>
                )}
                <div className="coach-bubble">
                  {m.role === 'assistant' ? (
                    m.content ? (
                      <div className="coach-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                    ) : (
                      <span className="coach-typing"><span /><span /><span /></span>
                    )
                  ) : (
                    <p>{m.content}</p>
                  )}
                  {m.pending && m.content && <span className="coach-caret" />}
                </div>
              </div>
            ))
          )}
        </div>

        <form
          className="coach-input"
          onSubmit={(e) => {
            e.preventDefault();
            if (streaming) {
              abortRef.current?.abort();
              return;
            }
            send();
          }}
        >
          <input
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your coach anything…"
            disabled={streaming}
            maxLength={4000}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (streaming) abortRef.current?.abort();
                else send();
              }
            }}
          />
          <Button type="submit" icon={streaming ? 'close' : 'send'} disabled={!streaming && !input.trim()}>
            {streaming ? 'Stop' : 'Send'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
