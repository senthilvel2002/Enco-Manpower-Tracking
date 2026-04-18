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

const inputCls =
  "w-full rounded-xl border border-white/15 bg-slate-900/80 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-1 focus:ring-sky-400/20 transition";
const selectCls =
  "w-full rounded-xl border border-white/15 bg-slate-900/80 px-4 py-2.5 text-sm text-slate-100 focus:border-sky-400/60 focus:outline-none focus:ring-1 focus:ring-sky-400/20 transition cursor-pointer";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5";

function WorkerProfileView() {
  const { state } = useLocation();
  const [workers, setWorkers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [showNewWorker, setShowNewWorker] = useState(false);
  const [showWorkerEditor, setShowWorkerEditor] = useState(false);
  const [workerSearch, setWorkerSearch] = useState("");
  const [workerResults, setWorkerResults] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [newWorker, setNewWorker] = useState({ civil_id: "", name: "", designation: "", company_name: "" });
  const [workerEdit, setWorkerEdit] = useState({ civil_id: "", name: "", designation: "", company_name: "" });
  const [pendingCount, setPendingCount] = useState(0);

  const runWithLoading = useCallback(async (fn) => {
    setPendingCount((c) => c + 1);
    try { return await fn(); }
    finally { setPendingCount((c) => Math.max(0, c - 1)); }
  }, []);

  const loadWorkers = useCallback(async () => {
    try {
      const res = await runWithLoading(() => fetch(apiUrl("/api/workers")));
      const data = await res.json();
      if (data.ok) setWorkers(data.workers || []);
    } catch (e) { console.error(e); }
  }, [runWithLoading]);

  useEffect(() => { loadWorkers(); }, [loadWorkers]);

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const res = await runWithLoading(() => fetch(apiUrl("/api/master-data/options")));
        const data = await res.json();
        if (data.ok) setCompanies(data.companies || []);
      } catch { /* ignore */ }
    };
    loadCompanies();
  }, [runWithLoading]);

  useEffect(() => {
    const runSearch = async () => {
      const q = workerSearch.trim();
      if (!q) { setWorkerResults([]); return; }
      try {
        const params = new URLSearchParams({ q });
        const res = await runWithLoading(() => fetch(apiUrl(`/api/workers/search?${params}`)));
        const data = await res.json();
        if (data.ok) setWorkerResults(data.workers || []);
      } catch { /* ignore */ }
    };
    const t = setTimeout(runSearch, 220);
    return () => clearTimeout(t);
  }, [workerSearch, runWithLoading]);

  const selectWorker = (w) => {
    setSelectedWorker(w);
    setWorkerEdit({ civil_id: w.civil_id || "", name: w.name || "", designation: w.designation || "", company_name: w.company_name || "" });
  };

  const createWorker = async () => {
    try {
      const res = await runWithLoading(() => fetch(apiUrl("/api/workers"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWorker),
      }));
      const data = await res.json();
      if (!res.ok) { alert(data?.error || "Unable to add worker"); return; }
      alert("New worker added");
      setNewWorker({ civil_id: "", name: "", designation: "", company_name: "" });
      setShowNewWorker(false);
      loadWorkers();
    } catch { alert("Unable to add now"); }
  };

  const saveWorker = async () => {
    if (!workerEdit.civil_id) return;
    try {
      const res = await runWithLoading(() => fetch(apiUrl(`/api/workers/${workerEdit.civil_id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workerEdit.name, designation: workerEdit.designation, company_name: workerEdit.company_name }),
      }));
      const data = await res.json();
      if (!res.ok) { alert(data?.error || "Unable to update worker"); return; }
      alert("Worker updated");
      setSelectedWorker(null); setShowWorkerEditor(false); setWorkerSearch(""); setWorkerResults([]);
      loadWorkers();
    } catch { alert("Unable to update now"); }
  };

  const CardPanel = ({ children, className = "" }) => (
    <div className={`rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen min-h-[100dvh] w-full font-sans text-white mobile-bg-attachment-scroll" style={BG}>
      <LoadingOverlay show={pendingCount > 0} message="Loading profiles..." />

      {/* Top bar */}
      <header className="w-full sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
        <div className="flex items-center gap-4 px-4 sm:px-5 md:px-8 min-h-14">
          <img src="/Logo - Copy.png" alt="Encogroup" className="h-9 w-auto object-contain shrink-0" />
          <div className="border-l border-white/10 pl-4">
            <div className="text-sm font-bold text-white">Worker Profiles</div>
            <div className="text-xs text-slate-400">
              {state?.adminName || state?.civilId || "Management"}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button"
              onClick={() => { setShowNewWorker((v) => !v); setShowWorkerEditor(false); }}
              className="rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold px-4 py-2 transition">
              + Add Worker
            </button>
            <button type="button"
              onClick={() => { setShowWorkerEditor((v) => !v); setShowNewWorker(false); }}
              className="rounded-xl border border-white/20 hover:border-sky-400/50 text-slate-300 hover:text-white text-xs font-bold px-4 py-2 transition">
              Edit Worker
            </button>
            <Link to="/management" state={state}
              className="rounded-xl border border-white/20 hover:border-sky-400/40 text-slate-300 hover:text-sky-300 text-xs font-bold px-4 py-2 transition no-underline">
              ← Management
            </Link>
          </div>
        </div>
      </header>

      <div className="px-4 md:px-8 py-6 space-y-5">

        {/* ── Add Worker Panel ── */}
        {showNewWorker && (
          <CardPanel className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white">New Manpower Registration</h3>
              <button type="button" onClick={() => setShowNewWorker(false)}
                className="rounded-lg border border-white/15 hover:border-rose-400/40 text-slate-400 hover:text-rose-300 text-xs font-bold px-3 py-1.5 transition">
                Close
              </button>
            </div>
            <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
              onSubmit={(e) => { e.preventDefault(); createWorker(); }}>
              <div>
                <label className={labelCls}>Civil ID</label>
                <input type="text" className={inputCls} value={newWorker.civil_id}
                  onChange={(e) => setNewWorker((p) => ({ ...p, civil_id: e.target.value }))} required />
              </div>
              <div>
                <label className={labelCls}>Name Surname</label>
                <input type="text" className={inputCls} value={newWorker.name}
                  onChange={(e) => setNewWorker((p) => ({ ...p, name: e.target.value }))} required />
              </div>
              <div>
                <label className={labelCls}>Designation</label>
                <input type="text" className={inputCls} value={newWorker.designation}
                  onChange={(e) => setNewWorker((p) => ({ ...p, designation: e.target.value }))} required />
              </div>
              <div>
                <label className={labelCls}>Company</label>
                <select className={selectCls} value={newWorker.company_name}
                  onChange={(e) => setNewWorker((p) => ({ ...p, company_name: e.target.value }))} required>
                  <option value="">Select Company</option>
                  {companies.map((c) => <option key={c._id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <button type="submit"
                  className="rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold px-6 py-2.5 transition">
                  Save Worker
                </button>
              </div>
            </form>
          </CardPanel>
        )}

        {/* ── Worker Editor Panel ── */}
        {showWorkerEditor && (
          <CardPanel className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Update Worker Details</h3>
              <button type="button"
                onClick={() => { setShowWorkerEditor(false); setWorkerSearch(""); setWorkerResults([]); setSelectedWorker(null); }}
                className="rounded-lg border border-white/15 hover:border-rose-400/40 text-slate-400 hover:text-rose-300 text-xs font-bold px-3 py-1.5 transition">
                Close
              </button>
            </div>
            <input type="text" className={`${inputCls} max-w-md mb-4`}
              placeholder="Search by Civil ID or Name..."
              value={workerSearch} onChange={(e) => setWorkerSearch(e.target.value)} />
            {workerResults.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-slate-950/60 overflow-hidden mb-4 max-w-2xl">
                {workerResults.slice(0, 15).map((w) => (
                  <div key={w.civil_id}
                    className="flex items-center justify-between px-4 py-3 border-b border-white/5 hover:bg-sky-500/10 cursor-pointer transition gap-2"
                    onClick={() => selectWorker(w)}>
                    <span className="flex items-center gap-2 min-w-0">
                      <WorkerAvatar name={w.name} civilId={w.civil_id} profilePicture={w.profile_picture} sizeClass="w-8 h-8" rounded="xl" />
                      <span className="text-sm font-semibold text-slate-200 truncate">{w.name} <span className="text-slate-500">({w.civil_id})</span></span>
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">{w.company_name}</span>
                  </div>
                ))}
              </div>
            )}
            {selectedWorker && (
              <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                onSubmit={(e) => { e.preventDefault(); saveWorker(); }}>
                <div>
                  <label className={labelCls}>Civil ID (readonly)</label>
                  <input type="text" className={`${inputCls} opacity-60`} value={workerEdit.civil_id} readOnly />
                </div>
                <div>
                  <label className={labelCls}>Name Surname</label>
                  <input type="text" className={inputCls} value={workerEdit.name}
                    onChange={(e) => setWorkerEdit((p) => ({ ...p, name: e.target.value }))} required />
                </div>
                <div>
                  <label className={labelCls}>Designation</label>
                  <input type="text" className={inputCls} value={workerEdit.designation}
                    onChange={(e) => setWorkerEdit((p) => ({ ...p, designation: e.target.value }))} required />
                </div>
                <div>
                  <label className={labelCls}>Company</label>
                  <select className={selectCls} value={workerEdit.company_name}
                    onChange={(e) => setWorkerEdit((p) => ({ ...p, company_name: e.target.value }))} required>
                    <option value="">Select Company</option>
                    {companies.map((c) => <option key={c._id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                  <button type="submit"
                    className="rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold px-6 py-2.5 transition">
                    Save Changes
                  </button>
                </div>
              </form>
            )}
          </CardPanel>
        )}

        {/* ── Worker Cards Grid ── */}
        <CardPanel className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-white">All Workers</h3>
            <span className="text-xs text-slate-500 font-semibold">{workers.length} total</span>
          </div>
          {workers.length === 0 && (
            <div className="text-center py-12">
              <div className="text-slate-500 text-4xl mb-3">👷</div>
              <div className="text-slate-400 text-sm">No worker profiles found.</div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {workers.map((w) => (
              <div key={w.civil_id}
                className="group rounded-2xl border border-white/10 bg-slate-950/60 hover:border-sky-400/40 hover:bg-slate-800/60 p-5 cursor-pointer transition-all duration-200"
                onClick={() => { setShowWorkerEditor(true); setShowNewWorker(false); selectWorker(w); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && selectWorker(w)}>
                {/* Avatar */}
                <div className="flex items-center gap-3 mb-4">
                  <WorkerAvatar
                    name={w.name}
                    civilId={w.civil_id}
                    profilePicture={w.profile_picture}
                    sizeClass="w-11 h-11"
                    textClass="text-base font-black"
                    rounded="xl"
                  />
                  <div>
                    <div className="text-sm font-bold text-slate-100 group-hover:text-white leading-tight">{w.name || "-"}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{w.designation || "-"}</div>
                  </div>
                </div>
                {/* Info rows */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider">Civil ID</span>
                    <span className="text-xs font-mono font-semibold text-slate-300">{w.civil_id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider">Company</span>
                    <span className="text-xs font-semibold text-slate-300 text-right max-w-[120px] truncate" title={w.company_name}>{w.company_name || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider">Category</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                      w.category === "Indirect"
                        ? "text-violet-300 bg-violet-500/10 border-violet-400/20"
                        : "text-sky-300 bg-sky-500/10 border-sky-400/20"
                    }`}>
                      {w.category || "Direct"}
                    </span>
                  </div>
                </div>
                <div className="mt-4 text-xs text-sky-400/60 group-hover:text-sky-400 font-semibold transition">
                  Click to edit →
                </div>
              </div>
            ))}
          </div>
        </CardPanel>
      </div>
    </div>
  );
}

export default WorkerProfileView;
