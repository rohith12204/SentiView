import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageCircle, X, Send, Mic, MicOff,
  RefreshCw, AlertCircle, Sparkles, ChevronDown, RotateCcw
} from 'lucide-react';
import { ChatMessage } from '../types';

// ─── Groq config ─────────────────────────────────────────────────────────────
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string;
const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.1-8b-instant';

// ─── System prompt — pure Groq, no DB needed ─────────────────────────────────
const SYSTEM_PROMPT = `You are Sentiview AI — a knowledgeable product intelligence assistant specialising in smartphones, tablets, laptops, and consumer electronics.

You answer ANY product-related question using your own knowledge. You do NOT need a database.

Your capabilities:
- 📱 Any smartphone or gadget: specs, pros, cons, known issues, user sentiment
- ⚖️ Compare any two or more products side-by-side (camera, battery, performance, price, value)
- 🔍 Recommend products based on budget, use case, or preference
- ⭐ Summarise what real users commonly say — praised features and common complaints
- 🕵️ Explain fake review patterns and how to spot them
- 📊 Explain sentiment scores, aspect analysis, and review analytics concepts
- 💡 Guide users to the right Sentiview feature (Search, Trending, Compare, Fake Review Analysis, Dashboard)

Response style:
- Conversational but data-driven
- Use bullet points and clear sections for comparisons or lists
- Use emojis sparingly — only where they add clarity
- Keep answers under 220 words unless the user explicitly asks for more detail
- Always end with one relevant follow-up suggestion or question
- If asked about a very obscure product you are unsure about, say so honestly and suggest a comparison with a known alternative

Sentiment score context (used in Sentiview):
- 0–39% positive = mostly negative reception
- 40–69% = mixed
- 70–100% = well received

You can answer about ANY brand: Apple, Samsung, Google, OnePlus, Xiaomi, Realme, POCO, Motorola, Sony, Nothing, Vivo, OPPO, Huawei, Nokia, and more. No product is off-limits.`;

// ─── Types ───────────────────────────────────────────────────────────────────
interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ExtendedChatMessage extends ChatMessage {
  isError?: boolean;
  isStreaming?: boolean;
}

// ─── Groq streaming call ─────────────────────────────────────────────────────
async function callGroq(
  messages: GroqMessage[],
  onToken: (token: string) => void,
  signal: AbortSignal
): Promise<void> {
  if (!GROQ_API_KEY || GROQ_API_KEY === 'gsk_your_groq_api_key_here') {
    throw new Error('NO_KEY');
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      stream: true,
      max_tokens: 600,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`Groq error ${res.status}: ${body}`);
  }

  const reader  = res.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      const trimmed = line.replace(/^data: /, '').trim();
      if (!trimmed || trimmed === '[DONE]') continue;
      try {
        const delta = JSON.parse(trimmed).choices?.[0]?.delta?.content ?? '';
        if (delta) onToken(delta);
      } catch { /* skip malformed */ }
    }
  }
}

// ─── Quick action suggestions ─────────────────────────────────────────────────
const QUICK_ACTIONS = [
  '📱 Best phone under ₹20,000?',
  '⚖️ iPhone 15 vs Samsung S24',
  '🔋 Which phone has best battery life?',
  '📷 Top 3 phones for camera?',
  '🕵️ How are fake reviews detected?',
  '📊 What is a sentiment score?',
];

// ─── Markdown-lite renderer ───────────────────────────────────────────────────
function renderText(text: string) {
  return text.split('\n').map((line, i, arr) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={i}>
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : <span key={j}>{part}</span>
        )}
        {i < arr.length - 1 && <br />}
      </span>
    );
  });
}

