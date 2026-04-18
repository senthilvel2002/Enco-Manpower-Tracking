function LoadingOverlay({ show, message = "Loading..." }) {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/90 px-12 py-9 shadow-2xl">
        <div className="h-11 w-11 rounded-full border-[3px] border-sky-400/25 border-t-sky-400 animate-spin" />
        <div className="text-sm font-semibold text-slate-300 tracking-wide">{message}</div>
      </div>
    </div>
  );
}

export default LoadingOverlay;
