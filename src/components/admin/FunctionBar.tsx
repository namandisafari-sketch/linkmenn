import { useNavigate } from "react-router-dom";

interface FnBtnProps {
  k: string;
  label: string;
  onClick: () => void;
  highlight?: boolean;
}

const FnBtn = ({ k, label, onClick, highlight }: FnBtnProps) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
      highlight
        ? "bg-primary text-primary-foreground hover:bg-primary/90"
        : "bg-muted text-foreground hover:bg-accent"
    }`}
    title={`${k} — ${label}`}
  >
    <kbd className="font-mono text-[10px] px-1 py-0.5 rounded bg-background/30">{k}</kbd>
    <span>{label}</span>
  </button>
);

interface Props {
  onSearch: () => void;
  onHelp: () => void;
}

const FunctionBar = ({ onSearch, onHelp }: Props) => {
  const navigate = useNavigate();
  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  };

  return (
    <div className="border-t border-border bg-background px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto shrink-0">
      <FnBtn k="F1" label="Help" onClick={onHelp} />
      <FnBtn k="F2" label="Dashboard" onClick={() => navigate("/admin")} />
      <FnBtn k="F3" label="Search" onClick={onSearch} highlight />
      <FnBtn k="F8" label="Sale" onClick={() => navigate("/admin/pos")} highlight />
      <FnBtn k="F9" label="Purchase" onClick={() => navigate("/admin/stock-purchase")} highlight />
      <FnBtn k="F10" label="Payment" onClick={() => navigate("/admin/accounting")} />
      <FnBtn k="F11" label="Fullscreen" onClick={toggleFs} />
      <div className="w-px h-5 bg-border mx-1" />
      <FnBtn k="Alt+R" label="Reports" onClick={() => navigate("/admin/reports-hub")} />
      <FnBtn k="Alt+S" label="Settings" onClick={() => navigate("/admin/settings")} />
      <FnBtn k="Esc" label="Close" onClick={() => { /* handled globally */ }} />
    </div>
  );
};

export default FunctionBar;
