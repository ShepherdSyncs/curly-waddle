import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, X, Send, Bot, User as UserIcon, Church, Loader2 } from 'lucide-react';

const API = {
  async call(name, body = {}) {
    const res = await fetch(`/api/functions/v2/prod/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  },
};

function formatTime(d) {
  const date = new Date(d);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function VisitorChatWidget({ church }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionStatus, setSessionStatus] = useState('ai_active');
  const [visitorInfo, setVisitorInfo] = useState({ name: '', email: '' });
  const [showInfoForm, setShowInfoForm] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const storageKey = `ss_visitor_chat_${church.id}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessionId(parsed.sessionId || null);
        setVisitorInfo(parsed.visitorInfo || { name: '', email: '' });
      } catch {}
    }
  }, [storageKey]);

  const loadMessages = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await API.call('handleVisitorChat', { churchId: church.id, sessionId });
      if (res.messages) {
        setMessages(res.messages);
        if (res.session) setSessionStatus(res.session.status);
      }
    } catch {}
  }, [sessionId, church.id]);

  useEffect(() => {
    if (open && sessionId) {
      loadMessages();
      const interval = setInterval(loadMessages, 4000);
      return () => clearInterval(interval);
    }
  }, [open, sessionId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Show info form when waiting for pastoral and no email
  useEffect(() => {
    if (sessionStatus === 'waiting_for_pastoral' && !visitorInfo.email) {
      setShowInfoForm(true);
    }
  }, [sessionStatus, visitorInfo.email]);

  const handleSend = async () => {
    if (!text.trim() || loading) return;
    const msg = text.trim();
    setText('');
    setLoading(true);

    const tempMsg = { id: 'temp-' + Date.now(), sender_type: 'visitor', body: msg, created_date: new Date().toISOString() };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const res = await API.call('handleVisitorChat', {
        churchId: church.id,
        sessionId,
        message: msg,
        visitorName: visitorInfo.name,
        visitorEmail: visitorInfo.email,
      });
      if (res.sessionId && !sessionId) {
        setSessionId(res.sessionId);
        localStorage.setItem(storageKey, JSON.stringify({ sessionId: res.sessionId, visitorInfo }));
      }
      if (res.messages) {
        setMessages(res.messages);
        if (res.session) setSessionStatus(res.session.status);
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  const saveVisitorInfo = async () => {
    localStorage.setItem(storageKey, JSON.stringify({ sessionId, visitorInfo }));
    if (sessionId && (visitorInfo.name || visitorInfo.email)) {
      try {
        await API.call('handleVisitorChat', {
          churchId: church.id,
          sessionId,
          visitorName: visitorInfo.name,
          visitorEmail: visitorInfo.email,
        });
      } catch {}
    }
    setShowInfoForm(false);
  };

  const renderMessage = (msg) => {
    const isVisitor = msg.sender_type === 'visitor';
    const isSystem = msg.sender_type === 'system';
    const isAI = msg.sender_type === 'ai';
    const isPastoral = msg.sender_type === 'pastoral';

    if (isSystem) {
      return (
        <div key={msg.id} className="flex justify-center my-2">
          <div className="px-3 py-1.5 rounded-full bg-white/10 text-white/60 text-xs text-center max-w-[85%]">
            {msg.body}
          </div>
        </div>
      );
    }

    return (
      <div key={msg.id} className={`flex gap-2 ${isVisitor ? 'flex-row-reverse' : ''}`}>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
          isVisitor ? 'bg-primary' : isPastoral ? 'bg-green-600' : 'bg-white/15'
        }`}>
          {isVisitor
            ? <UserIcon className="w-3.5 h-3.5 text-white" />
            : isPastoral
              ? <Church className="w-3.5 h-3.5 text-white" />
              : <Bot className="w-3.5 h-3.5 text-white" />
          }
        </div>
        <div className={`max-w-[75%] flex flex-col gap-0.5 ${isVisitor ? 'items-end' : 'items-start'}`}>
          <div className="flex items-center gap-1.5 text-[10px] text-white/40">
            <span className="font-medium">
              {isVisitor ? (visitorInfo.name || 'You') : msg.sender_name || (isPastoral ? 'Pastoral Team' : 'Assistant')}
            </span>
            {msg.created_date && <span className="opacity-60">{formatTime(msg.created_date)}</span>}
          </div>
          <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed break-words ${
            isVisitor
              ? 'bg-primary text-white rounded-tr-sm'
              : isPastoral
                ? 'bg-green-600/80 text-white rounded-tl-sm'
                : 'bg-white/10 text-white rounded-tl-sm'
          }`}>
            {msg.body}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-primary text-white shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
          aria-label="Open chat"
        >
          <MessageSquare className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-slate-950" />
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-sm h-[500px] max-h-[70vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-slate-900">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-primary/80 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Church className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{church.name}</p>
                <p className="text-white/70 text-xs flex items-center gap-1">
                  {sessionStatus === 'pastoral_active' ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Pastoral Team is here</>
                  ) : sessionStatus === 'waiting_for_pastoral' ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Connecting to Pastoral Team</>
                  ) : (
                    <><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Online</>
                  )}
                </p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-white/40 text-center py-8">
                <MessageSquare className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Start a conversation with us!</p>
              </div>
            )}
            {messages.map(renderMessage)}
            {loading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-white/10 rounded-2xl rounded-tl-sm px-3 py-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Info form (when waiting for pastoral and no email) */}
          {showInfoForm && (
            <div className="p-3 border-t border-white/10 bg-slate-800/50 space-y-2">
              <p className="text-xs text-white/60">Leave your info so our Pastoral Team can follow up:</p>
              <input
                value={visitorInfo.name}
                onChange={e => setVisitorInfo({ ...visitorInfo, name: e.target.value })}
                placeholder="Your name"
                className="w-full px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm placeholder:text-white/30 border border-white/10 focus:outline-none focus:border-primary"
              />
              <input
                value={visitorInfo.email}
                onChange={e => setVisitorInfo({ ...visitorInfo, email: e.target.value })}
                placeholder="Email (for follow-up)"
                type="email"
                className="w-full px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm placeholder:text-white/30 border border-white/10 focus:outline-none focus:border-primary"
              />
              <button
                onClick={saveVisitorInfo}
                className="w-full py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90"
              >
                Save Info
              </button>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-white/10 flex gap-2 flex-shrink-0">
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 rounded-full bg-white/10 text-white text-sm placeholder:text-white/30 border border-white/10 focus:outline-none focus:border-primary"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || loading}
              className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 flex-shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}