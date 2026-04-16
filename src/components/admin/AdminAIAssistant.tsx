import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Loader2, Sparkles, Minimize2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { saveSessionState, getSessionState } from "@/lib/offline-db";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

type Msg = { role: "user" | "assistant"; content: string };

const AdminAIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hey Admin 👋 I'm **Marvid AI**. I can:\n\n• **Navigate** pages — *\"go to inventory\"*\n• **Create receipts** — *\"create receipt for John...\"*\n• **Check stock** — *\"how many Panadol in stock?\"*\n• **Analyze sales** — *\"today's revenue summary\"*\n• **Edit/delete** — *\"delete product X\"*\n\nI'm also connected to **n8n** for advanced automation." },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Persist messages to IndexedDB
  useEffect(() => {
    if (messages.length > 1) {
      saveSessionState("admin-ai-messages", messages);
    }
  }, [messages]);

  // Restore messages from IndexedDB on mount
  useEffect(() => {
    getSessionState<Msg[]>("admin-ai-messages").then((saved) => {
      if (saved && saved.length > 1) setMessages(saved);
    });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Handle navigation commands from AI
  const handleAIActions = (text: string) => {
    const navMatch = text.match(/\[NAV:([^\]]+)\]/);
    if (navMatch) {
      const path = navMatch[1].trim();
      if (path.startsWith("/admin")) navigate(path);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");

    const userMsg: Msg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
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
          messages: [...messages, userMsg],
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
              handleAIActions(assistantSoFar);
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
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${e.message}` }]);
    }
    setIsLoading(false);
  };

  const clearChat = () => {
    setMessages([messages[0]]);
    saveSessionState("admin-ai-messages", [messages[0]]);
  };

  const chatWidth = isExpanded ? "w-[560px]" : "w-[380px]";
  const chatHeight = isExpanded ? "h-[600px]" : "h-[440px]";

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {isOpen && (
        <div className={`mb-3 ${chatWidth} rounded-2xl bg-card shadow-2xl border border-border overflow-hidden flex flex-col transition-all duration-200`} style={{ maxHeight: "85vh" }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Marvid AI Assistant</p>
                <p className="text-[10px] text-white/60">n8n connected • {location.pathname}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10" onClick={() => setIsOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className={`flex-1 p-3 overflow-y-auto flex flex-col gap-2.5 ${chatHeight}`}>
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[88%] rounded-2xl p-3 text-sm leading-relaxed ${m.role === "user" ? "ml-auto bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:mt-1 [&>ul]:mb-0">
                    <ReactMarkdown>{m.content.replace(/\[NAV:[^\]]+\]/g, "")}</ReactMarkdown>
                  </div>
                ) : m.content}
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="bg-muted rounded-2xl rounded-bl-sm p-3 max-w-[85%] flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="px-3 pb-1 flex gap-1.5 flex-wrap">
            {["Today's sales?", "Low stock alert", "Create receipt"].map((q) => (
              <button key={q} onClick={() => { setInput(q); }} className="text-[10px] px-2.5 py-1 rounded-full bg-accent text-accent-foreground hover:bg-accent/80 transition-colors">
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border flex gap-2 shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask anything or give a command..."
              className="flex-1 text-sm bg-muted rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="icon" className="rounded-full h-9 w-9 bg-violet-600 hover:bg-violet-700" onClick={send} disabled={isLoading}>
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Footer */}
          <div className="px-3 pb-2 flex items-center justify-between">
            <button onClick={clearChat} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Clear chat</button>
            <span className="text-[10px] text-muted-foreground">Powered by Gemini + n8n</span>
          </div>
        </div>
      )}

      {/* Floating AI Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-14 w-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25 flex items-center justify-center hover:shadow-xl hover:scale-105 transition-all duration-200 group"
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
