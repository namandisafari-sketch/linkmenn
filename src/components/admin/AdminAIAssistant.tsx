import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, X, Send, Loader2, Sparkles, Minimize2, Maximize2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { saveSessionState, getSessionState } from "@/lib/offline-db";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
const STORAGE_KEY = "admin-ai-messages";

type Msg = { role: "user" | "assistant"; content: string };

const INITIAL_MSG: Msg = {
  role: "assistant",
  content: "Hey Admin 👋 I'm **Marvid AI**. I can:\n\n• **Navigate** — *\"go to inventory\"*, *\"open POS\"*\n• **Create receipts** — *\"create receipt for John...\"*\n• **Check stock** — *\"how many Panadol?\"*\n• **Analyze sales** — *\"today's revenue\"*\n• **Manage data** — *\"show low stock alerts\"*\n\nConnected to **n8n** for automation. What do you need?",
};

const AdminAIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([INITIAL_MSG]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [restored, setRestored] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Restore messages from IndexedDB on mount
  useEffect(() => {
    getSessionState<Msg[]>(STORAGE_KEY).then((saved) => {
      if (saved && saved.length > 0) {
        setMessages(saved);
      }
      setRestored(true);
    });
  }, []);

  // Persist messages to IndexedDB whenever they change (after restore)
  useEffect(() => {
    if (restored && messages.length > 0) {
      saveSessionState(STORAGE_KEY, messages);
    }
  }, [messages, restored]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Parse and execute action blocks from AI response
  const executeActions = useCallback((text: string) => {
    const actionRegex = /```action\s*\n?([\s\S]*?)```/g;
    let match;
    while ((match = actionRegex.exec(text)) !== null) {
      try {
        const action = JSON.parse(match[1].trim());
        if (action.type === "navigate" && action.path) {
          setTimeout(() => navigate(action.path), 300);
        }
      } catch {
        // ignore parse errors
      }
    }
  }, [navigate]);

  const send = async (overrideText?: string) => {
    const text = (overrideText || input).trim();
    if (!text || isLoading) return;
    if (!overrideText) setInput("");

    const userMsg: Msg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    let assistantSoFar = "";
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: newMessages,
          context: { currentPage: location.pathname, isAdmin: true },
        }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to connect");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && prev.length > 1 && prev[prev.length - 2]?.role === "user") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Execute any actions in the final response
      if (assistantSoFar) {
        executeActions(assistantSoFar);
      }
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${e.message}` }]);
    }
    setIsLoading(false);
  };

  const clearChat = () => {
    setMessages([INITIAL_MSG]);
    saveSessionState(STORAGE_KEY, [INITIAL_MSG]);
  };

  // Strip action blocks from display
  const cleanContent = (text: string) => text.replace(/```action\s*\n?[\s\S]*?```/g, "").trim();

  const chatWidth = isExpanded ? "w-[560px]" : "w-[380px]";

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {isOpen && (
        <div className={`mb-3 ${chatWidth} rounded-2xl bg-card shadow-2xl border border-border overflow-hidden flex flex-col transition-all duration-200`} style={{ maxHeight: "80vh" }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Marvid AI Assistant</p>
                <p className="text-[10px] text-white/60">n8n ready • {location.pathname.replace("/admin", "").replace("/", "") || "dashboard"}</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10" onClick={clearChat}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10" onClick={() => setIsOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 p-3 overflow-y-auto flex flex-col gap-2.5" style={{ minHeight: isExpanded ? 420 : 300, maxHeight: isExpanded ? 500 : 350 }}>
            {messages.map((m, i) => {
              const display = m.role === "assistant" ? cleanContent(m.content) : m.content;
              if (!display) return null;
              return (
                <div key={i} className={`max-w-[88%] rounded-2xl p-3 text-sm leading-relaxed ${m.role === "user" ? "ml-auto bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:mt-1 [&>ul]:mb-0">
                      <ReactMarkdown>{display}</ReactMarkdown>
                    </div>
                  ) : display}
                </div>
              );
            })}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="bg-muted rounded-2xl rounded-bl-sm p-3 max-w-[85%] flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="px-3 pb-1 flex gap-1.5 flex-wrap">
            {["Go to POS", "Today's sales?", "Low stock alert", "Open inventory", "Create receipt"].map((q) => (
              <button key={q} onClick={() => send(q)} className="text-[10px] px-2.5 py-1 rounded-full bg-accent text-accent-foreground hover:bg-accent/80 transition-colors">
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border flex gap-2 shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask anything or give a command..."
              className="flex-1 text-sm bg-muted rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="icon" className="rounded-full h-9 w-9 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white" onClick={() => send()} disabled={isLoading}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Floating AI Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-14 w-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25 flex items-center justify-center hover:shadow-xl hover:scale-105 transition-all duration-200 group"
        title="Marvid AI Assistant"
      >
        {isOpen ? (
          <X className="h-5 w-5 text-white" />
        ) : (
          <Bot className="h-6 w-6 text-white group-hover:scale-110 transition-transform" />
        )}
      </button>
    </div>
  );
};

export default AdminAIAssistant;
