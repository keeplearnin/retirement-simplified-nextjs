'use client';

import { useState, useEffect, useRef } from 'react';
import Card from '@/components/ui/Card';
import { AI_SUGGESTED_QUESTIONS } from '@/lib/constants';

export default function AIAdvisor() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function sendMessage(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    const userMsg = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.text }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const quickTopics = [
    'How do I start?',
    'Roth vs Traditional',
    'Am I saving enough?',
    'What about inflation?',
    'Tax-loss harvesting',
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          🤖 AI Financial Educator
        </h2>
        <p style={{ color: '#888', margin: '4px 0 8px', fontSize: 14 }}>
          Ask questions about retirement planning, investing, and personal finance.
        </p>
        <span
          style={{
            display: 'inline-block',
            background: '#332b00',
            color: '#fbbf24',
            fontSize: 12,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 20,
          }}
        >
          Educational tool only — not financial advice
        </span>
      </div>

      {/* Chat area */}
      <Card>
        <div ref={chatRef} style={{ height: 440, overflowY: 'auto', padding: 8 }}>
          {messages.length === 0 ? (
            <div>
              <p style={{ color: '#aaa', textAlign: 'center', marginBottom: 16, fontSize: 14 }}>
                Choose a question to get started, or type your own below.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {AI_SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      color: '#ccc',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: 13,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    background:
                      msg.role === 'user'
                        ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                        : 'rgba(255,255,255,0.07)',
                    color: '#fff',
                    padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    maxWidth: '80%',
                    fontSize: 14,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>
              ))}
              {loading && (
                <div
                  style={{
                    alignSelf: 'flex-start',
                    background: 'rgba(255,255,255,0.07)',
                    color: '#aaa',
                    padding: '10px 14px',
                    borderRadius: '16px 16px 16px 4px',
                    fontSize: 14,
                    animation: 'fade 1.2s ease-in-out infinite',
                  }}
                >
                  Thinking...
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Input bar */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && sendMessage(input)}
          placeholder="Ask about retirement, investing, taxes..."
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            padding: '10px 14px',
            color: '#fff',
            fontSize: 14,
            outline: 'none',
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{
            background: loading || !input.trim() ? '#444' : '#6366f1',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '10px 18px',
            fontWeight: 600,
            fontSize: 14,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          Send
        </button>
      </div>

      {/* Quick topic buttons */}
      {messages.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {quickTopics.map((topic) => (
            <button
              key={topic}
              onClick={() => sendMessage(topic)}
              disabled={loading}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 20,
                padding: '6px 14px',
                color: '#aaa',
                fontSize: 12,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            >
              {topic}
            </button>
          ))}
        </div>
      )}

      {/* Fade animation for loading */}
      <style>{`
        @keyframes fade {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