// ─── Welcome message ──────────────────────────────────────────────────────────
const WELCOME: ExtendedChatMessage = {
  id: 'welcome',
  sender: 'bot',
  timestamp: new Date(),
  text: "Hi! I'm **Sentiview AI** 👋\n\nI can answer questions about **any smartphone or gadget** — specs, comparisons, pros & cons, fake reviews, sentiment analysis, and more.\n\nJust ask me anything!",
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function ChatBot() {
  const [isOpen, setIsOpen]               = useState(false);
  const [messages, setMessages]           = useState<ExtendedChatMessage[]>([WELCOME]);
  const [input, setInput]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [isListening, setIsListening]     = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const bottomRef      = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const scrollRef      = useRef<HTMLDivElement>(null);
  const abortRef       = useRef<AbortController | null>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 80);
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setLoading(false);
    setMessages([{ ...WELCOME, timestamp: new Date() }]);
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    setLoading(false);
    setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
  };

  // ─── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ExtendedChatMessage = {
      id: Date.now().toString(),
      text: trimmed,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const botId = (Date.now() + 1).toString();
    setMessages(prev => [
      ...prev,
      { id: botId, text: '', sender: 'bot', timestamp: new Date(), isStreaming: true },
    ]);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Build full Groq message history
      const history: GroqMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
          .filter(m => !m.isError && m.id !== 'welcome')
          .map(m => ({
            role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.text,
          })),
        { role: 'user', content: trimmed },
      ];

      let fullText = '';

      await callGroq(
        history,
        (token) => {
          fullText += token;
          setMessages(prev =>
            prev.map(m => m.id === botId ? { ...m, text: fullText, isStreaming: true } : m)
          );
        },
        controller.signal
      );

      setMessages(prev =>
        prev.map(m => m.id === botId ? { ...m, isStreaming: false } : m)
      );

    } catch (err: any) {
      if (err.name === 'AbortError') { setLoading(false); return; }

      const errText = err.message === 'NO_KEY'
        ? '⚠️ **Groq API key not set.**\n\nAdd this to your `Frontend/.env` file:\n```\nVITE_GROQ_API_KEY=gsk_...\n```\nGet a free key at console.groq.com, then restart `npm run dev`.'
        : `⚠️ ${err.message ?? 'Something went wrong. Please try again.'}`;

      setMessages(prev =>
        prev.map(m => m.id === botId ? { ...m, text: errText, isStreaming: false, isError: true } : m)
      );
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [loading, messages]);

  // ─── Voice input ────────────────────────────────────────────────────────────
  const toggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Voice input not supported in this browser.'); return; }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const r = new SR();
    r.lang = 'en-IN';
    r.interimResults = false;
    r.onresult = (e: any) => { setInput(e.results[0][0].transcript); setIsListening(false); };
    r.onerror  = () => setIsListening(false);
    r.onend    = () => setIsListening(false);
    r.start();
    recognitionRef.current = r;
    setIsListening(true);
  };

  const isFirstMessage = messages.length <= 1;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* FAB */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-indigo-600 to-cyan-600
                     rounded-full shadow-lg hover:shadow-2xl transition-all duration-200
                     hover:scale-110 flex items-center justify-center z-50"
        >
          <MessageCircle className="w-6 h-6 text-white" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full animate-pulse" />
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[26rem] h-[640px] bg-white dark:bg-slate-900
                        rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700
                        flex flex-col z-50 overflow-hidden">

          {/* ── Header ── */}
          <div className="bg-gradient-to-r from-indigo-600 to-cyan-600 px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm leading-tight">Sentiview AI</h3>
                <p className="text-white/70 text-xs flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full inline-block ${loading ? 'bg-amber-300 animate-pulse' : 'bg-emerald-400'}`} />
                  {loading ? 'Thinking…' : 'Ask about any product'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {loading
                ? <button onClick={stopGeneration}
                    className="text-white/80 hover:text-white text-xs font-medium px-2 py-1
                               hover:bg-white/20 rounded-lg transition-colors">
                    Stop
                  </button>
                : <button onClick={clearChat} title="Clear chat"
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                    <RotateCcw className="w-4 h-4 text-white/80" />
                  </button>
              }
              <button onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors ml-1">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* ── Messages ── */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
          >
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[87%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-br from-indigo-600 to-cyan-600 text-white rounded-br-sm'
                    : msg.isError
                    ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 rounded-bl-sm'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'
                }`}>

                  {/* Typing dots */}
                  {msg.isStreaming && !msg.text ? (
                    <div className="flex items-center gap-1 py-0.5">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  ) : (
                    <>
                      {msg.isError && <AlertCircle size={13} className="inline mr-1 -mt-0.5 shrink-0" />}
                      <span className="whitespace-pre-line">{renderText(msg.text)}</span>
                      {msg.isStreaming && (
                        <span className="inline-block w-0.5 h-4 bg-current align-middle ml-0.5 animate-pulse" />
                      )}
                    </>
                  )}

                  <p className={`text-xs mt-1.5 ${
                    msg.sender === 'user' ? 'text-white/55' : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Scroll-to-bottom button */}
          {showScrollBtn && (
            <button onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="absolute bottom-[88px] right-4 w-8 h-8 bg-white dark:bg-slate-800
                         border border-gray-200 dark:border-slate-600 rounded-full shadow-md
                         flex items-center justify-center hover:bg-gray-50 transition-colors z-10">
              <ChevronDown size={15} className="text-gray-500 dark:text-gray-400" />
            </button>
          )}

          {/* ── Input area ── */}
          <div className="px-3 pb-3 pt-2 border-t border-gray-200 dark:border-slate-700 shrink-0">

            {/* Quick chips — only on fresh chat */}
            {isFirstMessage && (
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {QUICK_ACTIONS.map((action, i) => (
                  <button key={i} onClick={() => sendMessage(action)}
                    disabled={loading}
                    className="px-2.5 py-1 text-xs bg-indigo-50 dark:bg-indigo-900/30
                               text-indigo-700 dark:text-indigo-300 rounded-lg
                               border border-indigo-100 dark:border-indigo-800/40
                               hover:bg-indigo-100 dark:hover:bg-indigo-800/60
                               transition-colors disabled:opacity-50">
                    {action}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder={loading ? 'Generating…' : 'Ask about any phone, brand or feature…'}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-slate-800 rounded-xl text-sm
                           text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-indigo-400
                           disabled:opacity-60 border-none"
              />
              <button onClick={toggleVoice} title={isListening ? 'Stop' : 'Voice'}
                className={`p-2.5 rounded-xl transition-colors shrink-0 ${
                  isListening
                    ? 'bg-rose-500 hover:bg-rose-600 text-white'
                    : 'hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-gray-400'
                }`}>
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="p-2.5 bg-gradient-to-r from-indigo-600 to-cyan-600
                           hover:from-indigo-700 hover:to-cyan-700 rounded-xl
                           transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                {loading
                  ? <RefreshCw size={16} className="text-white animate-spin" />
                  : <Send size={16} className="text-white" />}
              </button>
            </div>

            <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-1.5">
              Groq · Llama 3.3 70B · Any product, any question
            </p>
          </div>
        </div>
      )}
    </>
  );
}