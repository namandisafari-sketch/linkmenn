import { useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

const ChatBubble = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="mb-4 w-80 rounded-2xl bg-card shadow-xl border border-border animate-slide-up overflow-hidden">
          <div className="gradient-primary p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-primary-foreground">Marvid Support</p>
              <p className="text-xs text-primary-foreground/70">Typically replies instantly</p>
            </div>
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4 h-64 flex flex-col justify-end gap-3">
            <div className="bg-muted rounded-2xl rounded-bl-sm p-3 max-w-[80%]">
              <p className="text-sm">Hello! 👋 How can we help you today? Ask about medicines, prescriptions, or orders.</p>
            </div>
          </div>
          <div className="p-3 border-t border-border flex gap-2">
            <input
              type="text"
              placeholder="Type a message..."
              className="flex-1 text-sm bg-muted rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="icon" className="rounded-full h-9 w-9">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-14 w-14 rounded-full gradient-primary shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow animate-pulse-soft"
      >
        <MessageCircle className="h-6 w-6 text-primary-foreground" />
      </button>
    </div>
  );
};

export default ChatBubble;
