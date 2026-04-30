import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiUrl } from "./api";
import LoadingOverlay from "./LoadingOverlay";
import WorkerAvatar from "./WorkerAvatar";
import { formatWorkerProfileTooltip } from "./workerProfileTooltip";

const BG = {
  backgroundImage: `linear-gradient(rgba(2,6,23,0.88), rgba(2,6,23,0.97)), url(/sohar-oman.jpg)`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
};

const inputCls =
  "rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-1 focus:ring-sky-400/20 transition";
const selectSmCls =
  "rounded-lg border border-white/15 bg-slate-900/80 px-2 py-1.5 text-xs text-slate-100 focus:border-sky-400/60 focus:outline-none transition cursor-pointer disabled:opacity-50";

const PILL = {
  approved: "inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-bold px-2.5 py-0.5",
  rejected: "inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-400/30 text-rose-300 text-xs font-bold px-2.5 py-0.5",
  pending: "inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-bold px-2.5 py-0.5",
};

const rowBg = {
  approved: "bg-emerald-500/5 border-l-2 border-emerald-500/50",
  rejected: "bg-rose-500/5 border-l-2 border-rose-500/50",
  pending: "border-l-2 border-transparent",
};

// ── Reject Modal ──────────────────────────────────────────────────────────────
function RejectModal({ onConfirm, onCancel }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-rose-400/30 bg-slate-900 p-6 shadow-2xl">
        <h3 className="text-base font-bold text-white mb-1">Reject Entry</h3>
        <p className="text-xs text-slate-400 mb-4">Please provide a reason for rejection.</p>
        <textarea
          rows={3}
          className="w-full rounded-xl border border-white/15 bg-slate-800 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-rose-400/60 focus:outline-none resize-none"
          placeholder="Enter rejection reason..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-3 mt-4">
          <button type="button" onClick={onCancel}
            className="rounded-xl border border-white/20 text-slate-400 hover:text-white text-xs font-bold px-4 py-2 transition">
            Cancel
          </button>
          <button type="button"
            disabled={!reason.trim()}
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            className="rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 transition">
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Worker Entries Tab ─────────────────────────────────────────────────────────
function WorkerEntriesTab({ adminName }) {
  const [entries, setEntries] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [pendingCount, setPendingCount] = useState(0);
  const [filters, setFilters] = useState({ date: "", location: "", permitIssuer: "" });
  const [rejectTarget, setRejectTarget] = useState(null);

  const runWithLoading = useCallback(async (fn) => {
    setPendingCount((c) => c + 1);
    try { return await fn(); }
    finally { setPendingCount((c) => Math.max(0, c - 1)); }
  }, []);

  const loadEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.date) params.set("date", filters.date);
      if (filters.location) params.set("location", filters.location);
      if (filters.permitIssuer) params.set("permit_issuer", filters.permitIssuer);
      const res = await runWithLoading(() =>
        fetch(apiUrl(`/api/site-incharge/today-entries?${params}`))
      );
      const data = await res.json();
      if (data.ok) setEntries(data.entries || []);
    } catch (e) { console.error(e); }
  }, [filters.date, filters.location, filters.permitIssuer, runWithLoading]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const approveHours = async (entryId) => {
    const target = entries.find((i) => i._id === entryId);
    if (target?.approval_status === "approved" || target?.hours != null) { alert("Already approved"); return; }
    const attendance_status = attendanceMap[entryId] || "";
    const hours = target?.worker_hours;
    if (hours == null || hours === "") { alert("Worker hours not submitted yet"); return; }
    try {
      const res = await runWithLoading(() => fetch(apiUrl(`/api/site-incharge/entries/${entryId}/hours`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours, attendance_status }),
      }));
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Unable to approve"); return; }
      loadEntries();
    } catch { alert("Unable to approve now"); }
  };

  const rejectEntry = async (entryId, reason) => {
    try {
      const res = await runWithLoading(() => fetch(apiUrl(`/api/site-incharge/entries/${entryId}/reject`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejection_reason: reason }),
      }));
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Unable to reject"); return; }
      setRejectTarget(null);
      loadEntries();
    } catch { alert("Unable to reject now"); }
  };

  const getStatus = (entry) => {
    if (entry.approval_status === "approved" || entry.hours != null) return "approved";
    if (entry.approval_status === "rejected") return "rejected";
    return "pending";
  };

  const COLS = [
    "Worker", "Work date", "Designation", "Company", "Location", "Permit Issuer",
    "Activity", "Shift", "Leave Reason", "Time (From→To)",
    "Worker Hrs", "Incharge", "Status", "Action",
  ];

  return (
    <>
      <LoadingOverlay show={pendingCount > 0} message="Loading entries..." />
      {rejectTarget && (
        <RejectModal
          onConfirm={(reason) => rejectEntry(rejectTarget, reason)}
          onCancel={() => setRejectTarget(null)}
        />
      )}
      <div className="space-y-5">
        {/* Filter bar */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-4 flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Filters</span>
          <input type="date" className={inputCls} value={filters.date}
            onChange={(e) => setFilters((p) => ({ ...p, date: e.target.value }))} />
          <input type="text" className={inputCls} placeholder="Location..."
            value={filters.location}
            onChange={(e) => setFilters((p) => ({ ...p, location: e.target.value }))} />
          <input type="text" className={inputCls} placeholder="Permit Issuer..."
            value={filters.permitIssuer}
            onChange={(e) => setFilters((p) => ({ ...p, permitIssuer: e.target.value }))} />
          <button type="button"
            onClick={() => setFilters({ date: "", location: "", permitIssuer: "" })}
            className="rounded-xl border border-white/20 hover:border-white/40 text-slate-400 hover:text-white text-xs font-bold px-4 py-2 transition">
            Clear
          </button>
          <span className="ml-auto text-xs text-slate-500 font-semibold">
            {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
          </span>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-base font-bold text-white">👷 Logged Workers</h3>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[1400px] text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-slate-950/60">
                  {COLS.map((col) => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={COLS.length} className="px-4 py-10 text-center text-slate-500 text-sm">
                      No entries found for the selected filters.
                    </td>
                  </tr>
                )}
                {entries.map((entry) => {
                  const st = getStatus(entry);
                  return (
                    <tr key={entry._id} className={`border-b border-white/5 hover:bg-white/3 transition ${rowBg[st]}`}>
                      <td className="px-4 py-3 font-semibold text-slate-100 max-w-[min(28rem,40vw)]">
                        <span className="inline-flex items-start gap-2">
                          <WorkerAvatar
                            name={entry.worker_name}
                            civilId={entry.civil_id}
                            profilePicture={entry.profile_picture}
                            sizeClass="w-8 h-8"
                            title={formatWorkerProfileTooltip(entry.worker_profile, entry)}
                          />
                          <span className="break-words whitespace-normal leading-snug">{entry.worker_name || "-"}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-200 whitespace-nowrap font-mono text-xs">
                        {entry.work_date || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{entry.designation || "-"}</td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{entry.company_name || "-"}</td>
                      <td className="px-4 py-3 text-slate-300">{entry.location || "-"}</td>
                      <td className="px-4 py-3 text-slate-300">{entry.permit_issuer || "-"}</td>
                      <td className="px-4 py-3 text-slate-300 max-w-[180px] truncate" title={entry.today_activity}>{entry.today_activity || "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                          entry.worker_shift === "Request for leave"
                            ? "text-amber-300 bg-amber-500/10 border-amber-400/20"
                            : entry.worker_shift === "Night"
                              ? "text-violet-300 bg-violet-500/10 border-violet-400/20"
                              : "text-sky-300 bg-sky-500/10 border-sky-400/20"
                        }`}>
                          {entry.worker_shift || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 max-w-[140px]">
                        {entry.leave_reason
                          ? <span title={entry.leave_reason} className="cursor-help underline decoration-dotted text-amber-300">
                              {entry.leave_reason.length > 20 ? entry.leave_reason.slice(0, 20) + "…" : entry.leave_reason}
                            </span>
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                        {entry.worker_time_from && entry.worker_time_to
                          ? `${entry.worker_time_from} → ${entry.worker_time_to}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-sky-300">
                          {entry.worker_hours != null ? entry.worker_hours : "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{entry.incharge || "-"}</td>
                      <td className="px-4 py-3">
                        <select
                          className={selectSmCls}
                          value={attendanceMap[entry._id] ?? entry.attendance_status ?? ""}
                          disabled={entry.approval_status === "approved" || entry.approval_status === "rejected" || entry.hours != null}
                          onChange={(e) => setAttendanceMap((p) => ({ ...p, [entry._id]: e.target.value }))}>
                          <option value="">Null</option>
                          <option value="Idle">Idle</option>
                          <option value="Non idle">Non idle</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {st === "approved" ? (
                          <span className={PILL.approved}>✓ Approved</span>
                        ) : st === "rejected" ? (
                          <span className={PILL.rejected}>✗ Rejected</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => approveHours(entry._id)}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 transition whitespace-nowrap">
                              Approve
                            </button>
                            <button type="button" onClick={() => setRejectTarget(entry._id)}
                              className="rounded-lg bg-rose-700/80 hover:bg-rose-600 text-white text-xs font-bold px-3 py-1.5 transition">
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Equipment Entries Tab ──────────────────────────────────────────────────────
function EquipmentEntriesTab({ adminName }) {
  const [entries, setEntries] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [filters, setFilters] = useState({ date: "", location: "", type: "" });
  const [rejectTarget, setRejectTarget] = useState(null);

  const runWithLoading = useCallback(async (fn) => {
    setPendingCount((c) => c + 1);
    try { return await fn(); }
    finally { setPendingCount((c) => Math.max(0, c - 1)); }
  }, []);

  const loadEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.date) params.set("date", filters.date);
      if (filters.location) params.set("location", filters.location);
      if (filters.type) params.set("type", filters.type);
      const res = await runWithLoading(() =>
        fetch(apiUrl(`/api/site-incharge/equipment-entries?${params}`))
      );
      const data = await res.json();
      if (data.ok) setEntries(data.entries || []);
    } catch (e) { console.error(e); }
  }, [filters.date, filters.location, filters.type, runWithLoading]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const approveEntry = async (entryId) => {
    try {
      const res = await runWithLoading(() =>
        fetch(apiUrl(`/api/site-incharge/equipment-entries/${entryId}/approve`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approved_by: adminName || "" }),
        })
      );
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Unable to approve"); return; }
      loadEntries();
    } catch { alert("Unable to approve now"); }
  };

  const rejectEntry = async (entryId, reason) => {
    try {
      const res = await runWithLoading(() =>
        fetch(apiUrl(`/api/site-incharge/equipment-entries/${entryId}/reject`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rejection_reason: reason }),
        })
      );
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Unable to reject"); return; }
      setRejectTarget(null);
      loadEntries();
    } catch { alert("Unable to reject now"); }
  };

  const getStatus = (e) => {
    const s = (e.approval_status || "").toLowerCase();
    if (s === "approved") return "approved";
    if (s === "rejected") return "rejected";
    return "pending";
  };

  const EQ_COLS = [
    "Date", "Operator", "Company", "Equipment", "Plate No.", "Type",
    "Ownership", "Location", "Time (From→To)", "Hours", "Activity", "Status", "Action",
  ];

  return (
    <>
      <LoadingOverlay show={pendingCount > 0} message="Loading equipment entries..." />
      {rejectTarget && (
        <RejectModal
          onConfirm={(reason) => rejectEntry(rejectTarget, reason)}
          onCancel={() => setRejectTarget(null)}
        />
      )}
      <div className="space-y-5">
        {/* Filter bar */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-4 flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Filters</span>
          <input type="date" className={inputCls} value={filters.date}
            onChange={(e) => setFilters((p) => ({ ...p, date: e.target.value }))} />
          <input type="text" className={inputCls} placeholder="Location..."
            value={filters.location}
            onChange={(e) => setFilters((p) => ({ ...p, location: e.target.value }))} />
          <input type="text" className={inputCls} placeholder="Equipment Type..."
            value={filters.type}
            onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))} />
          <button type="button"
            onClick={() => setFilters({ date: "", location: "", type: "" })}
            className="rounded-xl border border-white/20 hover:border-white/40 text-slate-400 hover:text-white text-xs font-bold px-4 py-2 transition">
            Clear
          </button>
          <span className="ml-auto text-xs text-slate-500 font-semibold">
            {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
          </span>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h3 className="text-base font-bold text-white">🚜 Equipment Entries</h3>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[1600px] text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-slate-950/60">
                  {EQ_COLS.map((col) => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={EQ_COLS.length} className="px-4 py-10 text-center text-slate-500 text-sm">
                      No equipment entries found.
                    </td>
                  </tr>
                )}
                {entries.map((entry) => {
                  const st = getStatus(entry);
                  return (
                    <tr key={entry._id} className={`border-b border-white/5 hover:bg-white/3 transition ${rowBg[st]}`}>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{entry.work_date || "-"}</td>
                      <td className="px-4 py-3 font-semibold text-slate-100 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          <WorkerAvatar
                            name={entry.operator_name}
                            civilId={entry.civil_id}
                            profilePicture={entry.profile_picture}
                            sizeClass="w-8 h-8"
                          />
                          <span>{entry.operator_name || "-"}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{entry.company_name || "-"}</td>
                      <td className="px-4 py-3 text-slate-100 font-medium whitespace-nowrap">{entry.equipment_name || "-"}</td>
                      <td className="px-4 py-3">
                        {entry.plate_number ? (
                          <span className="font-mono text-xs bg-slate-800 border border-white/10 rounded-lg px-2 py-0.5 text-amber-300">
                            {entry.plate_number}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full border text-sky-300 bg-sky-500/10 border-sky-400/20">
                          {entry.equipment_type || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {entry.ownership === "owned" ? (
                          <span className="text-xs font-bold text-emerald-300">ENCO Owned</span>
                        ) : (
                          <span className="text-xs font-bold text-rose-300">Rental</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{entry.location || "-"}</td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                        {entry.time_from && entry.time_to ? `${entry.time_from} → ${entry.time_to}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-amber-300">{entry.hours != null ? entry.hours : "-"}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 max-w-[160px] truncate" title={entry.activity}>
                        {entry.activity || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={PILL[st]}>
                          {st === "approved" ? "✓" : st === "rejected" ? "✗" : "⏳"} {st}
                        </span>
                        {st === "rejected" && entry.rejection_reason && (
                          <div className="text-[10px] text-rose-300 mt-1 max-w-[100px] truncate" title={entry.rejection_reason}>
                            {entry.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {st === "approved" ? (
                          <span className={PILL.approved}>✓ Approved</span>
                        ) : st === "rejected" ? (
                          <span className={PILL.rejected}>✗ Rejected</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => approveEntry(entry._id)}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 transition whitespace-nowrap">
                              Approve
                            </button>
                            <button type="button" onClick={() => setRejectTarget(entry._id)}
                              className="rounded-lg bg-rose-700/80 hover:bg-rose-600 text-white text-xs font-bold px-3 py-1.5 transition">
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main SiteInchargeView ──────────────────────────────────────────────────────
function SiteInchargeView() {
  const { state } = useLocation();
  const [activeTab, setActiveTab] = useState("workers");
  const adminName = state?.adminName || state?.civilId || "Site Incharge";

  const tabs = [
    { id: "workers", label: "👷 Worker Entries" },
    { id: "equipment", label: "🚜 Equipment Entries" },
  ];

  return (
    <div className="min-h-screen min-h-[100dvh] w-full font-sans text-white mobile-bg-attachment-scroll" style={BG}>

      {/* Top bar */}
      <header className="w-full sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
        <div className="flex items-center gap-4 px-5 md:px-8 min-h-14">
          <img src="/Logo - Copy.png" alt="Encogroup" className="h-9 w-auto object-contain shrink-0" />
          <div className="border-l border-white/10 pl-4">
            <div className="text-sm font-bold text-white">Site Incharge View</div>
            <div className="text-xs text-slate-400">Welcome, {adminName}</div>
          </div>
          <div className="ml-auto">
            <Link to="/" className="rounded-xl border border-white/20 hover:border-rose-400/50 text-slate-300 hover:text-rose-300 text-xs font-bold px-4 py-2 transition no-underline">
              Logout
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 md:px-8 pb-0 border-t border-white/10 overflow-x-auto scrollbar-thin flex-nowrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 px-4 sm:px-5 py-3 text-sm font-bold transition border-b-2 ${
                activeTab === tab.id
                  ? "border-sky-400 text-sky-300"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 md:px-8 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
        {activeTab === "workers" && <WorkerEntriesTab adminName={adminName} />}
        {activeTab === "equipment" && <EquipmentEntriesTab adminName={adminName} />}
      </div>
    </div>
  );
}

export default SiteInchargeView;
