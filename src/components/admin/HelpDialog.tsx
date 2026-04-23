import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const SHORTCUTS: { group: string; items: { k: string; label: string }[] }[] = [
  {
    group: "Navigation",
    items: [
      { k: "F1", label: "Open this help" },
      { k: "F2", label: "Go to Dashboard" },
      { k: "F3", label: "Quick medicine search" },
      { k: "F8", label: "New Sale (POS)" },
      { k: "F9", label: "New Purchase / GRN" },
      { k: "F10", label: "New Payment Voucher" },
      { k: "F11", label: "Toggle fullscreen" },
      { k: "Alt+R", label: "Reports menu" },
      { k: "Alt+S", label: "Settings" },
      { k: "Esc", label: "Close any panel/modal" },
    ],
  },
  {
    group: "Inside vouchers",
    items: [
      { k: "Tab / Shift+Tab", label: "Next / previous field" },
      { k: "↑ ↓ Enter", label: "Navigate & select in dropdowns" },
      { k: "Enter on last field", label: "Add line, focus next item" },
      { k: "Ctrl+Enter", label: "Save & post the voucher" },
      { k: "Ctrl+Delete", label: "Remove focused line item" },
      { k: "F2 in number field", label: "Inline calculator" },
    ],
  },
  {
    group: "Quick page jump (Alt + N)",
    items: [
      { k: "Alt+1", label: "Dashboard" },
      { k: "Alt+2", label: "POS" },
      { k: "Alt+3", label: "Inventory" },
      { k: "Alt+4", label: "Stock Purchase" },
      { k: "Alt+5", label: "Batches" },
      { k: "Alt+8", label: "Accounting" },
      { k: "Alt+0", label: "Customers" },
    ],
  },
];

const HelpDialog = ({ open, onOpenChange }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Keyboard shortcuts</DialogTitle>
      </DialogHeader>
      <div className="grid sm:grid-cols-2 gap-6 mt-4">
        {SHORTCUTS.map((g) => (
          <div key={g.group}>
            <h3 className="font-semibold text-sm mb-2 text-primary">{g.group}</h3>
            <div className="space-y-1.5">
              {g.items.map((i) => (
                <div key={i.k} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{i.label}</span>
                  <kbd className="font-mono text-xs px-2 py-0.5 rounded bg-muted border border-border">{i.k}</kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </DialogContent>
  </Dialog>
);

export default HelpDialog;
