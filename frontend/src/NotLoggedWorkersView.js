import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiUrl } from "./api";
import LoadingOverlay from "./LoadingOverlay";
import WorkerAvatar from "./WorkerAvatar";

const BG = {
  backgroundImage: `linear-gradient(rgba(2,6,23,0.88), rgba(2,6,23,0.97)), url(/sohar-oman.jpg)`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
};

function NotLoggedWorkersView() {
  const { state } = useLocation();
  const [selectedDate, setSelectedDate] = useState(
    state?.targetDate || new Date().toISOString().slice(0, 10)
  );
  const [workers, setWorkers] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);

  const runWithLoading = useCallback(async (fn) => {
    setPendingCount((c) => c + 1);
    try { return await fn(); }
    finally { setPendingCount((c) => Math.max(0, c - 1)); }
  }, []);

  const loadWorkers = useCallback(async () => {
    try {
      const params = new URLSearchParams({ anchor_date: selectedDate });
      const res = await runWithLoading(() =>
        fetch(apiUrl(`/api/management/not-logged-workers?${params}`))
      );
      const data = await res.json();
      if (data.ok) setWorkers(data.workers || []);
    } catch { alert("Unable to load workers"); }
  }, [selectedDate, runWithLoading]);

  useEffect(() => { loadWorkers(); }, [loadWorkers]);

  const sendReminder = async () => {
    if (!window.confirm("Send reminder email to all not-logged workers?")) return;
    try {
      const res = await runWithLoading(() =>
        fetch(apiUrl("/api/management/not-logged-workers/send-reminder"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anchor_date: selectedDate }),
        })
      );
      const data = await res.json();
      if (!res.ok) { alert(data?.error || "Unable to send reminder"); return; }
      alert(`Reminder sent: ${data.sent || 0} workers, skipped: ${data.skipped || 0}`);
    } catch { alert("Unable to send reminder now"); }
  };

  const COLS = ["Name", "Civil ID", "Designation", "Company", "Category"];

  return (
    <div className="min-h-screen min-h-[100dvh] w-full font-sans text-white mobile-bg-attachment-scroll" style={BG}>
      <LoadingOverlay show={pendingCount > 0} message="Loading workers..." />

      {/* Top bar */}
      <header className="w-full sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
        <div className="flex items-center gap-4 px-4 sm:px-5 md:px-8 min-h-14">
          <img src="/Logo - Copy.png" alt="Encogroup" className="h-9 w-auto object-contain shrink-0" />
          <div className="border-l border-white/10 pl-4">
            <div className="text-sm font-bold text-white">Not Logged Workers</div>
            <div className="text-xs text-slate-400">{selectedDate}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={sendReminder}
              className="rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold px-4 py-2 transition">
              ✉ Send Reminder
            </button>
            <Link to="/management" state={state}
              className="rounded-xl border border-white/20 hover:border-sky-400/40 text-slate-300 hover:text-sky-300 text-xs font-bold px-4 py-2 transition no-underline">
              ← Management
            </Link>
          </div>
        </div>
      </header>

      <div className="px-4 md:px-8 py-6 space-y-5">
        {/* Date picker + stats */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-5 flex flex-wrap items-center gap-5">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Date</div>
            <input type="date"
              className="rounded-xl border border-white/15 bg-slate-900/80 px-4 py-2.5 text-sm text-slate-100 focus:border-sky-400/60 focus:outline-none transition"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
          <div className="flex items-end gap-3">
            <div className="text-3xl font-black text-rose-300">{workers.length}</div>
            <div className="text-slate-400 text-sm pb-1">Workers not logged in</div>
          </div>
          {workers.length > 0 && (
            <div className="ml-auto">
              <button type="button" onClick={sendReminder}
                className="rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 text-amber-300 text-sm font-bold px-5 py-2.5 transition">
                Send Email Reminder to All ({workers.length})
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h3 className="text-base font-bold text-white">
              Workers Not Logged In — {selectedDate}
            </h3>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[700px] text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-slate-950/60">
                  {COLS.map((col) => (
                    <th key={col} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workers.length === 0 && (
                  <tr>
                    <td colSpan={COLS.length} className="px-5 py-12 text-center">
                      <div className="text-emerald-400 text-3xl mb-2">✓</div>
                      <div className="text-slate-400 text-sm">All workers logged in for this date.</div>
                    </td>
                  </tr>
                )}
                {workers.map((w) => (
                  <tr key={w._id || w.civil_id} className="border-b border-white/5 hover:bg-white/3 transition">
                    <td className="px-5 py-3 font-semibold text-slate-100">
                      <span className="inline-flex items-center gap-2">
                        <WorkerAvatar
                          name={w.name}
                          civilId={w.civil_id}
                          profilePicture={w.profile_picture}
                          sizeClass="w-8 h-8"
                          rounded="xl"
                        />
                        <span>{w.name || "-"}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-300 font-mono text-xs">{w.civil_id || "-"}</td>
                    <td className="px-5 py-3 text-slate-300">{w.designation || "-"}</td>
                    <td className="px-5 py-3 text-slate-300">{w.company_name || "-"}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        w.category === "Indirect"
                          ? "text-violet-300 bg-violet-500/10 border-violet-400/20"
                          : "text-sky-300 bg-sky-500/10 border-sky-400/20"
                      }`}>
                        {w.category || "Direct"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotLoggedWorkersView;
