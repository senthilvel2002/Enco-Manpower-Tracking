import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiUrl } from "./api";
import { Pie, Bar, Line } from "react-chartjs-2";
import LoadingOverlay from "./LoadingOverlay";
import WorkerAvatar from "./WorkerAvatar";
import { formatWorkerProfileTooltip } from "./workerProfileTooltip";
import ImageCropModal from "./ImageCropModal";
import {
  Chart as ChartJS, CategoryScale, LinearScale, ArcElement, Tooltip, Legend,
  BarElement, LineElement, PointElement,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

ChartJS.register(CategoryScale, LinearScale, ArcElement, Tooltip, Legend, BarElement, LineElement, PointElement, ChartDataLabels);

/** Official hours if set, else worker-reported hours from daily login. */
function entryManhours(entry) {
  if (entry == null) return null;
  if (entry.hours != null && entry.hours !== "") return entry.hours;
  if (entry.worker_hours != null && entry.worker_hours !== "") return entry.worker_hours;
  return null;
}

const BG = {
  backgroundImage: `linear-gradient(rgba(2,6,23,0.88), rgba(2,6,23,0.97)), url(/sohar-oman.jpg)`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
};

const inputCls =
  "rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-1 focus:ring-sky-400/20 transition";
const selectCls =
  "rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/60 focus:outline-none focus:ring-1 focus:ring-sky-400/20 transition cursor-pointer";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5";
const inlineInputCls =
  "w-full rounded-lg border border-sky-400/30 bg-slate-800 px-2 py-1 text-xs text-slate-100 focus:border-sky-400/60 focus:outline-none";

const ROW_BG = {
  approved: "bg-emerald-500/8 border-l-2 border-emerald-500/50",
  rejected: "bg-rose-500/8 border-l-2 border-rose-500/50",
  pending: "bg-amber-500/5 border-l-2 border-amber-500/30",
};

const STATUS_PILL = {
  approved: "inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[11px] font-bold px-2.5 py-0.5",
  rejected: "inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-400/30 text-rose-300 text-[11px] font-bold px-2.5 py-0.5",
  pending: "inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-[11px] font-bold px-2.5 py-0.5",
};

const TABLE_COLS = [
  "S.I", "Approved By", "Date", "Company", "Name", "Designation",
  "Man/Equ", "Category", "Area", "Reference", "Item Tag",
  "Shift", "Manhours", "Main Activity", "Status", "Rej. Reason", "Action",
];

const EQ_TABLE_COLS = [
  "S.I", "Date", "Operator", "Company", "Equipment", "Plate No.",
  "Type", "Ownership", "Eq. Status", "Location", "Hours",
  "Supply Rate/mo", "Contract Rate/hr", "Rental Amt (OMR)",
  "Activity", "Approval", "Approved By", "Rej. Reason", "Action",
];

const EQ_STATUS_OPTIONS = [
  "Working", "Under Maintenance", "Transporting",
  "Disassembly", "Assembly", "Inspection", "Expired",
];

async function promptManagementPassword(actionLabel = "save changes") {
  const password = window.prompt(`Enter management password to ${actionLabel}:`);
  if (password === null) return { cancelled: true };
  const trimmed = String(password || "").trim();
  if (!trimmed) return { error: "Management password is required." };
  return { password: trimmed };
}

const PIE_COLORS = [
  "rgba(59,130,246,0.75)", "rgba(34,197,94,0.75)", "rgba(245,158,11,0.75)",
  "rgba(168,85,247,0.75)", "rgba(239,68,68,0.75)", "rgba(20,184,166,0.75)",
  "rgba(99,102,241,0.75)", "rgba(236,72,153,0.75)",
];

function CardPanel({ children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, color = "sky" }) {
  const colors = {
    sky: "border-sky-400/20 bg-sky-500/10 text-sky-300",
    emerald: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-400/20 bg-amber-500/10 text-amber-300",
    rose: "border-rose-400/20 bg-rose-500/10 text-rose-300",
    violet: "border-violet-400/20 bg-violet-500/10 text-violet-300",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className={`text-2xl font-black ${colors[color].split(" ").pop()}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Manpower Tab ──────────────────────────────────────────────────────────────
function ManpowerTab({ state, navigate }) {
  const [showWorkerEditor, setShowWorkerEditor] = useState(false);
  const [showNewWorker, setShowNewWorker] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [newWorker, setNewWorker] = useState({ civil_id: "", name: "", designation: "", company_name: "" });
  const [workerSearch, setWorkerSearch] = useState("");
  const [workerResults, setWorkerResults] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [workerEdit, setWorkerEdit] = useState({
    civil_id: "",
    new_civil_id: "",
    name: "",
    designation: "",
    company_name: "",
    email: "",
    category: "",
    is_active: true,
  });
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedApprovalStatus, setSelectedApprovalStatus] = useState("all");
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [anchorDate, setAnchorDate] = useState(new Date().toISOString().slice(0, 10));
  const [filteredByLocation, setFilteredByLocation] = useState([]);
  const [dashboard, setDashboard] = useState({
    summary: { total_workers: 0, logged_workers: 0, not_logged_workers: 0, direct_workers: 0, indirect_workers: 0, direct_logged: 0, indirect_logged: 0, summary_date: "", total_entries: 0, today_entries: 0 },
    location_analytics: [],
    site_incharge_view: [],
    by_company: [],
    by_category: [],
    weekly_trend: [],
    monthly_trend: [],
    recent_entries: [],
  });
  const [mnpTrendView, setMnpTrendView] = useState("monthly");
  const [editingEntry, setEditingEntry] = useState(null);
  const [entryForm, setEntryForm] = useState({
    work_date: "",
    location: "",
    incharge: "",
    attendance_status: "",
    hours: "",
    today_activity: "",
    approval_status: "",
    rejection_reason: "",
  });
  const [expandedShiftId, setExpandedShiftId] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [mnpImportOpen, setMnpImportOpen] = useState(false);
  const [mnpSheetName, setMnpSheetName] = useState("");
  const [mnpCreateWorkers, setMnpCreateWorkers] = useState(true);
  const [mnpPlaceholderNoCivil, setMnpPlaceholderNoCivil] = useState(true);
  const [mnpImportEquipment, setMnpImportEquipment] = useState(true);
  const [mnpEquipOpCivil, setMnpEquipOpCivil] = useState("");
  const [mnpImportResult, setMnpImportResult] = useState(null);
  const [mnpImporting, setMnpImporting] = useState(false);
  const [mnpProgressLog, setMnpProgressLog] = useState([]);
  const mnpProgressEndRef = useRef(null);
  const mnpFileRef = useRef(null);

  const runWithLoading = useCallback(async (fn) => {
    setPendingCount((c) => c + 1);
    try { return await fn(); }
    finally { setPendingCount((c) => Math.max(0, c - 1)); }
  }, []);

  const topLocations = useMemo(() => (dashboard.location_analytics || []).slice(0, 8), [dashboard.location_analytics]);

  const locationChart = useMemo(() => ({
    labels: topLocations.map((x) => x.name),
    datasets: [{
      label: "Hours",
      data: topLocations.map((x) => Number(x.hours || 0)),
      backgroundColor: PIE_COLORS.slice(0, topLocations.length),
      borderColor: "rgba(15,23,42,0.9)",
      borderWidth: 1,
    }],
  }), [topLocations]);

  const locationColorMap = useMemo(() => {
    const map = {};
    topLocations.forEach((x, idx) => {
      map[x.name] = PIE_COLORS[idx];
    });
    return map;
  }, [topLocations]);

  /** Location pie: % of total hours per slice (matches list metric) */
  const locationPieOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { color: "rgba(226,232,240,0.9)", boxWidth: 12 } },
      tooltip: { enabled: true },
      datalabels: {
        color: "#fff",
        font: { weight: "bold", size: 11 },
        formatter: (value, ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + Number(b || 0), 0);
          if (!total || !value) return "";
          return Math.round((Number(value) / total) * 100) + "%";
        },
      },
    },
  }), []);

  const labourPieData = useMemo(() => {
    const d = dashboard.summary.direct_logged  || 0;
    const i = dashboard.summary.indirect_logged || 0;
    const total = d + i;
    const dPct = total > 0 ? Math.round((d / total) * 100) : 0;
    const iPct = total > 0 ? Math.round((i / total) * 100) : 0;
    return {
      labels: [`Direct (${dPct}%)`, `Indirect (${iPct}%)`],
      datasets: [{
        data: [d, i],
        backgroundColor: ["rgba(34,197,94,0.8)", "rgba(168,85,247,0.8)"],
        borderColor: "rgba(15,23,42,0.9)",
        borderWidth: 2,
      }],
    };
  }, [dashboard.summary.direct_logged, dashboard.summary.indirect_logged]);

  const labourPieOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: "rgba(226,232,240,0.9)", boxWidth: 12, padding: 10 },
      },
      tooltip: { enabled: true },
      datalabels: {
        color: "#fff",
        font: { weight: "bold", size: 14 },
        formatter: (value, ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          if (!total || !value) return "";
          return Math.round((value / total) * 100) + "%";
        },
      },
    },
  }), []);

  const mnpTrendData = useMemo(
    () => (mnpTrendView === "monthly" ? (dashboard.monthly_trend || []) : (dashboard.weekly_trend || [])),
    [mnpTrendView, dashboard.monthly_trend, dashboard.weekly_trend]
  );

  const mnpTrendBarData = useMemo(() => ({
    labels: mnpTrendData.map((r) => mnpTrendView === "monthly" ? r.month : r.week),
    datasets: [
      {
        label: "Total Hours",
        data: mnpTrendData.map((r) => r.total_hours),
        backgroundColor: "rgba(56,189,248,0.65)",
        borderColor: "rgba(56,189,248,0.9)",
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: "Entries",
        data: mnpTrendData.map((r) => r.entries),
        backgroundColor: "rgba(168,85,247,0.45)",
        borderColor: "rgba(168,85,247,0.8)",
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }), [mnpTrendData, mnpTrendView]);

  const mnpTrendBarOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { color: "rgba(226,232,240,0.85)", boxWidth: 12, font: { size: 11 } } },
      datalabels: { display: false },
      tooltip: { enabled: true },
    },
    scales: {
      x: { ticks: { color: "rgba(148,163,184,0.85)", font: { size: 10 } }, grid: { color: "rgba(255,255,255,0.04)" } },
      y: { ticks: { color: "rgba(148,163,184,0.85)", font: { size: 10 } }, grid: { color: "rgba(255,255,255,0.06)" } },
    },
  }), []);

  const loadDashboard = useCallback(async () => {
    try {
      const params = new URLSearchParams({ location: selectedLocation, approval_status: selectedApprovalStatus, period: selectedPeriod, anchor_date: anchorDate });
      const res = await runWithLoading(() => fetch(apiUrl(`/api/management/dashboard?${params}`)));
      const data = await res.json();
      if (data.ok) setDashboard(data);
    } catch (e) { console.error(e); }
  }, [selectedLocation, selectedApprovalStatus, selectedPeriod, anchorDate, runWithLoading]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await runWithLoading(() => fetch(apiUrl("/api/master-data/options")));
        const data = await res.json();
        if (data.ok) setCompanies(data.companies || []);
      } catch { /* ignore */ }
    };
    load();
  }, [runWithLoading]);

  useEffect(() => {
    const runSearch = async () => {
      const q = workerSearch.trim();
      if (!q) { setWorkerResults([]); return; }
      try {
        const params = new URLSearchParams({ q, include_inactive: "true" });
        const res = await runWithLoading(() => fetch(apiUrl(`/api/workers/search?${params}`)));
        const data = await res.json();
        if (data.ok) setWorkerResults(data.workers || []);
      } catch { /* ignore */ }
    };
    const t = setTimeout(runSearch, 250);
    return () => clearTimeout(t);
  }, [workerSearch, runWithLoading]);

  useEffect(() => {
    const load = async () => {
      if (!selectedLocation || selectedLocation === "all") { setFilteredByLocation([]); return; }
      try {
        const params = new URLSearchParams({ location: selectedLocation, approval_status: selectedApprovalStatus, period: selectedPeriod, anchor_date: anchorDate });
        const res = await runWithLoading(() => fetch(apiUrl(`/api/management/filter-entries?${params}`)));
        const data = await res.json();
        if (data.ok) setFilteredByLocation(data.entries || []);
      } catch (e) { console.error(e); }
    };
    load();
  }, [selectedLocation, selectedApprovalStatus, selectedPeriod, anchorDate, runWithLoading]);

  const selectWorker = (w) => {
    setSelectedWorker(w);
    setWorkerEdit({
      civil_id: w.civil_id || "",
      new_civil_id: w.civil_id || "",
      name: w.name || "",
      designation: w.designation || "",
      company_name: w.company_name || "",
      email: w.email || "",
      category: w.category || "",
      is_active: w.is_active !== false,
    });
  };

  const saveWorker = async () => {
    if (!workerEdit.civil_id) return;
    const auth = await promptManagementPassword("save worker changes");
    if (auth.cancelled) return;
    if (auth.error) { alert(auth.error); return; }
    try {
      const res = await runWithLoading(() => fetch(apiUrl(`/api/workers/${workerEdit.civil_id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_civil_id: workerEdit.new_civil_id,
          name: workerEdit.name,
          designation: workerEdit.designation,
          company_name: workerEdit.company_name,
          email: workerEdit.email,
          category: workerEdit.category,
          is_active: workerEdit.is_active,
          management_password: auth.password,
        }),
      }));
      const data = await res.json();
      if (!res.ok) { alert(data?.error || "Unable to update worker"); return; }
      alert("Worker updated");
      setSelectedWorker(null); setWorkerSearch(""); setWorkerResults([]); setShowWorkerEditor(false);
    } catch { alert("Unable to update now"); }
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
    } catch { alert("Unable to add now"); }
  };

  const handleDownloadExcel = () => {
    const params = new URLSearchParams();
    if (selectedLocation && selectedLocation !== "all") params.set("location", selectedLocation);
    params.set("approval_status", selectedApprovalStatus);
    params.set("period", selectedPeriod);
    params.set("anchor_date", anchorDate);
    window.open(apiUrl(`/api/management/export-excel?${params}`), "_blank");
  };

  const handleSendExcelEmail = async () => {
    try {
      const res = await runWithLoading(() => fetch(apiUrl("/api/management/export-excel/email"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: selectedLocation, approval_status: selectedApprovalStatus, period: selectedPeriod, anchor_date: anchorDate }),
      }));
      const data = await res.json();
      if (!res.ok) { alert(data?.error || "Unable to send email"); return; }
      alert(`Excel sent to ${Array.isArray(data.sent_to) ? data.sent_to.join(", ") : data.sent_to}`);
    } catch { alert("Unable to send email now"); }
  };

  const openEditEntry = (entry) => {
    setEditingEntry(entry);
    setEntryForm({
      work_date: entry.work_date || "",
      location: entry.location || "",
      incharge: entry.incharge || "",
      attendance_status: entry.attendance_status || "",
      hours: entryManhours(entry) ?? "",
      today_activity: entry.today_activity || "",
      approval_status: entry.approval_status || "",
      rejection_reason: entry.rejection_reason || "",
    });
  };

  const saveEntryEdit = async () => {
    if (!editingEntry?._id) return;
    const auth = await promptManagementPassword("save manpower entry changes");
    if (auth.cancelled) return;
    if (auth.error) { alert(auth.error); return; }
    try {
      const res = await runWithLoading(() => fetch(apiUrl(`/api/work-entries/${editingEntry._id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...entryForm, management_password: auth.password }),
      }));
      const data = await res.json();
      if (!res.ok) { alert(data?.error || "Unable to update entry"); return; }
      setEditingEntry(null);
      await loadDashboard();
    } catch { alert("Unable to update now"); }
  };

  const deleteEntry = async (entryId) => {
    if (!window.confirm("Delete this entry?")) return;
    try {
      const res = await runWithLoading(() => fetch(apiUrl(`/api/work-entries/${entryId}`), { method: "DELETE" }));
      const data = await res.json();
      if (!res.ok) { alert(data?.error || "Unable to delete entry"); return; }
      await loadDashboard();
    } catch { alert("Unable to delete now"); }
  };

  const submitMnpImport = async () => {
    const file = mnpFileRef.current?.files?.[0];
    if (!file) { alert("Choose an .xlsx file first."); return; }
    const auth = await promptManagementPassword("import MNP Excel workbook");
    if (auth.cancelled) return;
    if (auth.error) { alert(auth.error); return; }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("format", "mnp");
    fd.append("management_password", auth.password);
    if (mnpSheetName.trim()) fd.append("sheet_name", mnpSheetName.trim());
    if (mnpCreateWorkers) fd.append("create_missing_workers", "true");
    if (mnpPlaceholderNoCivil) fd.append("placeholder_for_no_civil_id", "true");
    if (!mnpImportEquipment) fd.append("import_equipment", "false");
    if (mnpEquipOpCivil.trim()) fd.append("equipment_operator_civil_id", mnpEquipOpCivil.trim());

    setMnpImportResult(null);
    setMnpProgressLog([]);
    setMnpImporting(true);

    try {
      const res = await fetch(apiUrl("/api/management/work-entries/import-excel/stream"), {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(errData?.error || `Server error ${res.status}`);
        setMnpImporting(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // SSE events are separated by double newline
        const events = buf.split("\n\n");
        buf = events.pop(); // keep any incomplete chunk

        for (const ev of events) {
          const line = ev.trim();
          if (!line.startsWith("data: ")) continue;
          let data;
          try { data = JSON.parse(line.slice(6)); } catch { continue; }

          if (data.type === "progress") {
            setMnpProgressLog((prev) => [...prev, data.msg]);
            // auto-scroll
            setTimeout(() => mnpProgressEndRef.current?.scrollIntoView({ behavior: "smooth" }), 20);
          } else if (data.type === "done") {
            setMnpImportResult(data);
            setMnpImporting(false);
            await loadDashboard();
            if (mnpFileRef.current) mnpFileRef.current.value = "";
          } else if (data.type === "error") {
            alert("Import error: " + data.error);
            setMnpImporting(false);
          }
        }
      }
    } catch (e) {
      alert("Import failed: " + (e?.message || e));
    } finally {
      setMnpImporting(false);
    }
  };

  const getApprovalState = (entry) => {
    const s = (entry?.approval_status || "").toLowerCase();
    if (s === "approved") return "approved";
    if (s === "rejected") return "rejected";
    return "pending";
  };

  return (
    <>
      <LoadingOverlay show={pendingCount > 0} message="Loading management data..." />

      {/* Action buttons row */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button type="button" onClick={() => navigate("/worker-profiles", { state })}
          className="rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3 py-2 transition">
          Worker Profiles
        </button>
        <button type="button" onClick={() => { setShowNewWorker((v) => !v); setShowWorkerEditor(false); }}
          className="rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold px-3 py-2 transition">
          + Add Worker
        </button>
        <button type="button" onClick={() => { setShowWorkerEditor((v) => !v); setShowNewWorker(false); }}
          className="rounded-xl border border-white/20 hover:border-sky-400/50 text-slate-300 hover:text-white text-xs font-bold px-3 py-2 transition">
          Edit Worker
        </button>
        <button type="button" onClick={handleDownloadExcel}
          className="rounded-xl border border-emerald-400/30 hover:border-emerald-400/60 text-emerald-300 hover:text-emerald-100 text-xs font-bold px-3 py-2 transition">
          ↓ Excel
        </button>
        <button type="button" onClick={handleSendExcelEmail}
          className="rounded-xl border border-sky-400/30 hover:border-sky-400/60 text-sky-300 hover:text-sky-100 text-xs font-bold px-3 py-2 transition">
          ✉ Email
        </button>
        <button
          type="button"
          onClick={() => { setMnpImportOpen((v) => !v); setMnpImportResult(null); setMnpProgressLog([]); }}
          className="rounded-xl border border-violet-400/35 hover:border-violet-400/65 text-violet-200 text-xs font-bold px-3 py-2 transition"
        >
          ↑ Import Previous Month Excel
        </button>
      </div>

      {mnpImportOpen && (
        <CardPanel className="p-5 border-violet-400/20 bg-violet-950/20">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-bold text-white">Import Previous Month (MNP Tracking Excel)</div>
            <button type="button" disabled={mnpImporting}
              onClick={() => { setMnpImportOpen(false); setMnpImportResult(null); setMnpProgressLog([]); }}
              className="text-slate-400 hover:text-slate-200 disabled:opacity-40 text-xs font-bold px-2 py-1 rounded transition">✕ Close</button>
          </div>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Upload the monthly MNP tracking workbook (e.g. <span className="text-slate-200">25-EG-OM-017-Mnp Tracking-March 2026.xlsx</span>).
            Columns: Date, Company, Name Surname, Civil ID, Man/Equ, Area, Manhours, activities.
            <br />
            <span className="text-emerald-300">Manpower / Sub Contractor</span> rows → <strong>Worker Entries</strong> (matched by Civil ID).{" "}
            <span className="text-sky-300">Equipment</span> rows → <strong>Equipment Entries</strong> (matched by name + location in master data).
          </p>

          {/* File + sheet row */}
          <div className="flex flex-wrap gap-3 items-end mb-4">
            <div>
              <div className={labelCls}>Excel File (.xlsx)</div>
              <input ref={mnpFileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="text-xs text-slate-300 max-w-full file:mr-2 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-violet-500 cursor-pointer" />
            </div>
            <FormField label="Sheet Name (leave blank = auto-detect)">
              <input type="text" className={`${inputCls} w-48`} placeholder="e.g. March 2026"
                value={mnpSheetName} onChange={(e) => setMnpSheetName(e.target.value)} />
            </FormField>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 text-xs text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-white/8 transition">
              <input type="checkbox" checked={mnpCreateWorkers}
                onChange={(e) => setMnpCreateWorkers(e.target.checked)} className="rounded border-white/20 accent-violet-400" />
              <div>
                <div className="font-semibold text-slate-200">Create missing workers</div>
                <div className="text-slate-500 text-[11px]">Civil ID in file but not in DB — adds to worker profiles (company must exist in master data)</div>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-white/8 transition">
              <input type="checkbox" checked={mnpPlaceholderNoCivil}
                onChange={(e) => setMnpPlaceholderNoCivil(e.target.checked)} className="rounded border-white/20 accent-amber-400" />
              <div>
                <div className="font-semibold text-amber-300">Use "0000" for missing Civil IDs</div>
                <div className="text-slate-500 text-[11px]">Rows with no Civil ID in Excel are stored with civil_id = 0000 — update later once IDs are known</div>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-white/8 transition">
              <input type="checkbox" checked={mnpImportEquipment}
                onChange={(e) => setMnpImportEquipment(e.target.checked)} className="rounded border-white/20 accent-sky-400" />
              <div>
                <div className="font-semibold text-slate-200">Import equipment rows</div>
                <div className="text-slate-500 text-[11px]">Man/Equ = Equipment rows → equipment entries (equipment must be registered in master data)</div>
              </div>
            </label>
            <FormField label="Equipment operator Civil ID (optional)">
              <input type="text" className={`${inputCls} w-full`} placeholder="Defaults to system operator ID"
                value={mnpEquipOpCivil} onChange={(e) => setMnpEquipOpCivil(e.target.value)} />
            </FormField>
          </div>

          <button type="button" onClick={submitMnpImport} disabled={mnpImporting}
            className="rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold px-5 py-2.5 transition shadow-lg shadow-violet-900/40">
            {mnpImporting ? "Importing…" : "Run Import"}
          </button>

          {/* Live progress log */}
          {(mnpImporting || mnpProgressLog.length > 0) && !mnpImportResult && (
            <div className="mt-4 rounded-xl border border-violet-400/20 bg-slate-900/70 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8 bg-violet-950/40">
                {mnpImporting && (
                  <span className="inline-block w-3 h-3 rounded-full bg-violet-400 animate-pulse shrink-0" />
                )}
                <span className="text-xs font-bold text-violet-200">
                  {mnpImporting ? "Import in progress…" : "Import log"}
                </span>
              </div>
              <div className="max-h-52 overflow-y-auto p-3 space-y-0.5 font-mono text-[11px]">
                {mnpProgressLog.map((msg, i) => {
                  const isRow = /\/\d+\s*\(\d+%\)/.test(msg);
                  const isHeader = msg.startsWith("[") || msg.includes("Sheet") || msg.includes("import");
                  return (
                    <div key={i} className={
                      isRow ? "text-sky-300" :
                      isHeader ? "text-violet-200 font-semibold mt-1" :
                      "text-slate-400"
                    }>
                      {msg}
                    </div>
                  );
                })}
                <div ref={mnpProgressEndRef} />
              </div>
            </div>
          )}

          {/* Results panel */}
          {mnpImportResult && (
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <div className={`text-sm font-bold mb-3 ${mnpImportResult.ok ? "text-emerald-300" : "text-rose-300"}`}>
                {mnpImportResult.ok ? "Import Complete" : "Import Error"}
              </div>
              {mnpImportResult.ok ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    {[
                      { label: "Worker Entries Added", value: mnpImportResult.inserted ?? 0, color: "text-emerald-300" },
                      { label: "No-Civil-ID (0000)", value: mnpImportResult.placeholder_inserted ?? 0, color: "text-amber-300" },
                      { label: "Equipment Entries", value: mnpImportResult.equipment_inserted ?? 0, color: "text-sky-300" },
                      { label: "Workers Created", value: mnpImportResult.workers_created ?? 0, color: "text-violet-300" },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg bg-slate-800/70 border border-white/8 p-3 text-center">
                        <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-slate-400 mb-2">
                    Total rows read: <span className="text-slate-200">{mnpImportResult.rows_read ?? "—"}</span>
                    {" · "}Manpower rows: <span className="text-slate-200">{mnpImportResult.manpower_rows ?? "—"}</span>
                    {" · "}Equipment rows: <span className="text-slate-200">{mnpImportResult.equipment_rows ?? "—"}</span>
                    {" · "}Row errors: <span className={(mnpImportResult.row_errors?.length || 0) > 0 ? "text-rose-300 font-bold" : "text-slate-200"}>
                      {mnpImportResult.row_errors?.length ?? 0}
                    </span>
                  </div>
                  {(mnpImportResult.row_errors?.length || 0) > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs font-semibold text-rose-300 cursor-pointer hover:text-rose-200">
                        Show row errors ({mnpImportResult.row_errors.length})
                      </summary>
                      <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-rose-950/30 border border-rose-400/20 p-2 space-y-1">
                        {mnpImportResult.row_errors.map((e, i) => (
                          <div key={i} className="text-[11px] text-rose-200 font-mono">
                            Row {e.row}{e.civil_id ? ` [${e.civil_id}]` : ""}: {e.error}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              ) : (
                <div className="text-sm text-rose-200">{mnpImportResult.error}</div>
              )}
            </div>
          )}
        </CardPanel>
      )}

      <div className="space-y-5">
        {/* Add New Worker Panel */}
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
              <FormField label="Civil ID">
                <input type="text" className={inputCls} value={newWorker.civil_id}
                  onChange={(e) => setNewWorker((p) => ({ ...p, civil_id: e.target.value }))} required />
              </FormField>
              <FormField label="Name Surname">
                <input type="text" className={inputCls} value={newWorker.name}
                  onChange={(e) => setNewWorker((p) => ({ ...p, name: e.target.value }))} required />
              </FormField>
              <FormField label="Designation">
                <input type="text" className={inputCls} value={newWorker.designation}
                  onChange={(e) => setNewWorker((p) => ({ ...p, designation: e.target.value }))} required />
              </FormField>
              <FormField label="Company">
                <select className={selectCls} value={newWorker.company_name}
                  onChange={(e) => setNewWorker((p) => ({ ...p, company_name: e.target.value }))} required>
                  <option value="">Select Company</option>
                  {companies.map((c) => <option key={c._id} value={c.name}>{c.name}</option>)}
                </select>
              </FormField>
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <button type="submit"
                  className="rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold px-6 py-2.5 transition">
                  Save Worker
                </button>
              </div>
            </form>
          </CardPanel>
        )}

        {/* Worker Editor Panel */}
        {showWorkerEditor && (
          <CardPanel className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Update Worker Details</h3>
              <button type="button"
                onClick={() => { setWorkerSearch(""); setWorkerResults([]); setSelectedWorker(null); setShowWorkerEditor(false); }}
                className="rounded-lg border border-white/15 hover:border-rose-400/40 text-slate-400 hover:text-rose-300 text-xs font-bold px-3 py-1.5 transition">
                Close
              </button>
            </div>
            <input type="text" className={`${inputCls} w-full max-w-md mb-4`}
              placeholder="Search by Civil ID or Name..."
              value={workerSearch} onChange={(e) => setWorkerSearch(e.target.value)} />
            {workerResults.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-slate-950/60 overflow-hidden mb-4 max-w-2xl">
                {workerResults.slice(0, 15).map((w) => (
                  <div key={w.civil_id}
                    className="flex items-center justify-between px-4 py-3 border-b border-white/5 hover:bg-sky-500/10 cursor-pointer transition gap-2"
                    onClick={() => selectWorker(w)}>
                    <span className="flex items-center gap-2 min-w-0">
                      <WorkerAvatar name={w.name} civilId={w.civil_id} profilePicture={w.profile_picture} sizeClass="w-8 h-8" />
                      <span className="text-sm font-semibold text-slate-200 truncate">{w.name} <span className="text-slate-500">({w.civil_id})</span></span>
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">{w.company_name}</span>
                  </div>
                ))}
              </div>
            )}
            {selectedWorker && (
              <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2"
                onSubmit={(e) => { e.preventDefault(); saveWorker(); }}>
                <FormField label="Current Civil ID">
                  <input type="text" className={`${inputCls} opacity-60`} value={workerEdit.civil_id} readOnly />
                </FormField>
                <FormField label="New Civil ID">
                  <input type="text" className={inputCls} value={workerEdit.new_civil_id}
                    onChange={(e) => setWorkerEdit((p) => ({ ...p, new_civil_id: e.target.value }))} required />
                </FormField>
                <FormField label="Name Surname">
                  <input type="text" className={inputCls} value={workerEdit.name}
                    onChange={(e) => setWorkerEdit((p) => ({ ...p, name: e.target.value }))} required />
                </FormField>
                <FormField label="Designation">
                  <input type="text" className={inputCls} value={workerEdit.designation}
                    onChange={(e) => setWorkerEdit((p) => ({ ...p, designation: e.target.value }))} required />
                </FormField>
                <FormField label="Company">
                  <select className={selectCls} value={workerEdit.company_name}
                    onChange={(e) => setWorkerEdit((p) => ({ ...p, company_name: e.target.value }))} required>
                    <option value="">Select Company</option>
                    {companies.map((c) => <option key={c._id} value={c.name}>{c.name}</option>)}
                  </select>
                </FormField>
                <FormField label="Email">
                  <input type="email" className={inputCls} value={workerEdit.email}
                    onChange={(e) => setWorkerEdit((p) => ({ ...p, email: e.target.value }))} />
                </FormField>
                <FormField label="Category">
                  <select className={selectCls} value={workerEdit.category}
                    onChange={(e) => setWorkerEdit((p) => ({ ...p, category: e.target.value }))}>
                    <option value="">Auto by designation</option>
                    <option value="Direct">Direct</option>
                    <option value="Indirect">Indirect</option>
                  </select>
                </FormField>
                <FormField label="Status">
                  <select className={selectCls} value={workerEdit.is_active ? "active" : "inactive"}
                    onChange={(e) => setWorkerEdit((p) => ({ ...p, is_active: e.target.value === "active" }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </FormField>
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

        {/* Filters */}
        <CardPanel className="p-4 flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Filters</span>
          <select className={selectCls} value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)}>
            <option value="all">All Locations</option>
            {dashboard.location_analytics.map((i) => <option key={i.name} value={i.name}>{i.name}</option>)}
          </select>
          <select className={selectCls} value={selectedApprovalStatus} onChange={(e) => setSelectedApprovalStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
          <select className={selectCls} value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
            <option value="all">All periods</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
          <input type="date" className={inputCls} value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
        </CardPanel>

        {/* Metrics + Charts — 4-col grid: [Summary | Location Analytics (x2) | Labour Pie] */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

          {/* ── Workforce Summary ── */}
          <CardPanel className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Workforce</h3>
              <span className="text-2xl font-black text-white">{dashboard.summary.total_workers}</span>
            </div>

            {/* Logged In / Not Logged */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2">
                <div className="text-xl font-black text-emerald-300">{dashboard.summary.logged_workers || 0}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wide">Logged In</div>
                <div className="text-[9px] text-slate-500">{dashboard.summary.summary_date || anchorDate}</div>
              </div>
              <button type="button"
                onClick={() => navigate("/management/not-logged", { state: { ...(state || {}), targetDate: dashboard.summary.summary_date || anchorDate } })}
                className="rounded-lg border border-rose-400/20 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-2 text-left transition cursor-pointer">
                <div className="text-xl font-black text-rose-300">{dashboard.summary.not_logged_workers || 0}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wide">Not Logged</div>
                <div className="text-[9px] text-rose-400">Tap to view →</div>
              </button>
            </div>

            {/* Labour Category — logged count big on top, total small below */}
            <div className="border-t border-white/10 pt-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Labour Category</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2.5">
                  <div className="text-xl font-black text-emerald-300">{dashboard.summary.direct_logged || 0}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wide">Direct Logged</div>
                  <div className="mt-1 pt-1 border-t border-emerald-400/15">
                    <span className="text-xs font-bold text-emerald-400">{dashboard.summary.direct_workers || 0}</span>
                    <span className="text-[9px] text-slate-500"> total</span>
                  </div>
                </div>
                <div className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-2.5">
                  <div className="text-xl font-black text-violet-300">{dashboard.summary.indirect_logged || 0}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wide">Indirect Logged</div>
                  <div className="mt-1 pt-1 border-t border-violet-400/15">
                    <span className="text-xs font-bold text-violet-400">{dashboard.summary.indirect_workers || 0}</span>
                    <span className="text-[9px] text-slate-500"> total</span>
                  </div>
                </div>
              </div>
            </div>
          </CardPanel>

          {/* ── Location Analytics ── */}
          <CardPanel className="lg:col-span-2 p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Location Analytics</h3>
            <div className="flex flex-col md:flex-row gap-5">
              <div className="md:w-48 xl:w-56 shrink-0 space-y-1.5 max-h-52 overflow-y-auto scrollbar-thin">
                {dashboard.location_analytics.length === 0 && (
                  <div className="text-sm text-slate-500 py-2">No location data</div>
                )}
                {dashboard.location_analytics.map((item) => (
                  <div key={item.name}
                    className="flex items-center justify-between rounded-lg border border-white/8 bg-slate-900/50 px-3 py-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: locationColorMap[item.name] || "rgba(148,163,184,0.65)" }} />
                      <span className="text-sm text-slate-300 max-w-[110px] truncate" title={item.name}>{item.name}</span>
                    </span>
                    <div className="flex items-center gap-2 text-right">
                      <span className="text-[10px] text-slate-500">{item.entries}x</span>
                      <span className="text-sm font-bold text-sky-300 whitespace-nowrap">{Number(item.hours || 0).toFixed(1)} h</span>
                    </div>
                  </div>
                ))}
              </div>
              {topLocations.length > 0 && (
                <div className="flex-1 h-52 min-w-0">
                  <Pie data={locationChart} options={locationPieOptions} />
                </div>
              )}
            </div>
            {filteredByLocation.length > 0 && (
              <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/50 overflow-hidden max-h-40 overflow-y-auto scrollbar-thin">
                {filteredByLocation.map((entry) => (
                  <div key={entry._id} className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 gap-2">
                    <span className="flex items-start gap-2 min-w-0 text-sm text-slate-200">
                      <WorkerAvatar
                        name={entry.worker_name}
                        civilId={entry.civil_id}
                        profilePicture={entry.profile_picture}
                        sizeClass="w-7 h-7"
                        title={formatWorkerProfileTooltip(entry.worker_profile, entry)}
                      />
                      <span className="break-words whitespace-normal leading-snug">{entry.worker_name || "-"}</span>
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">{entry.incharge}</span>
                  </div>
                ))}
              </div>
            )}
          </CardPanel>

          {/* ── Direct vs Indirect Analytics ── */}
          <CardPanel className="p-5 flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Direct vs Indirect</h3>
            <p className="text-[9px] text-slate-500 -mt-1">Based on today's logged workers</p>
            {(dashboard.summary.direct_logged > 0 || dashboard.summary.indirect_logged > 0) ? (
              <div className="flex-1 h-52">
                <Pie data={labourPieData} options={labourPieOptions} />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-sm py-8">
                No logged workers yet
              </div>
            )}
          </CardPanel>

        </div>

        {/* ── Analytics Row: By Company + By Incharge + Trend (compact 3-col) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* By Company */}
          <CardPanel className="p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">By Company</h3>
            <div className="space-y-1 max-h-44 overflow-y-auto scrollbar-thin">
              {(dashboard.by_company || []).length === 0 && (
                <div className="text-xs text-slate-500">No data</div>
              )}
              {(dashboard.by_company || []).map((item) => {
                const maxE = Math.max(...(dashboard.by_company || []).map((x) => x.entries), 1);
                const barPct = Math.round((item.entries / maxE) * 100);
                return (
                  <div key={item.name} className="rounded-lg border border-white/8 bg-slate-900/50 px-2.5 py-1.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-300 truncate max-w-[130px]" title={item.name}>{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">{Number(item.total_hours || 0).toFixed(1)} h</span>
                        <span className="text-xs font-bold text-amber-300">{item.entries}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1">
                      <div className="h-1 rounded-full bg-amber-400/60 transition-all" style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardPanel>

          {/* By Site Incharge */}
          <CardPanel className="p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">By Site Incharge</h3>
            <div className="space-y-1 max-h-44 overflow-y-auto scrollbar-thin">
              {(dashboard.site_incharge_view || []).length === 0 && (
                <div className="text-xs text-slate-500">No data</div>
              )}
              {(dashboard.site_incharge_view || []).map((item) => {
                const maxE = Math.max(...(dashboard.site_incharge_view || []).map((x) => x.entries), 1);
                const barPct = Math.round((item.entries / maxE) * 100);
                return (
                  <div key={item.name} className="rounded-lg border border-white/8 bg-slate-900/50 px-2.5 py-1.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-300 truncate max-w-[130px]" title={item.name}>{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">{Number(item.total_hours || 0).toFixed(1)} h</span>
                        <span className="text-xs font-bold text-emerald-300">{item.entries}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1">
                      <div className="h-1 rounded-full bg-emerald-400/60 transition-all" style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardPanel>

          {/* Manhours & Entries Trend */}
          <CardPanel className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hours Trend</h3>
              <div className="flex gap-1">
                {["monthly", "weekly"].map((v) => (
                  <button key={v} type="button" onClick={() => setMnpTrendView(v)}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                      mnpTrendView === v ? "bg-sky-500 text-white" : "border border-white/20 text-slate-400 hover:text-white"
                    }`}>
                    {v === "monthly" ? "Mo" : "Wk"}
                  </button>
                ))}
              </div>
            </div>
            {mnpTrendData.some((r) => r.entries > 0) ? (
              <div className="h-36">
                <Bar data={mnpTrendBarData} options={mnpTrendBarOptions} />
              </div>
            ) : (
              <div className="h-36 flex items-center justify-center text-xs text-slate-500">No trend data</div>
            )}
            <div className="mt-2 space-y-0.5 max-h-24 overflow-y-auto scrollbar-thin">
              {mnpTrendData.map((row) => {
                const key = mnpTrendView === "monthly" ? row.month : row.week;
                const maxH = Math.max(...mnpTrendData.map((r) => r.total_hours), 1);
                const barPct = Math.round((row.total_hours / maxH) * 100);
                return (
                  <div key={key} className="flex items-center gap-2 text-[10px]">
                    <span className="text-slate-400 w-20 shrink-0 truncate">{key}</span>
                    <div className="flex-1 bg-slate-800 rounded-full h-1">
                      <div className="h-1 rounded-full bg-sky-400/70" style={{ width: `${barPct}%` }} />
                    </div>
                    <span className="text-sky-300 w-12 text-right shrink-0">{row.total_hours}h</span>
                    <span className="text-slate-500 w-8 text-right shrink-0">{row.entries}</span>
                  </div>
                );
              })}
            </div>
          </CardPanel>

        </div>

        {/* Recent Entries Table */}
        <CardPanel>
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-base font-bold text-white">👷 Manpower Entries</h3>
            <span className="text-xs text-slate-500">{dashboard.recent_entries.length} records</span>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[1100px] text-xs border-collapse table-auto">
              <thead>
                <tr className="border-b border-white/10 bg-slate-950/60">
                  {TABLE_COLS.map((col) => (
                    <th key={col} className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400 whitespace-normal break-words leading-tight">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dashboard.recent_entries.length === 0 && (
                  <tr>
                    <td colSpan={TABLE_COLS.length} className="px-4 py-10 text-center text-slate-500 text-sm">
                      No entries found for the selected filters.
                    </td>
                  </tr>
                )}
                {dashboard.recent_entries.map((entry, idx) => {
                  const st = getApprovalState(entry);
                  const isEditing = editingEntry?._id === entry._id;
                  return (
                    <tr key={entry._id} className={`border-b border-white/5 hover:bg-white/3 transition ${ROW_BG[st]}`}>
                      <td className="px-2 py-2 text-slate-500 text-[10px]">{idx + 1}</td>
                      <td className="px-2 py-2 text-slate-300">{entry.incharge || "-"}</td>
                      <td className="px-2 py-2">
                        {isEditing
                          ? <input type="date" className={inlineInputCls} value={entryForm.work_date} onChange={(e) => setEntryForm((p) => ({ ...p, work_date: e.target.value }))} />
                          : <span className="text-slate-300 whitespace-nowrap">{entry.work_date || "-"}</span>}
                      </td>
                      <td className="px-2 py-2 text-slate-300">{entry.company_name || "-"}</td>
                      <td className="px-2 py-2 font-semibold text-slate-100 align-top min-w-[11rem] max-w-md">
                        <span className="inline-flex items-start gap-2">
                          <WorkerAvatar
                            name={entry.worker_name}
                            civilId={entry.civil_id}
                            profilePicture={entry.profile_picture}
                            sizeClass="w-7 h-7"
                            title={formatWorkerProfileTooltip(entry.worker_profile, entry)}
                          />
                          <span className="break-words whitespace-normal text-left leading-snug">
                            {entry.worker_name || "-"}
                          </span>
                        </span>
                      </td>
                      <td className="px-2 py-2 text-slate-300">{entry.designation || "-"}</td>
                      <td className="px-2 py-2 text-slate-400">Manpower</td>
                      <td className="px-2 py-2">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                          entry.category === "Indirect"
                            ? "text-violet-300 bg-violet-500/10 border-violet-400/20"
                            : "text-sky-300 bg-sky-500/10 border-sky-400/20"
                        }`}>
                          {entry.category || "Direct"}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        {isEditing
                          ? <input type="text" className={inlineInputCls} value={entryForm.location} onChange={(e) => setEntryForm((p) => ({ ...p, location: e.target.value }))} />
                          : <span className="text-slate-300">{entry.location || "-"}</span>}
                      </td>
                      <td className="px-2 py-2 text-slate-500">-</td>
                      <td className="px-2 py-2 text-slate-500">-</td>
                      <td className="px-2 py-2">
                        {isEditing
                          ? <select className={`${inlineInputCls} cursor-pointer`} value={entryForm.attendance_status} onChange={(e) => setEntryForm((p) => ({ ...p, attendance_status: e.target.value }))}>
                              <option value="">Null</option>
                              <option value="Day">Day</option>
                              <option value="Idle">Idle</option>
                              <option value="Absent">Absent</option>
                            </select>
                          : (() => {
                              const raw = entry.worker_shift || entry.attendance_status || "";
                              if (!raw) return <span className="text-slate-500">-</span>;
                              const label = raw === "Request for leave" ? "Leave" : raw;
                              const isExpanded = expandedShiftId === entry._id;
                              return (
                                <button type="button"
                                  onClick={() => setExpandedShiftId((p) => p === entry._id ? null : entry._id)}
                                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border cursor-pointer transition ${
                                    raw === "Request for leave" || raw === "Leave"
                                      ? "text-amber-300 bg-amber-500/10 border-amber-400/20"
                                      : raw === "Night"
                                        ? "text-violet-300 bg-violet-500/10 border-violet-400/20"
                                        : "text-sky-300 bg-sky-500/10 border-sky-400/20"
                                  }`}>
                                  {isExpanded ? label : label.length > 10 ? label.slice(0, 10) + "…" : label}
                                </button>
                              );
                            })()}
                      </td>
                      <td className="px-2 py-2">
                        {isEditing
                          ? <input type="number" className={inlineInputCls} value={entryForm.hours} min="0" max="24" step="0.5" onChange={(e) => setEntryForm((p) => ({ ...p, hours: e.target.value }))} />
                          : <span className="font-bold text-sky-300">{entryManhours(entry) ?? "-"}</span>}
                      </td>
                      <td className="px-2 py-2 max-w-[120px]">
                        {isEditing
                          ? <input type="text" className={inlineInputCls} value={entryForm.today_activity} onChange={(e) => setEntryForm((p) => ({ ...p, today_activity: e.target.value }))} />
                          : <span className="text-slate-300 truncate block" title={entry.today_activity}>{entry.today_activity || "-"}</span>}
                      </td>
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <select
                            className={`${inlineInputCls} cursor-pointer`}
                            value={entryForm.approval_status}
                            onChange={(e) => setEntryForm((p) => ({ ...p, approval_status: e.target.value }))}
                          >
                            <option value="">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        ) : (
                          <span className={STATUS_PILL[st]}>
                            {st === "approved" ? "✓" : st === "rejected" ? "✗" : "⏳"} {st}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <input
                            type="text"
                            className={inlineInputCls}
                            placeholder="Required for rejected"
                            value={entryForm.rejection_reason}
                            onChange={(e) => setEntryForm((p) => ({ ...p, rejection_reason: e.target.value }))}
                          />
                        ) : (
                          entry.rejection_reason
                            ? <span title={entry.rejection_reason} className="text-rose-300 text-xs underline decoration-dotted cursor-help">
                                {entry.rejection_reason.length > 18 ? entry.rejection_reason.slice(0, 18) + "…" : entry.rejection_reason}
                              </span>
                            : <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {isEditing
                          ? <div className="flex gap-1.5">
                              <button type="button" onClick={saveEntryEdit}
                                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-1 transition">Save</button>
                              <button type="button" onClick={() => setEditingEntry(null)}
                                className="rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold px-2.5 py-1 transition">Cancel</button>
                            </div>
                          : <div className="flex gap-1.5">
                              <button type="button" onClick={() => openEditEntry(entry)}
                                className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold px-2.5 py-1 transition">Edit</button>
                              <button type="button" onClick={() => deleteEntry(entry._id)}
                                className="rounded-lg bg-rose-700/80 hover:bg-rose-600 text-white text-[11px] font-bold px-2.5 py-1 transition">Del</button>
                            </div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardPanel>
      </div>
    </>
  );
}

// ── Equipment Tab ─────────────────────────────────────────────────────────────
function EquipmentTab() {
  const [equipSubTab, setEquipSubTab] = useState("overview"); // "overview" | "tracking"
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("all");
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [anchorDate, setAnchorDate] = useState(new Date().toISOString().slice(0, 10));
  const [dashboard, setDashboard] = useState({
    summary: {}, by_type: [], by_location: [], by_equipment: [],
    weekly_trend: [], monthly_trend: [], equipment_master: [], entries: [],
  });
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [editingEntry, setEditingEntry] = useState(null);
  const [eqForm, setEqForm] = useState({});
  const [editingMaster, setEditingMaster] = useState(null);
  const [masterForm, setMasterForm] = useState({
    name: "",
    plate_number: "",
    equipment_type: "",
    location: "",
    ownership: "owned",
    is_active: true,
    equipment_picture: "",
    supply_rate: { hourly: "", daily: "", weekly: "", monthly: "" },
    contract_rate: { hourly: "", daily: "", weekly: "", monthly: "" },
  });
  const [pendingCount, setPendingCount] = useState(0);
  const [showMasterList, setShowMasterList] = useState(false);
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [showEquipmentImport, setShowEquipmentImport] = useState(false);
  const [locations, setLocations] = useState([]);
  const [newEquipment, setNewEquipment] = useState({
    name: "",
    plate_number: "",
    equipment_type: "",
    location: "",
    ownership: "owned",
    equipment_picture: "",
    supply_rate: { hourly: "", daily: "", weekly: "", monthly: "" },
    contract_rate: { hourly: "", daily: "", weekly: "", monthly: "" },
  });
  const [masterCropOpen, setMasterCropOpen] = useState(false);
  const [newEquipCropOpen, setNewEquipCropOpen] = useState(false);
  const [trendView, setTrendView] = useState("monthly"); // "weekly" | "monthly"
  const [masterSearch, setMasterSearch] = useState("");
  const [equipmentImportSheetName, setEquipmentImportSheetName] = useState("");
  const [equipmentImportDryRun, setEquipmentImportDryRun] = useState(false);
  const [equipmentImportCivilId, setEquipmentImportCivilId] = useState("");
  const [equipmentImportResult, setEquipmentImportResult] = useState(null);
  const [equipmentImporting, setEquipmentImporting] = useState(false);
  const equipmentImportFileRef = useRef(null);

  const runWithLoading = useCallback(async (fn) => {
    setPendingCount((c) => c + 1);
    try { return await fn(); }
    finally { setPendingCount((c) => Math.max(0, c - 1)); }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [typesRes, locRes] = await Promise.all([
          runWithLoading(() => fetch(apiUrl("/api/equipment/types"))),
          runWithLoading(() => fetch(apiUrl("/api/master-data/options"))),
        ]);
        const typesData = await typesRes.json();
        const locData = await locRes.json();
        if (typesData.ok) setEquipmentTypes(typesData.types || []);
        if (locData.ok) setLocations(locData.locations || []);
      } catch { /* ignore */ }
    };
    load();
  }, [runWithLoading]);

  const loadDashboard = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        location: selectedLocation,
        type: selectedType,
        period: selectedPeriod,
        anchor_date: anchorDate,
      });
      const res = await runWithLoading(() => fetch(apiUrl(`/api/management/equipment-dashboard?${params}`)));
      const data = await res.json();
      if (data.ok) setDashboard(data);
    } catch (e) { console.error(e); }
  }, [selectedLocation, selectedType, selectedPeriod, anchorDate, runWithLoading]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const handleDownloadExcel = () => {
    const params = new URLSearchParams({ location: selectedLocation, type: selectedType, period: selectedPeriod, anchor_date: anchorDate });
    window.open(apiUrl(`/api/management/export-equipment-excel?${params}`), "_blank");
  };

  const handleDownloadMasterListExcel = () => {
    const params = new URLSearchParams({
      location: selectedLocation,
      type: selectedType,
      search: masterSearch.trim(),
    });
    window.open(apiUrl(`/api/management/export-equipment-master-excel?${params}`), "_blank");
  };

  const submitEquipmentImport = async () => {
    const file = equipmentImportFileRef.current?.files?.[0];
    if (!file) { alert("Choose an .xlsx file first."); return; }
    const auth = await promptManagementPassword("import equipment Excel");
    if (auth.cancelled) return;
    if (auth.error) { alert(auth.error); return; }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("management_password", auth.password);
    if (equipmentImportSheetName.trim()) fd.append("sheet_name", equipmentImportSheetName.trim());
    if (equipmentImportDryRun) fd.append("dry_run", "true");
    if (equipmentImportCivilId.trim()) fd.append("operator_civil_id", equipmentImportCivilId.trim());

    setEquipmentImportResult(null);
    setEquipmentImporting(true);
    try {
      const res = await runWithLoading(() => fetch(apiUrl("/api/management/equipment-entries/import-excel"), {
        method: "POST",
        body: fd,
      }));
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        alert(data?.error || "Unable to import equipment excel");
        setEquipmentImporting(false);
        return;
      }
      setEquipmentImportResult(data);
      if (!equipmentImportDryRun) {
        await loadDashboard();
      }
      if (equipmentImportFileRef.current) equipmentImportFileRef.current.value = "";
    } catch (e) {
      alert("Import failed: " + (e?.message || e));
    } finally {
      setEquipmentImporting(false);
    }
  };

  const reloadTypes = async () => {
    try {
      const res = await fetch(apiUrl("/api/equipment/types"));
      const data = await res.json();
      if (data.ok) setEquipmentTypes(data.types || []);
    } catch { /* ignore */ }
  };

  const createEquipment = async (e) => {
    e.preventDefault();
    if (!newEquipment.name.trim() || !newEquipment.equipment_type.trim() || !newEquipment.location.trim()) {
      alert("Equipment name, type, and location are required.");
      return;
    }
    const sr = {};
    const cr = {};
    ["hourly", "daily", "weekly", "monthly"].forEach((k) => {
      const sv = newEquipment.supply_rate[k];
      if (sv !== "" && sv != null && !Number.isNaN(Number(sv))) sr[k] = Number(sv);
      const cv = newEquipment.contract_rate[k];
      if (cv !== "" && cv != null && !Number.isNaN(Number(cv))) cr[k] = Number(cv);
    });
    try {
      const body = {
        name: newEquipment.name.trim(),
        plate_number: newEquipment.plate_number.trim(),
        equipment_type: newEquipment.equipment_type.trim(),
        location: newEquipment.location,
        ownership: newEquipment.ownership,
        supply_rate: sr,
        contract_rate: cr,
      };
      if (newEquipment.equipment_picture?.trim()) {
        body.equipment_picture = newEquipment.equipment_picture;
      }
      const res = await runWithLoading(() => fetch(apiUrl("/api/management/equipment"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }));
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Failed to add equipment"); return; }
      setNewEquipment({
        name: "",
        plate_number: "",
        equipment_type: "",
        location: "",
        ownership: "owned",
        equipment_picture: "",
        supply_rate: { hourly: "", daily: "", weekly: "", monthly: "" },
        contract_rate: { hourly: "", daily: "", weekly: "", monthly: "" },
      });
      setShowAddEquipment(false);
      await loadDashboard();
      await reloadTypes();
    } catch { alert("Unable to add equipment"); }
  };

  const openEditEntry = (entry) => {
    setEditingEntry(entry);
    setEqForm({
      work_date: entry.work_date || "",
      operator_name: entry.operator_name || "",
      location: entry.location || "",
      equipment_status: entry.equipment_status || "",
      time_from: entry.time_from || "",
      time_to: entry.time_to || "",
      hours: entry.hours ?? "",
      rental_amount: entry.rental_amount ?? "",
      activity: entry.activity || "",
      approval_status: entry.approval_status || "",
      approved_by: entry.approved_by || "",
      rejection_reason: entry.rejection_reason || "",
    });
  };

  const openEditMaster = (eq) => {
    setEditingMaster(eq);
    setMasterForm({
      name: eq.name || "",
      plate_number: eq.plate_number || "",
      equipment_type: eq.equipment_type || "",
      location: eq.location || "",
      ownership: eq.ownership || "owned",
      is_active: eq.is_active !== false,
      equipment_picture: eq.equipment_picture || "",
      supply_rate: {
        hourly: eq.supply_rate?.hourly ?? "",
        daily: eq.supply_rate?.daily ?? "",
        weekly: eq.supply_rate?.weekly ?? "",
        monthly: eq.supply_rate?.monthly ?? "",
      },
      contract_rate: {
        hourly: eq.contract_rate?.hourly ?? "",
        daily: eq.contract_rate?.daily ?? "",
        weekly: eq.contract_rate?.weekly ?? "",
        monthly: eq.contract_rate?.monthly ?? "",
      },
    });
  };

  const saveMasterEdit = async () => {
    if (!editingMaster?._id) return;
    if (!masterForm.name.trim() || !masterForm.equipment_type.trim() || !masterForm.location.trim()) {
      alert("Name, type, and location are required.");
      return;
    }
    const auth = await promptManagementPassword("save equipment master changes");
    if (auth.cancelled) return;
    if (auth.error) { alert(auth.error); return; }
    const sr = {};
    const cr = {};
    ["hourly", "daily", "weekly", "monthly"].forEach((k) => {
      const sv = masterForm.supply_rate[k];
      if (sv !== "" && sv != null && !Number.isNaN(Number(sv))) sr[k] = Number(sv);
      const cv = masterForm.contract_rate[k];
      if (cv !== "" && cv != null && !Number.isNaN(Number(cv))) cr[k] = Number(cv);
    });
    try {
      const res = await runWithLoading(() => fetch(apiUrl(`/api/management/equipment/${editingMaster._id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: masterForm.name.trim(),
          plate_number: masterForm.plate_number.trim(),
          equipment_type: masterForm.equipment_type.trim(),
          location: masterForm.location.trim(),
          ownership: masterForm.ownership,
          is_active: masterForm.is_active,
          supply_rate: sr,
          contract_rate: cr,
          equipment_picture: masterForm.equipment_picture?.trim() ? masterForm.equipment_picture : null,
          management_password: auth.password,
        }),
      }));
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Failed to update equipment"); return; }
      setEditingMaster(null);
      await loadDashboard();
      await reloadTypes();
    } catch { alert("Unable to update equipment"); }
  };

  const saveEntryEdit = async () => {
    if (!editingEntry?._id) return;
    const auth = await promptManagementPassword("save equipment entry changes");
    if (auth.cancelled) return;
    if (auth.error) { alert(auth.error); return; }
    try {
      const res = await runWithLoading(() => fetch(apiUrl(`/api/equipment-entries/${editingEntry._id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...eqForm, management_password: auth.password }),
      }));
      const data = await res.json();
      if (!res.ok) { alert(data?.error || "Unable to update entry"); return; }
      setEditingEntry(null);
      await loadDashboard();
    } catch { alert("Unable to update now"); }
  };

  const deleteEntry = async (entryId) => {
    if (!window.confirm("Delete this equipment entry?")) return;
    try {
      const res = await runWithLoading(() => fetch(apiUrl(`/api/equipment-entries/${entryId}`), { method: "DELETE" }));
      const data = await res.json();
      if (!res.ok) { alert(data?.error || "Unable to delete"); return; }
      await loadDashboard();
    } catch { alert("Unable to delete now"); }
  };

  const getApprovalState = (entry) => {
    const s = (entry?.approval_status || "").toLowerCase();
    if (s === "approved") return "approved";
    if (s === "rejected") return "rejected";
    return "pending";
  };

  const typeChart = useMemo(() => ({
    labels: (dashboard.by_type || []).map((x) => x.name),
    datasets: [{
      data: (dashboard.by_type || []).map((x) => x.entries),
      backgroundColor: PIE_COLORS.slice(0, (dashboard.by_type || []).length),
      borderColor: "rgba(15,23,42,0.9)", borderWidth: 1,
    }],
  }), [dashboard.by_type]);

  const pieOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { color: "rgba(226,232,240,0.9)", boxWidth: 12 } },
      tooltip: { enabled: true },
      datalabels: {
        color: "#fff",
        font: { weight: "bold", size: 11 },
        formatter: (value, ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + Number(b || 0), 0);
          if (!total || !value) return "";
          return Math.round((Number(value) / total) * 100) + "%";
        },
      },
    },
  }), []);

  // Filter entries by selected specific equipment
  const filteredEntries = useMemo(() => {
    const all = dashboard.entries || [];
    if (selectedEquipmentId === "all") return all;
    return all.filter((e) => e.equipment_id === selectedEquipmentId);
  }, [dashboard.entries, selectedEquipmentId]);

  // Selected equipment cost summary
  const selectedEqStats = useMemo(() => {
    if (selectedEquipmentId === "all") return null;
    return (dashboard.by_equipment || []).find((e) => e.equipment_id === selectedEquipmentId) || null;
  }, [dashboard.by_equipment, selectedEquipmentId]);

  // Build equipment dropdown options from master list
  const equipmentOptions = useMemo(() => {
    const master = dashboard.equipment_master || [];
    const typeFiltered = selectedType === "all" ? master : master.filter((e) => e.equipment_type === selectedType);
    return typeFiltered;
  }, [dashboard.equipment_master, selectedType]);

  // Filtered master list
  const filteredMaster = useMemo(() => {
    const master = dashboard.equipment_master || [];
    const q = masterSearch.trim().toLowerCase();
    return q ? master.filter((e) =>
      (e.name || "").toLowerCase().includes(q) ||
      (e.plate_number || "").toLowerCase().includes(q) ||
      (e.equipment_type || "").toLowerCase().includes(q) ||
      (e.location || "").toLowerCase().includes(q)
    ) : master;
  }, [dashboard.equipment_master, masterSearch]);

  const trendData = trendView === "monthly" ? (dashboard.monthly_trend || []) : (dashboard.weekly_trend || []);

  const summ = dashboard.summary || {};

  return (
    <>
      <LoadingOverlay show={pendingCount > 0} message="Loading equipment data..." />

      {/* ── Sub-tab switcher ── */}
      <div className="flex gap-1 mb-5 border-b border-white/10">
        {[
          { id: "overview", label: "🚜 Overview & Entries" },
          { id: "tracking", label: "📡 Equipment Tracking" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setEquipSubTab(t.id)}
            className={`px-5 py-2.5 text-sm font-bold transition border-b-2 -mb-px ${
              equipSubTab === t.id
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tracking sub-tab ── */}
      {equipSubTab === "tracking" && <EquipmentTrackingTab />}

      {/* ── Overview sub-tab ── */}
      {equipSubTab === "overview" && <>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button type="button" onClick={() => { setShowAddEquipment((v) => !v); setShowMasterList(false); }}
          className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 transition">
          {showAddEquipment ? "Close" : "+"} Add Equipment
        </button>
        <button type="button" onClick={() => { setShowMasterList((v) => !v); setShowAddEquipment(false); }}
          className="rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-3 py-2 transition">
          {showMasterList ? "Hide" : "📋"} Equipment List
        </button>
        <button type="button" onClick={handleDownloadExcel}
          className="rounded-xl border border-amber-400/30 hover:border-amber-400/60 text-amber-300 hover:text-amber-100 text-xs font-bold px-3 py-2 transition"
          title="Download equipment time entries for the selected period and filters">
          ↓ Entries (Excel)
        </button>
        <button
          type="button"
          onClick={() => { setShowEquipmentImport((v) => !v); setEquipmentImportResult(null); }}
          className="rounded-xl border border-sky-400/35 hover:border-sky-400/65 text-sky-200 text-xs font-bold px-3 py-2 transition"
        >
          ↑ Import Equipment Excel
        </button>
      </div>

      <div className="space-y-5">
        {showEquipmentImport && (
          <CardPanel className="p-5 border-sky-400/20 bg-sky-950/20">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-bold text-white">Import Equipment Entries (Any Month)</div>
              <button
                type="button"
                disabled={equipmentImporting}
                onClick={() => { setShowEquipmentImport(false); setEquipmentImportResult(null); }}
                className="text-slate-400 hover:text-slate-200 disabled:opacity-40 text-xs font-bold px-2 py-1 rounded transition"
              >
                ✕ Close
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Upload monthly equipment workbook (for example: <span className="text-slate-200">Equipment entries March-26.xlsx</span>).
              Required columns should include Date, Equipment/Name, and Area/Location. Optional: plate, status, hours, activity, rental amount, operator details.
            </p>

            <div className="flex flex-wrap gap-3 items-end mb-4">
              <div>
                <div className={labelCls}>Excel File (.xlsx)</div>
                <input
                  ref={equipmentImportFileRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="text-xs text-slate-300 max-w-full file:mr-2 file:rounded-lg file:border-0 file:bg-sky-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-sky-500 cursor-pointer"
                />
              </div>
              <FormField label="Sheet Name (optional)">
                <input
                  type="text"
                  className={`${inputCls} w-48`}
                  placeholder="e.g. March 2026"
                  value={equipmentImportSheetName}
                  onChange={(e) => setEquipmentImportSheetName(e.target.value)}
                />
              </FormField>
              <FormField label="Default operator Civil ID (optional)">
                <input
                  type="text"
                  className={`${inputCls} w-52`}
                  placeholder="Defaults to import operator ID"
                  value={equipmentImportCivilId}
                  onChange={(e) => setEquipmentImportCivilId(e.target.value)}
                />
              </FormField>
              <label className="flex items-center gap-2 text-xs text-slate-300 mb-1">
                <input
                  type="checkbox"
                  checked={equipmentImportDryRun}
                  onChange={(e) => setEquipmentImportDryRun(e.target.checked)}
                  className="rounded border-white/20 accent-sky-400"
                />
                Dry run (validate only, no insert)
              </label>
            </div>

            <button
              type="button"
              onClick={submitEquipmentImport}
              disabled={equipmentImporting}
              className="rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold px-5 py-2.5 transition shadow-lg shadow-sky-900/40"
            >
              {equipmentImporting ? "Importing..." : "Run Equipment Import"}
            </button>

            {equipmentImportResult && (
              <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/60 p-4">
                <div className="text-sm font-bold mb-3 text-emerald-300">Equipment Import Complete</div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
                  {[
                    { label: "Rows Read", value: equipmentImportResult.rows_read ?? 0, color: "text-slate-200" },
                    { label: "Equipment Rows", value: equipmentImportResult.equipment_rows ?? 0, color: "text-sky-300" },
                    { label: "Inserted", value: equipmentImportResult.inserted ?? 0, color: "text-emerald-300" },
                    { label: "Merged", value: equipmentImportResult.merged ?? 0, color: "text-amber-300" },
                    { label: "Errors", value: equipmentImportResult.error_count ?? 0, color: "text-rose-300" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg bg-slate-800/70 border border-white/8 p-3 text-center">
                      <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
                {!!equipmentImportResult?.errors?.length && (
                  <details className="mt-2">
                    <summary className="text-xs font-semibold text-rose-300 cursor-pointer hover:text-rose-200">
                      Show import errors ({equipmentImportResult.errors.length})
                    </summary>
                    <div className="mt-2 max-h-44 overflow-y-auto rounded-lg bg-rose-950/30 border border-rose-400/20 p-2 space-y-1">
                      {equipmentImportResult.errors.map((e, i) => (
                        <div key={i} className="text-[11px] text-rose-200 font-mono">
                          Row {e.row}: {e.error}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </CardPanel>
        )}

        {/* ── Add New Equipment ── */}
        {showAddEquipment && (
          <CardPanel className="p-6">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <h3 className="text-base font-bold text-white">Register New Equipment</h3>
              <button type="button" onClick={() => setShowAddEquipment(false)}
                className="rounded-lg border border-white/15 hover:border-rose-400/40 text-slate-400 hover:text-rose-300 text-xs font-bold px-3 py-1.5 transition">
                Close
              </button>
            </div>
            <form onSubmit={createEquipment} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField label="Equipment Name *">
                  <input type="text" className={inputCls} required
                    value={newEquipment.name}
                    onChange={(e) => setNewEquipment((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. 70T TELESCOPIC CRANE" />
                </FormField>
                <FormField label="Plate / Serial No.">
                  <input type="text" className={inputCls}
                    value={newEquipment.plate_number}
                    onChange={(e) => setNewEquipment((p) => ({ ...p, plate_number: e.target.value }))}
                    placeholder="Optional" />
                </FormField>
                <FormField label="Equipment Type *">
                  <input type="text" className={inputCls} required list="equipment-type-suggestions"
                    value={newEquipment.equipment_type}
                    onChange={(e) => setNewEquipment((p) => ({ ...p, equipment_type: e.target.value }))}
                    placeholder="e.g. Crane, Forklift" />
                  <datalist id="equipment-type-suggestions">
                    {equipmentTypes.map((t) => <option key={t} value={t} />)}
                  </datalist>
                </FormField>
                <FormField label="Location / Area *">
                  <input type="text" className={inputCls} required list="equipment-location-suggestions"
                    value={newEquipment.location}
                    onChange={(e) => setNewEquipment((p) => ({ ...p, location: e.target.value }))}
                    placeholder="Select or type area name" />
                  <datalist id="equipment-location-suggestions">
                    {locations.map((loc) => <option key={loc._id} value={loc.name} />)}
                  </datalist>
                </FormField>
                <FormField label="Ownership *">
                  <select className={selectCls}
                    value={newEquipment.ownership}
                    onChange={(e) => setNewEquipment((p) => ({ ...p, ownership: e.target.value }))}>
                    <option value="owned">ENCO Owned</option>
                    <option value="rental">Rental</option>
                  </select>
                </FormField>
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Supply rate (OMR) — optional</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {["hourly", "daily", "weekly", "monthly"].map((k) => (
                    <FormField key={`sr-${k}`} label={k.charAt(0).toUpperCase() + k.slice(1)}>
                      <input type="number" step="0.01" min="0" className={inputCls}
                        value={newEquipment.supply_rate[k]}
                        onChange={(e) => setNewEquipment((p) => ({
                          ...p,
                          supply_rate: { ...p.supply_rate, [k]: e.target.value },
                        }))}
                        placeholder="—" />
                    </FormField>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Contract rate (OMR) — optional</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {["hourly", "daily", "weekly", "monthly"].map((k) => (
                    <FormField key={`cr-${k}`} label={k.charAt(0).toUpperCase() + k.slice(1)}>
                      <input type="number" step="0.01" min="0" className={inputCls}
                        value={newEquipment.contract_rate[k]}
                        onChange={(e) => setNewEquipment((p) => ({
                          ...p,
                          contract_rate: { ...p.contract_rate, [k]: e.target.value },
                        }))}
                        placeholder="—" />
                    </FormField>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Equipment photo — optional</div>
                {newEquipment.equipment_picture ? (
                  <div className="mb-3 rounded-lg overflow-hidden border border-white/10 max-w-sm aspect-video bg-black/30">
                    <img src={newEquipment.equipment_picture} alt="" className="w-full h-full object-cover max-h-40" />
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setNewEquipCropOpen(true)}
                    className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 text-xs font-bold px-3 py-2"
                  >
                    Choose & crop photo
                  </button>
                  {newEquipment.equipment_picture && (
                    <button
                      type="button"
                      onClick={() => setNewEquipment((p) => ({ ...p, equipment_picture: "" }))}
                      className="rounded-lg text-rose-300/90 hover:text-rose-200 text-xs font-semibold px-2 py-2 underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button type="submit"
                  className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold px-8 py-2.5 transition">
                  Save Equipment
                </button>
              </div>
            </form>
          </CardPanel>
        )}

        {/* ── Edit Equipment Master ── */}
        {editingMaster && (
          <CardPanel className="p-6">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <h3 className="text-base font-bold text-white">
                Edit Equipment Master
                <span className="ml-2 text-xs text-slate-500 font-normal">
                  {editingMaster.name}{editingMaster.plate_number ? ` [${editingMaster.plate_number}]` : ""}
                </span>
              </h3>
              <button type="button" onClick={() => setEditingMaster(null)}
                className="rounded-lg border border-white/15 hover:border-rose-400/40 text-slate-400 hover:text-rose-300 text-xs font-bold px-3 py-1.5 transition">
                Close
              </button>
            </div>
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField label="Equipment Name *">
                  <input type="text" className={inputCls} value={masterForm.name}
                    onChange={(e) => setMasterForm((p) => ({ ...p, name: e.target.value }))} />
                </FormField>
                <FormField label="Plate / Serial No.">
                  <input type="text" className={inputCls} value={masterForm.plate_number}
                    onChange={(e) => setMasterForm((p) => ({ ...p, plate_number: e.target.value }))} />
                </FormField>
                <FormField label="Type *">
                  <input type="text" className={inputCls} value={masterForm.equipment_type}
                    onChange={(e) => setMasterForm((p) => ({ ...p, equipment_type: e.target.value }))} />
                </FormField>
                <FormField label="Location *">
                  <input type="text" className={inputCls} value={masterForm.location}
                    onChange={(e) => setMasterForm((p) => ({ ...p, location: e.target.value }))} />
                </FormField>
                <FormField label="Ownership">
                  <select className={selectCls} value={masterForm.ownership}
                    onChange={(e) => setMasterForm((p) => ({ ...p, ownership: e.target.value }))}>
                    <option value="owned">ENCO Owned</option>
                    <option value="rental">Rental</option>
                  </select>
                </FormField>
                <FormField label="Status">
                  <select className={selectCls} value={masterForm.is_active ? "active" : "inactive"}
                    onChange={(e) => setMasterForm((p) => ({ ...p, is_active: e.target.value === "active" }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </FormField>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Equipment photo</div>
                {masterForm.equipment_picture ? (
                  <div className="mb-3 rounded-lg overflow-hidden border border-white/10 max-w-sm aspect-video bg-black/30">
                    <img src={masterForm.equipment_picture} alt="" className="w-full h-full object-cover max-h-40" />
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 mb-2">No photo yet. Add one so operators see it on the equipment portal.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setMasterCropOpen(true)}
                    className="rounded-lg border border-amber-400/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs font-bold px-3 py-2"
                  >
                    Choose & crop photo
                  </button>
                  {masterForm.equipment_picture && (
                    <button
                      type="button"
                      onClick={() => setMasterForm((p) => ({ ...p, equipment_picture: "" }))}
                      className="rounded-lg text-rose-300/90 hover:text-rose-200 text-xs font-semibold px-2 py-2 underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Supply rate (OMR)</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {["hourly", "daily", "weekly", "monthly"].map((k) => (
                    <FormField key={`msr-${k}`} label={k.charAt(0).toUpperCase() + k.slice(1)}>
                      <input type="number" step="0.01" min="0" className={inputCls}
                        value={masterForm.supply_rate[k]}
                        onChange={(e) => setMasterForm((p) => ({
                          ...p,
                          supply_rate: { ...p.supply_rate, [k]: e.target.value },
                        }))} />
                    </FormField>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Contract rate (OMR)</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {["hourly", "daily", "weekly", "monthly"].map((k) => (
                    <FormField key={`mcr-${k}`} label={k.charAt(0).toUpperCase() + k.slice(1)}>
                      <input type="number" step="0.01" min="0" className={inputCls}
                        value={masterForm.contract_rate[k]}
                        onChange={(e) => setMasterForm((p) => ({
                          ...p,
                          contract_rate: { ...p.contract_rate, [k]: e.target.value },
                        }))} />
                    </FormField>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingMaster(null)}
                  className="rounded-xl border border-white/20 text-slate-300 text-sm font-bold px-6 py-2.5 transition">
                  Cancel
                </button>
                <button type="button" onClick={saveMasterEdit}
                  className="rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold px-6 py-2.5 transition">
                  Save Equipment Changes
                </button>
              </div>
            </div>
          </CardPanel>
        )}

        {/* ── Equipment Master List Panel ── */}
        {showMasterList && (
          <CardPanel className="p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h3 className="text-base font-bold text-white">📋 Equipment Master List
                <span className="ml-2 text-xs text-slate-500 font-normal">({filteredMaster.length} equipment)</span>
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadMasterListExcel}
                  className="rounded-xl border border-emerald-400/35 hover:border-emerald-400/65 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-200 text-xs font-bold px-3 py-2 transition whitespace-nowrap"
                  title="Download this equipment list as an Excel file (respects location/type filters and search)"
                >
                  ↓ Download list (Excel)
                </button>
                <input
                  type="text"
                  className={`${inputCls} w-64 min-w-[12rem]`}
                  placeholder="Search name, plate, type, location..."
                  value={masterSearch}
                  onChange={(e) => setMasterSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[1100px] text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-slate-950/60">
                    {["#", "Equipment Name", "Plate / Serial", "Type", "Location", "Ownership", "Status",
                      "Supply Rate/mo (OMR)", "Contract/hr", "Contract/day", "Contract/wk", "Contract/mo", "Action"].map((col) => (
                      <th key={col} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMaster.length === 0 && (
                    <tr><td colSpan={13} className="px-4 py-8 text-center text-slate-500">No equipment found.</td></tr>
                  )}
                  {filteredMaster.map((eq, idx) => {
                    const cr = eq.contract_rate || {};
                    const sr = eq.supply_rate || {};
                    const isRental = eq.ownership === "rental";
                    return (
                      <tr key={eq._id} className="border-b border-white/5 hover:bg-white/3 transition">
                        <td className="px-3 py-2 text-slate-600">{idx + 1}</td>
                        <td className="px-3 py-2 font-semibold text-slate-100 whitespace-nowrap">{eq.name}</td>
                        <td className="px-3 py-2">
                          {eq.plate_number
                            ? <span className="font-mono bg-slate-800 border border-white/10 rounded px-1.5 py-0.5 text-amber-300">{eq.plate_number}</span>
                            : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border text-sky-300 bg-sky-500/10 border-sky-400/20">
                            {eq.equipment_type}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{eq.location}</td>
                        <td className="px-3 py-2">
                          {isRental
                            ? <span className="text-[11px] font-bold text-rose-300 bg-rose-500/10 border border-rose-400/20 rounded-full px-2 py-0.5">Rental</span>
                            : <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 rounded-full px-2 py-0.5">ENCO Owned</span>}
                        </td>
                        <td className="px-3 py-2">
                          {eq.is_active !== false
                            ? <span className="text-[11px] font-bold text-emerald-300">Active</span>
                            : <span className="text-[11px] font-bold text-rose-300">Inactive</span>}
                        </td>
                        <td className="px-3 py-2 text-center text-slate-300">
                          {isRental && sr.monthly != null && sr.monthly !== 0 ? `OMR ${sr.monthly}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-center text-slate-300">
                          {cr.hourly != null && cr.hourly !== 0 ? `${cr.hourly}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-center text-slate-300">
                          {cr.daily != null && cr.daily !== 0 ? `${cr.daily}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-center text-slate-300">
                          {cr.weekly != null && cr.weekly !== 0 ? `${cr.weekly}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-center text-slate-300">
                          {cr.monthly != null && cr.monthly !== 0 ? `${cr.monthly}` : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => openEditMaster(eq)}
                            className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold px-2.5 py-1 transition"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardPanel>
        )}

        {/* Filters */}
        <CardPanel className="p-4 flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Filters</span>
          <select className={selectCls} value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)}>
            <option value="all">All Locations</option>
            {(dashboard.by_location || []).map((i) => <option key={i.name} value={i.name}>{i.name}</option>)}
          </select>
          <select className={selectCls} value={selectedType}
            onChange={(e) => { setSelectedType(e.target.value); setSelectedEquipmentId("all"); }}>
            <option value="all">All Types</option>
            {equipmentTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className={selectCls} value={selectedEquipmentId} onChange={(e) => setSelectedEquipmentId(e.target.value)}>
            <option value="all">All Equipment</option>
            {equipmentOptions.map((eq) => (
              <option key={eq._id} value={eq._id}>
                {eq.name}{eq.plate_number ? ` [${eq.plate_number}]` : ""}
              </option>
            ))}
          </select>
          <select className={selectCls} value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
            <option value="all">All periods</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
          <input type="date" className={inputCls} value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
        </CardPanel>

        {/* Selected Equipment Cost Card */}
        {selectedEqStats && (
          <CardPanel className="p-5 border-amber-400/20 bg-amber-500/5">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="text-xs text-amber-400 font-bold uppercase tracking-wider mb-1">Selected Equipment Cost Summary</div>
                <div className="text-lg font-black text-white">
                  {selectedEqStats.equipment_name}
                  {selectedEqStats.plate_number && (
                    <span className="ml-2 font-mono text-sm text-amber-300 bg-slate-800 border border-white/10 rounded px-2 py-0.5">
                      {selectedEqStats.plate_number}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{selectedEqStats.equipment_type} · {selectedEqStats.equipment_location}</div>
              </div>
              <div className="flex gap-4 flex-wrap">
                <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-center">
                  <div className="text-xl font-black text-amber-300">{selectedEqStats.entries}</div>
                  <div className="text-xs text-slate-400">Entries</div>
                </div>
                <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-center">
                  <div className="text-xl font-black text-sky-300">{selectedEqStats.total_hours} hrs</div>
                  <div className="text-xs text-slate-400">Total Hours</div>
                </div>
                {selectedEqStats.ownership === "rental" && (
                  <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-center">
                    <div className="text-xl font-black text-rose-300">OMR {selectedEqStats.rental_cost.toFixed(2)}</div>
                    <div className="text-xs text-slate-400">Total Rental Cost</div>
                  </div>
                )}
              </div>
            </div>
          </CardPanel>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard label="Total Equipment" value={summ.total_equipment ?? "-"} color="sky" />
          <StatCard label="Total Entries" value={summ.total_entries ?? 0} color="amber" />
          <StatCard label="ENCO Owned" value={summ.owned_entries ?? 0} color="emerald" />
          <StatCard label="Rental Entries" value={summ.rental_entries ?? 0} color="rose" />
          <StatCard
            label="Total Rental Cost"
            value={summ.total_rental_cost != null ? `OMR ${Number(summ.total_rental_cost).toFixed(2)}` : "-"}
            sub={summ.total_rental_hours != null ? `${summ.total_rental_hours} rental hrs` : ""}
            color="violet"
          />
        </div>

        {/* Analytics row: By Type + By Location */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* By Type */}
          <CardPanel className="p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">By Equipment Type</h3>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin">
                {(dashboard.by_type || []).map((item) => (
                  <div key={item.name}
                    className="flex items-center justify-between rounded-lg border border-white/8 bg-slate-900/50 px-3 py-2">
                    <span className="text-sm text-slate-300">{item.name}</span>
                    <div className="flex items-center gap-3 text-right">
                      <span className="text-xs text-slate-500">{item.total_hours}h</span>
                      {item.rental_cost > 0 && (
                        <span className="text-xs font-bold text-rose-300">OMR {item.rental_cost.toFixed(0)}</span>
                      )}
                      <span className="text-sm font-bold text-amber-300">{item.entries}</span>
                    </div>
                  </div>
                ))}
                {(dashboard.by_type || []).length === 0 && <div className="text-sm text-slate-500">No data</div>}
              </div>
              {(dashboard.by_type || []).length > 0 && (
                <div className="w-full md:w-44 h-44 shrink-0">
                  <Pie data={typeChart} options={pieOptions} />
                </div>
              )}
            </div>
          </CardPanel>

          {/* By Location */}
          <CardPanel className="p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">By Location</h3>
            <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
              {(dashboard.by_location || []).map((item) => (
                <div key={item.name}
                  className="flex items-center justify-between rounded-lg border border-white/8 bg-slate-900/50 px-3 py-2">
                  <span className="text-sm text-slate-300">{item.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{item.total_hours}h</span>
                    {item.rental_cost > 0 && (
                      <span className="text-xs font-bold text-rose-300">OMR {item.rental_cost.toFixed(0)}</span>
                    )}
                    <span className="text-sm font-bold text-sky-300">{item.entries}</span>
                  </div>
                </div>
              ))}
              {(dashboard.by_location || []).length === 0 && <div className="text-sm text-slate-500">No data</div>}
            </div>
          </CardPanel>
        </div>

        {/* Per-Equipment Cost Breakdown */}
        {(dashboard.by_equipment || []).filter((e) => e.ownership === "rental").length > 0 && (
          <CardPanel className="p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
              Rental Cost by Equipment
              <span className="ml-2 text-slate-600 font-normal normal-case tracking-normal text-[10px]">— Total cost per rental equipment</span>
            </h3>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[700px] text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-slate-950/40">
                    {["Equipment", "Plate", "Type", "Location", "Entries", "Total Hours", "Total Rental Cost (OMR)"].map((col) => (
                      <th key={col} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(dashboard.by_equipment || []).filter((e) => e.ownership === "rental").map((eq) => (
                    <tr key={eq.equipment_id}
                      className={`border-b border-white/5 hover:bg-white/3 transition cursor-pointer ${selectedEquipmentId === eq.equipment_id ? "bg-amber-500/10 border-l-2 border-amber-400/50" : ""}`}
                      onClick={() => setSelectedEquipmentId(selectedEquipmentId === eq.equipment_id ? "all" : eq.equipment_id)}>
                      <td className="px-3 py-2 font-semibold text-slate-100">{eq.equipment_name}</td>
                      <td className="px-3 py-2">
                        {eq.plate_number
                          ? <span className="font-mono bg-slate-800 border border-white/10 rounded px-1.5 py-0.5 text-amber-300">{eq.plate_number}</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-2 text-sky-300">{eq.equipment_type}</td>
                      <td className="px-3 py-2 text-slate-400">{eq.equipment_location}</td>
                      <td className="px-3 py-2 text-center text-amber-300 font-bold">{eq.entries}</td>
                      <td className="px-3 py-2 text-center text-slate-300">{eq.total_hours} hrs</td>
                      <td className="px-3 py-2 text-center">
                        <span className="font-black text-rose-300 text-sm">OMR {eq.rental_cost.toFixed(2)}</span>
                      </td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="border-t-2 border-white/20 bg-slate-950/40 font-bold">
                    <td className="px-3 py-2 text-white" colSpan={6}>Total Rental Cost</td>
                    <td className="px-3 py-2 text-center">
                      <span className="font-black text-rose-300 text-base">
                        OMR {(dashboard.by_equipment || [])
                          .filter((e) => e.ownership === "rental")
                          .reduce((s, e) => s + (e.rental_cost || 0), 0).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardPanel>
        )}

        {/* Trend: Weekly / Monthly */}
        <CardPanel className="p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Cost & Hours Trend</h3>
            <div className="flex gap-1">
              {["monthly", "weekly"].map((v) => (
                <button key={v} type="button" onClick={() => setTrendView(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    trendView === v ? "bg-amber-500 text-white" : "border border-white/20 text-slate-400 hover:text-white"
                  }`}>
                  {v === "monthly" ? "Monthly" : "Weekly"}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[600px] text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-slate-950/40">
                  <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-400">
                    {trendView === "monthly" ? "Month" : "Week"}
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold uppercase text-slate-400">Entries</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold uppercase text-slate-400">Total Hours</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold uppercase text-slate-400">Rental Cost (OMR)</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold uppercase text-slate-400">Cost Bar</th>
                </tr>
              </thead>
              <tbody>
                {trendData.map((row) => {
                  const key = trendView === "monthly" ? row.month : row.week;
                  const maxCost = Math.max(...trendData.map((r) => r.rental_cost), 1);
                  const barPct = Math.round((row.rental_cost / maxCost) * 100);
                  return (
                    <tr key={key} className="border-b border-white/5 hover:bg-white/3 transition">
                      <td className="px-3 py-2 text-slate-300 font-semibold whitespace-nowrap">{key}</td>
                      <td className="px-3 py-2 text-center text-amber-300 font-bold">{row.entries}</td>
                      <td className="px-3 py-2 text-center text-sky-300">{row.total_hours} hrs</td>
                      <td className="px-3 py-2 text-center">
                        {row.rental_cost > 0
                          ? <span className="font-bold text-rose-300">OMR {row.rental_cost.toFixed(2)}</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-2 w-32">
                        <div className="w-full bg-slate-800 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-rose-400/70 transition-all"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardPanel>

        {/* Equipment Entries Table */}
        <CardPanel>
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-base font-bold text-white">
              🚜 Equipment Entries
              {selectedEquipmentId !== "all" && selectedEqStats && (
                <span className="ml-2 text-sm text-amber-300 font-normal">
                  — {selectedEqStats.equipment_name}{selectedEqStats.plate_number ? ` [${selectedEqStats.plate_number}]` : ""}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {selectedEquipmentId !== "all" && (
                <button type="button" onClick={() => setSelectedEquipmentId("all")}
                  className="text-xs text-slate-400 hover:text-white border border-white/15 rounded-lg px-3 py-1 transition">
                  ✕ Clear filter
                </button>
              )}
              <span className="text-xs text-slate-500">{filteredEntries.length} records</span>
            </div>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[1600px] text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-slate-950/60">
                  {EQ_TABLE_COLS.map((col) => (
                    <th key={col} className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={EQ_TABLE_COLS.length} className="px-4 py-10 text-center text-slate-500 text-sm">
                      No equipment entries for the selected filters.
                    </td>
                  </tr>
                )}
                {filteredEntries.map((entry, idx) => {
                  const st = getApprovalState(entry);
                  const isEditing = editingEntry?._id === entry._id;
                  const supplyMonthly = entry.supply_rate?.monthly;
                  const contractHourly = entry.contract_rate?.hourly;
                  return (
                    <tr key={entry._id} className={`border-b border-white/5 hover:bg-white/3 transition ${ROW_BG[st]}`}>
                      <td className="px-2 py-2 text-slate-500">{idx + 1}</td>
                      <td className="px-2 py-2">
                        {isEditing
                          ? <input type="date" className={inlineInputCls} value={eqForm.work_date} onChange={(e) => setEqForm((p) => ({ ...p, work_date: e.target.value }))} />
                          : <span className="text-slate-300 whitespace-nowrap">{entry.work_date || "-"}</span>}
                      </td>
                      <td className="px-2 py-2">
                        {isEditing
                          ? <input type="text" className={inlineInputCls} value={eqForm.operator_name} onChange={(e) => setEqForm((p) => ({ ...p, operator_name: e.target.value }))} />
                          : (
                            <span className="inline-flex items-center gap-2 font-semibold text-slate-100 whitespace-nowrap">
                              <WorkerAvatar
                                name={entry.operator_name}
                                civilId={entry.civil_id}
                                profilePicture={entry.profile_picture}
                                sizeClass="w-7 h-7"
                              />
                              {entry.operator_name || "-"}
                            </span>
                          )}
                      </td>
                      <td className="px-2 py-2 text-slate-300">{entry.company_name || "-"}</td>
                      <td className="px-2 py-2 text-slate-100 font-medium whitespace-nowrap">{entry.equipment_name || "-"}</td>
                      <td className="px-2 py-2">
                        {entry.plate_number
                          ? <span className="font-mono bg-slate-800 border border-white/10 rounded px-1.5 py-0.5 text-amber-300">{entry.plate_number}</span>
                          : <span className="text-slate-600">-</span>}
                      </td>
                      <td className="px-2 py-2">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border text-sky-300 bg-sky-500/10 border-sky-400/20">
                          {entry.equipment_type || "-"}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        {entry.ownership === "owned"
                          ? <span className="text-[11px] font-bold text-emerald-300">ENCO</span>
                          : <span className="text-[11px] font-bold text-rose-300">Rental</span>}
                      </td>
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <select
                            className={`${inlineInputCls} cursor-pointer`}
                            value={eqForm.equipment_status || ""}
                            onChange={(e) => setEqForm((p) => ({ ...p, equipment_status: e.target.value }))}
                          >
                            <option value="">— select —</option>
                            {EQ_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          entry.equipment_status
                            ? <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                                entry.equipment_status === "Working" ? "text-emerald-300 bg-emerald-500/10 border-emerald-400/20" :
                                entry.equipment_status === "Under Maintenance" ? "text-amber-300 bg-amber-500/10 border-amber-400/20" :
                                entry.equipment_status === "Transporting" ? "text-sky-300 bg-sky-500/10 border-sky-400/20" :
                                entry.equipment_status === "Disassembly" ? "text-rose-300 bg-rose-500/10 border-rose-400/20" :
                                entry.equipment_status === "Assembly" ? "text-violet-300 bg-violet-500/10 border-violet-400/20" :
                                entry.equipment_status === "Inspection" ? "text-orange-300 bg-orange-500/10 border-orange-400/20" :
                                "text-slate-400 bg-slate-500/10 border-slate-400/20"
                              }`}>{entry.equipment_status}</span>
                            : <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {isEditing
                          ? <input type="text" className={inlineInputCls} value={eqForm.location} onChange={(e) => setEqForm((p) => ({ ...p, location: e.target.value }))} />
                          : <span className="text-slate-300">{entry.location || "-"}</span>}
                      </td>
                      <td className="px-2 py-2">
                        {isEditing
                          ? <input type="number" className={inlineInputCls} value={eqForm.hours} min="0" max="24" step="0.5" onChange={(e) => setEqForm((p) => ({ ...p, hours: e.target.value }))} />
                          : <span className="font-bold text-amber-300">{entry.hours ?? "-"}</span>}
                      </td>
                      <td className="px-2 py-2 text-slate-400 text-center">
                        {supplyMonthly != null && supplyMonthly !== 0 ? `OMR ${supplyMonthly}` : "-"}
                      </td>
                      <td className="px-2 py-2 text-slate-400 text-center">
                        {contractHourly != null && contractHourly !== 0 ? `OMR ${contractHourly}` : "-"}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {isEditing
                          ? <input type="number" className={inlineInputCls} value={eqForm.rental_amount} step="0.01" onChange={(e) => setEqForm((p) => ({ ...p, rental_amount: e.target.value }))} />
                          : entry.rental_amount != null
                            ? <span className="font-bold text-rose-300">OMR {Number(entry.rental_amount).toFixed(2)}</span>
                            : <span className="text-slate-600">-</span>}
                      </td>
                      <td className="px-2 py-2 max-w-[120px]">
                        {isEditing
                          ? <input type="text" className={inlineInputCls} value={eqForm.activity} onChange={(e) => setEqForm((p) => ({ ...p, activity: e.target.value }))} />
                          : <span className="text-slate-300 truncate block" title={entry.activity}>{entry.activity || "-"}</span>}
                      </td>
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <select
                            className={`${inlineInputCls} cursor-pointer`}
                            value={eqForm.approval_status}
                            onChange={(e) => setEqForm((p) => ({ ...p, approval_status: e.target.value }))}
                          >
                            <option value="">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        ) : (
                          <span className={STATUS_PILL[st]}>
                            {st === "approved" ? "✓" : st === "rejected" ? "✗" : "⏳"} {st}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {isEditing
                          ? <input type="text" className={inlineInputCls} value={eqForm.approved_by || ""} onChange={(e) => setEqForm((p) => ({ ...p, approved_by: e.target.value }))} />
                          : <span className="text-slate-300">{entry.approved_by || "-"}</span>}
                      </td>
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <input
                            type="text"
                            className={inlineInputCls}
                            placeholder="Required for rejected"
                            value={eqForm.rejection_reason || ""}
                            onChange={(e) => setEqForm((p) => ({ ...p, rejection_reason: e.target.value }))}
                          />
                        ) : (
                          entry.rejection_reason
                            ? <span title={entry.rejection_reason} className="text-rose-300 text-xs underline decoration-dotted cursor-help">
                                {entry.rejection_reason.length > 16 ? entry.rejection_reason.slice(0, 16) + "…" : entry.rejection_reason}
                              </span>
                            : <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {isEditing
                          ? <div className="flex gap-1.5">
                              <button type="button" onClick={saveEntryEdit}
                                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-1 transition">Save</button>
                              <button type="button" onClick={() => setEditingEntry(null)}
                                className="rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold px-2.5 py-1 transition">Cancel</button>
                            </div>
                          : <div className="flex gap-1.5">
                              <button type="button" onClick={() => openEditEntry(entry)}
                                className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold px-2.5 py-1 transition">Edit</button>
                              <button type="button" onClick={() => deleteEntry(entry._id)}
                                className="rounded-lg bg-rose-700/80 hover:bg-rose-600 text-white text-[11px] font-bold px-2.5 py-1 transition">Del</button>
                            </div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardPanel>
      </div>

      <ImageCropModal
        open={masterCropOpen}
        onClose={() => setMasterCropOpen(false)}
        aspect={4 / 3}
        title="Crop equipment photo"
        onConfirm={(dataUrl) => setMasterForm((p) => ({ ...p, equipment_picture: dataUrl }))}
      />
      <ImageCropModal
        open={newEquipCropOpen}
        onClose={() => setNewEquipCropOpen(false)}
        aspect={4 / 3}
        title="Crop equipment photo"
        onConfirm={(dataUrl) => setNewEquipment((p) => ({ ...p, equipment_picture: dataUrl }))}
      />

      </>}  {/* end overview sub-tab */}
    </>
  );
}

// ── Progress Tab ─────────────────────────────────────────────────────────────

const PROC_COLORS = {
  material_received:  "#38bdf8",   // sky blue
  material_unloading: "#a78bfa",   // lavender
  pre_assembly:       "#34d399",   // emerald
  erection:           "#fbbf24",   // amber
  alignment_torquing: "#f87171",   // rose
  painting_piping:    "#fb923c",   // orange
  final_inspection:   "#f472b6",   // pink  (was purple – too close to lavender)
};

const PROC_LABELS = {
  material_received:  "Material Received",
  material_unloading: "Material Unloading",
  pre_assembly:       "Pre-Assembly",
  erection:           "Erection",
  alignment_torquing: "Alignment & Torquing",
  painting_piping:    "Painting & Piping",
  final_inspection:   "Final Inspection",
};

const PROC_ICONS = {
  material_received:  "📦",
  material_unloading: "🏗️",
  pre_assembly:       "🔧",
  erection:           "🏛️",
  alignment_torquing: "🔩",
  painting_piping:    "🎨",
  final_inspection:   "✅",
};

const ALL_PROC = Object.keys(PROC_LABELS);
const WORK_PROC = ALL_PROC.slice(1); // excludes material_received

// ── Process Entry Form (used for each process type) ──────────────────────────
function ProcessEntryForm({ processType, itemTags, state, onSaved }) {
  const [form, setForm] = useState({
    item_tag: "", date: new Date().toISOString().slice(0, 10),
    tonnage: "", description: "", entered_by: state?.adminName || state?.civilId || "",
  });
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.item_tag) { alert("Select an Item Tag"); return; }
    if (form.tonnage === "") { alert("Enter tonnage"); return; }
    const auth = await promptManagementPassword(`add ${PROC_LABELS[processType]} entry`);
    if (auth.cancelled) return;
    if (auth.error) { alert(auth.error); return; }
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/management/progress-entries"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tonnage: Number(form.tonnage), process_type: processType, management_password: auth.password }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Unable to save"); return; }
      setLastSaved(`${form.tonnage} T for ${form.item_tag}`);
      setForm((p) => ({ ...p, item_tag: "", tonnage: "", description: "" }));
      if (onSaved) onSaved();
    } catch { alert("Unable to save"); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
        {/* Item Tag */}
        <div className="flex flex-col">
          <label className="text-[10px] text-slate-400 mb-1 uppercase tracking-wide font-semibold">Item Tag *</label>
          <input list={`tags-${processType}`} className={inputCls} value={form.item_tag}
            onChange={(e) => setForm((p) => ({ ...p, item_tag: e.target.value }))}
            placeholder="Select tag" required />
          <datalist id={`tags-${processType}`}>
            {itemTags.map((t) => <option key={t.tag} value={t.tag} />)}
          </datalist>
        </div>
        {/* Date */}
        <div className="flex flex-col">
          <label className="text-[10px] text-slate-400 mb-1 uppercase tracking-wide font-semibold">Date *</label>
          <input type="date" className={inputCls} value={form.date}
            onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} required />
        </div>
        {/* Tonnage */}
        <div className="flex flex-col">
          <label className="text-[10px] text-slate-400 mb-1 uppercase tracking-wide font-semibold">Tonnage (T) *</label>
          <input type="number" step="0.0001" className={inputCls} value={form.tonnage}
            onChange={(e) => setForm((p) => ({ ...p, tonnage: e.target.value }))}
            placeholder="0.0000" required />
        </div>
        {/* Description / Shipment */}
        <div className="flex flex-col lg:col-span-2">
          <label className="text-[10px] text-slate-400 mb-1 uppercase tracking-wide font-semibold">
            {processType === "material_received" ? "Shipment / Description" : "Remarks"}&nbsp;
            <span className="normal-case font-normal text-slate-500">(optional)</span>
          </label>
          <input className={inputCls} value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Optional" />
        </div>
        {/* Entered By */}
        <div className="flex flex-col">
          <label className="text-[10px] text-slate-400 mb-1 uppercase tracking-wide font-semibold">Entered By</label>
          <input className={inputCls} value={form.entered_by}
            onChange={(e) => setForm((p) => ({ ...p, entered_by: e.target.value }))} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving}
          className="rounded-xl text-white text-sm font-bold px-5 py-2.5 transition disabled:opacity-50"
          style={{ backgroundColor: PROC_COLORS[processType] + "cc" }}>
          {saving ? "Saving…" : `Add ${PROC_LABELS[processType]}`}
        </button>
        {lastSaved && (
          <span className="text-xs text-emerald-400 font-semibold">✓ Saved: {lastSaved}</span>
        )}
      </div>
    </form>
  );
}

function ProgressTab({ state }) {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [dashError, setDashError] = useState("");
  const [itemTags, setItemTags] = useState([]);
  const [activeProc, setActiveProc] = useState("material_received");
  const [procEntries, setProcEntries] = useState({});
  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [filterTag, setFilterTag] = useState("all");
  // Month-range filter for analytics charts
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");

  // ── Load dashboard data ────────────────────────────────────────────────────
  const loadDashboard = useCallback(async (fm, tm) => {
    setLoading(true);
    setDashError("");
    try {
      const params = new URLSearchParams();
      if (fm) params.set("from_month", fm);
      if (tm) params.set("to_month", tm);
      const qs = params.toString();
      const res = await fetch(apiUrl(`/api/management/progress-dashboard${qs ? "?" + qs : ""}`));
      const data = await res.json();
      if (data.ok) {
        setDashboard(data);
      } else {
        setDashError(data.error || "Failed to load dashboard");
      }
    } catch (err) {
      setDashError("Cannot reach server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadItemTags = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/progress/item-tags"));
      const data = await res.json();
      if (data.ok) setItemTags(data.item_tags || []);
    } catch { /* ignore */ }
  }, []);

  // Load entries for active process tab
  const loadProcEntries = useCallback(async (proc) => {
    try {
      const params = new URLSearchParams({ process_type: proc, include_baseline: "true" });
      if (filterTag !== "all") params.set("item_tag", filterTag);
      const res = await fetch(apiUrl(`/api/management/progress-entries?${params}`));
      const data = await res.json();
      if (data.ok) setProcEntries((prev) => ({ ...prev, [proc]: data.entries || [] }));
    } catch { /* ignore */ }
  }, [filterTag]);

  useEffect(() => { loadItemTags(); loadDashboard(fromMonth, toMonth); }, [loadItemTags, loadDashboard, fromMonth, toMonth]);
  useEffect(() => { loadProcEntries(activeProc); }, [activeProc, loadProcEntries]);

  // ── Entry inline edit ─────────────────────────────────────────────────────
  const startEdit = (row) => {
    setEditRow(row._id);
    setEditForm({ tonnage: row.tonnage, date: row.date, description: row.description || "", entered_by: row.entered_by || "" });
  };
  const cancelEdit = () => { setEditRow(null); setEditForm({}); };

  const saveEdit = async (row) => {
    const auth = await promptManagementPassword("save progress entry changes");
    if (auth.cancelled) return;
    if (auth.error) { alert(auth.error); return; }
    try {
      const res = await fetch(apiUrl(`/api/management/progress-entries/${row._id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, tonnage: Number(editForm.tonnage), management_password: auth.password }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Unable to save"); return; }
      cancelEdit();
      await Promise.all([loadDashboard(fromMonth, toMonth), loadProcEntries(activeProc)]);
    } catch { alert("Unable to save"); }
  };

  const deleteEntry = async (row) => {
    if (!window.confirm("Delete this entry?")) return;
    const auth = await promptManagementPassword("delete progress entry");
    if (auth.cancelled) return;
    if (auth.error) { alert(auth.error); return; }
    try {
      const res = await fetch(apiUrl(`/api/management/progress-entries/${row._id}`), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ management_password: auth.password }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Unable to delete"); return; }
      await Promise.all([loadDashboard(fromMonth, toMonth), loadProcEntries(activeProc)]);
    } catch { alert("Unable to delete"); }
  };

  // ── Chart data ─────────────────────────────────────────────────────────────
  const overallBarData = useMemo(() => {
    if (!dashboard?.item_tag_summary?.length) return null;
    const tags = dashboard.item_tag_summary.map((t) => t.tag);
    return {
      labels: tags,
      datasets: WORK_PROC.map((pt) => ({
        label: PROC_LABELS[pt],
        data: dashboard.item_tag_summary.map((t) => t.processes?.[pt]?.percent ?? 0),
        backgroundColor: PROC_COLORS[pt] + "bb",
        borderColor: PROC_COLORS[pt],
        borderWidth: 1,
      })),
    };
  }, [dashboard]);

  const prevVsThisData = useMemo(() => {
    if (!dashboard?.prev_vs_this) return null;
    const { prev_week, this_week, total } = dashboard.prev_vs_this;
    // Clamp per-week values to >= 0; corrections (negative entries) are accounted
    // for in the Total Cumulative bar but shouldn't make week bars go negative
    const clamp = (v) => Math.max(0, v ?? 0);
    return {
      labels: WORK_PROC.map((p) => PROC_LABELS[p]),
      datasets: [
        { label: "Prev Week",        data: WORK_PROC.map((p) => clamp(prev_week?.[p])), backgroundColor: "#64748b99", borderColor: "#64748b", borderWidth: 1 },
        { label: "This Week",        data: WORK_PROC.map((p) => clamp(this_week?.[p])), backgroundColor: "#38bdf8cc", borderColor: "#38bdf8", borderWidth: 1 },
        { label: "Total Cumulative", data: WORK_PROC.map((p) => clamp(total?.[p])),     backgroundColor: "#34d399bb", borderColor: "#34d399", borderWidth: 1 },
      ],
    };
  }, [dashboard]);

  const weeklyLineData = useMemo(() => {
    if (!dashboard?.weekly_trend?.length) return null;
    const wt = dashboard.weekly_trend;
    return {
      labels: wt.map((w) => w.week),
      datasets: WORK_PROC.map((pt) => ({
        label: PROC_LABELS[pt],
        data: wt.map((w) => w.by_process?.[pt] ?? 0),
        borderColor: PROC_COLORS[pt],
        backgroundColor: "transparent",
        tension: 0.3, pointRadius: 3, fill: false,
      })),
    };
  }, [dashboard]);

  const chartOpts = (yLabel) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { color: "#94a3b8", font: { size: 9 }, boxWidth: 10, padding: 8 } },
      tooltip: { backgroundColor: "#0f172a", titleColor: "#e2e8f0", bodyColor: "#94a3b8", padding: 8 },
      datalabels: { display: false },
    },
    scales: {
      x: { ticks: { color: "#64748b", font: { size: 8 } }, grid: { color: "#1e293b" } },
      y: { ticks: { color: "#64748b", font: { size: 9 } }, grid: { color: "#1e293b" },
           title: { display: !!yLabel, text: yLabel || "", color: "#64748b", font: { size: 9 } } },
    },
  });

  // ── Derived totals ─────────────────────────────────────────────────────────
  const totalGW = dashboard?.total_gross_weight ?? 0;
  const totalMR = dashboard?.grand_totals?.material_received?.tonnage ?? 0;
  const totalUnload = dashboard?.grand_totals?.material_unloading?.tonnage ?? 0;
  const totalPreAsm = dashboard?.grand_totals?.pre_assembly?.tonnage ?? 0;
  const totalErect  = dashboard?.grand_totals?.erection?.tonnage ?? 0;
  const totalAlign  = dashboard?.grand_totals?.alignment_torquing?.tonnage ?? 0;
  const totalPaint  = dashboard?.grand_totals?.painting_piping?.tonnage ?? 0;
  const totalFinal  = dashboard?.grand_totals?.final_inspection?.tonnage ?? 0;

  const currentEntries = procEntries[activeProc] || [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── Top summary strip ── */}
      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 className="text-sm font-black text-white uppercase tracking-wide mr-auto">📊 Structure Progress Tracker</h2>

          {/* Month-range filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Filter:</span>
            <div className="flex flex-col">
              <label className="text-[9px] text-slate-500 mb-0.5 uppercase">From</label>
              <input
                type="month"
                className="rounded-lg border border-white/15 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 focus:border-sky-400/60 focus:outline-none cursor-pointer"
                value={fromMonth}
                onChange={(e) => setFromMonth(e.target.value)}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[9px] text-slate-500 mb-0.5 uppercase">To</label>
              <input
                type="month"
                className="rounded-lg border border-white/15 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 focus:border-sky-400/60 focus:outline-none cursor-pointer"
                value={toMonth}
                onChange={(e) => setToMonth(e.target.value)}
              />
            </div>
            {(fromMonth || toMonth) && (
              <button type="button"
                onClick={() => { setFromMonth(""); setToMonth(""); }}
                className="rounded-lg border border-white/15 text-slate-400 hover:text-rose-300 text-[10px] font-bold px-2 py-1.5 transition self-end">
                Clear
              </button>
            )}
            <button type="button"
              onClick={() => loadDashboard(fromMonth, toMonth)}
              className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold px-3 py-1.5 transition self-end">
              {loading ? "Loading…" : "⟳ Apply"}
            </button>
          </div>
        </div>
        {(fromMonth || toMonth) && (
          <div className="mb-2 text-[10px] text-sky-400 font-semibold">
            Showing: {fromMonth ? fromMonth : "All"} → {toMonth ? toMonth : "Now"}
          </div>
        )}
        {dashError && (
          <div className="mb-3 rounded-lg bg-rose-500/10 border border-rose-400/20 px-3 py-2 text-xs text-rose-300">{dashError}</div>
        )}
        {/* Compact metric row */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {[
            ["Gross Wt", totalGW, "#94a3b8"],
            ["Mat. Received", totalMR, PROC_COLORS.material_received],
            ["Unloading", totalUnload, PROC_COLORS.material_unloading],
            ["Pre-Assembly", totalPreAsm, PROC_COLORS.pre_assembly],
            ["Erection", totalErect, PROC_COLORS.erection],
            ["Align & Torq", totalAlign, PROC_COLORS.alignment_torquing],
            ["Painting", totalPaint, PROC_COLORS.painting_piping],
            ["Final Insp.", totalFinal, PROC_COLORS.final_inspection],
          ].map(([label, val, color]) => (
            <div key={label} className="rounded-lg bg-slate-800/60 border border-white/8 p-2 text-center">
              <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color }}>{label}</div>
              <div className="text-sm font-black text-white">{Number(val).toFixed(1)}</div>
              <div className="text-[9px] text-slate-500">T</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Item Tag Progress Table ── */}
      <CardPanel>
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Item Tag Progress (Cumulative)</h3>
          {loading && <span className="text-xs text-slate-400 animate-pulse">Loading…</span>}
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[860px] text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-slate-950/60">
                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-400 sticky left-0 bg-slate-950/80">TAG</th>
                <th className="px-3 py-2 text-center text-[10px] font-bold uppercase text-slate-400">GW (T)</th>
                {ALL_PROC.map((pt) => (
                  <th key={pt} className="px-2 py-2 text-center text-[10px] font-bold uppercase whitespace-nowrap"
                    style={{ color: PROC_COLORS[pt] }}>
                    {pt === "material_received" ? "Mat.Recv" : pt === "material_unloading" ? "Unload"
                      : pt === "pre_assembly" ? "Pre-Asm" : pt === "erection" ? "Erect"
                      : pt === "alignment_torquing" ? "Align" : pt === "painting_piping" ? "Paint" : "Final"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!dashboard && !dashError && (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-500 animate-pulse text-xs">Loading progress data…</td></tr>
              )}
              {dashError && (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-rose-400 text-xs">{dashError}</td></tr>
              )}
              {dashboard && !(dashboard.item_tag_summary?.length) && (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-500 text-xs">No item tags found. Seed data first.</td></tr>
              )}
              {(dashboard?.item_tag_summary || []).map((row) => (
                <tr key={row.tag} className="border-b border-white/5 hover:bg-white/3 transition">
                  <td className="px-3 py-1.5 font-bold text-white sticky left-0 bg-slate-900/80 whitespace-nowrap text-xs">{row.tag}</td>
                  <td className="px-3 py-1.5 text-center text-slate-300 font-semibold">{row.gross_weight.toFixed(1)}</td>
                  {ALL_PROC.map((pt) => {
                    const p = row.processes?.[pt] || {};
                    const tn = p.tonnage ?? 0;
                    const pct = p.percent ?? 0;
                    return (
                      <td key={pt} className="px-2 py-1.5 text-center">
                        <div className="text-slate-200 font-semibold">{tn.toFixed(1)}</div>
                        {tn !== 0 && (
                          <div className="text-[9px] font-bold" style={{ color: PROC_COLORS[pt] }}>
                            {pct.toFixed(1)}%
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {dashboard?.grand_totals && (
              <tfoot>
                <tr className="border-t-2 border-white/20 bg-slate-950/70">
                  <td className="px-3 py-1.5 font-black text-white sticky left-0 bg-slate-950/80 text-xs">TOTAL</td>
                  <td className="px-3 py-1.5 text-center font-bold text-slate-200">{totalGW.toFixed(1)}</td>
                  {ALL_PROC.map((pt) => {
                    const gt = dashboard.grand_totals[pt] || {};
                    return (
                      <td key={pt} className="px-2 py-1.5 text-center">
                        <div className="font-black text-white">{(gt.tonnage ?? 0).toFixed(1)}</div>
                        <div className="text-[9px] font-bold" style={{ color: PROC_COLORS[pt] }}>{(gt.percent ?? 0).toFixed(1)}%</div>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </CardPanel>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CardPanel className="p-4">
          <h3 className="text-xs font-bold text-white mb-3">Overall Progress % by Item Tag</h3>
          <div className="h-52">
            {overallBarData ? (
              <Bar data={overallBarData} options={chartOpts("%")} />
            ) : <div className="h-full flex items-center justify-center text-slate-500 text-xs">{loading ? "Loading…" : "No data"}</div>}
          </div>
        </CardPanel>
        <CardPanel className="p-4">
          <h3 className="text-xs font-bold text-white mb-3">Prev Week · This Week · Total Cumulative (T)</h3>
          <div className="h-52">
            {prevVsThisData ? (
              <Bar data={prevVsThisData} options={chartOpts("Tonnes")} />
            ) : <div className="h-full flex items-center justify-center text-slate-500 text-xs">{loading ? "Loading…" : "No data"}</div>}
          </div>
        </CardPanel>
      </div>

      <CardPanel className="p-4">
        <h3 className="text-xs font-bold text-white mb-3">Weekly Tonnage Trend – Last 8 Weeks</h3>
        <div className="h-48">
          {weeklyLineData ? (
            <Line data={weeklyLineData} options={chartOpts("Tonnes")} />
          ) : <div className="h-full flex items-center justify-center text-slate-500 text-xs">{loading ? "Loading…" : "No data"}</div>}
        </div>
      </CardPanel>

      {/* ── Process Entry Tabs ── */}
      <CardPanel>
        <div className="border-b border-white/10">
          <div className="flex overflow-x-auto scrollbar-thin">
            {ALL_PROC.map((pt) => (
              <button key={pt} type="button" onClick={() => setActiveProc(pt)}
                className={`flex items-center gap-1 px-3 py-2.5 text-[11px] font-bold whitespace-nowrap border-b-2 transition ${
                  activeProc === pt ? "border-current" : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
                style={activeProc === pt ? { color: PROC_COLORS[pt], borderColor: PROC_COLORS[pt] } : {}}>
                <span>{PROC_ICONS[pt]}</span> {PROC_LABELS[pt]}
              </button>
            ))}
          </div>
        </div>

        {/* Active process summary (cumulative for this process) */}
        <div className="p-4 border-b border-white/10">
          <div className="flex flex-wrap gap-3 mb-4">
            {(dashboard?.item_tag_summary || []).filter((t) => (t.processes?.[activeProc]?.tonnage ?? 0) !== 0).map((t) => (
              <div key={t.tag} className="rounded-lg border px-3 py-2 text-center min-w-[90px]"
                style={{ borderColor: PROC_COLORS[activeProc] + "40", background: PROC_COLORS[activeProc] + "11" }}>
                <div className="text-[10px] font-bold text-slate-300">{t.tag}</div>
                <div className="text-sm font-black" style={{ color: PROC_COLORS[activeProc] }}>
                  {(t.processes[activeProc].tonnage).toFixed(2)} T
                </div>
                <div className="text-[10px] text-slate-500">{(t.processes[activeProc].percent).toFixed(1)}%</div>
              </div>
            ))}
            {dashboard && !(dashboard.item_tag_summary || []).some((t) => (t.processes?.[activeProc]?.tonnage ?? 0) !== 0) && (
              <span className="text-xs text-slate-500 italic">No entries yet for {PROC_LABELS[activeProc]}</span>
            )}
          </div>

          {/* Entry form */}
          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
            <h4 className="text-xs font-bold mb-3" style={{ color: PROC_COLORS[activeProc] }}>
              {PROC_ICONS[activeProc]} Add {PROC_LABELS[activeProc]} Entry
            </h4>
            <ProcessEntryForm
              processType={activeProc}
              itemTags={itemTags}
              state={state}
              onSaved={() => { loadDashboard(fromMonth, toMonth); loadProcEntries(activeProc); }}
            />
          </div>
        </div>

        {/* Entries filter and table for this process */}
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Filter by Tag:</span>
            <select className={selectCls + " text-xs py-1"} value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}>
              <option value="all">All Tags</option>
              {itemTags.map((t) => <option key={t.tag} value={t.tag}>{t.tag}</option>)}
            </select>
            <button type="button" onClick={() => loadProcEntries(activeProc)}
              className="rounded-lg border border-white/20 text-slate-400 hover:text-white text-[10px] font-bold px-2 py-1 transition">
              Reload
            </button>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-xs border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-white/10 bg-slate-950/60">
                  {["Date", "Item Tag", "Tonnage (T)", "Description", "Entered By", "Baseline", "Actions"].map((c) => (
                    <th key={c} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentEntries.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500 text-xs">No entries for {PROC_LABELS[activeProc]}.</td></tr>
                )}
                {currentEntries.map((row) => (
                  <tr key={row._id} className={`border-b border-white/5 hover:bg-white/3 transition ${row.is_baseline ? "opacity-60" : ""}`}>
                    <td className="px-3 py-1.5 text-slate-300 whitespace-nowrap">
                      {editRow === row._id
                        ? <input type="date" className={inlineInputCls} value={editForm.date} onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))} />
                        : row.date || "-"}
                    </td>
                    <td className="px-3 py-1.5 font-bold text-white">{row.item_tag}</td>
                    <td className="px-3 py-1.5 font-semibold" style={{ color: PROC_COLORS[activeProc] }}>
                      {editRow === row._id
                        ? <input type="number" step="0.0001" className={inlineInputCls} value={editForm.tonnage} onChange={(e) => setEditForm((p) => ({ ...p, tonnage: e.target.value }))} />
                        : `${Number(row.tonnage ?? 0).toFixed(4)} T`}
                    </td>
                    <td className="px-3 py-1.5 text-slate-400 max-w-[180px] truncate">
                      {editRow === row._id
                        ? <input className={inlineInputCls} value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} />
                        : row.description || "-"}
                    </td>
                    <td className="px-3 py-1.5 text-slate-400">
                      {editRow === row._id
                        ? <input className={inlineInputCls} value={editForm.entered_by} onChange={(e) => setEditForm((p) => ({ ...p, entered_by: e.target.value }))} />
                        : row.entered_by || "-"}
                    </td>
                    <td className="px-3 py-1.5">
                      {row.is_baseline && <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 py-0.5 rounded">Base</span>}
                    </td>
                    <td className="px-3 py-1.5">
                      {editRow === row._id ? (
                        <div className="flex gap-1">
                          <button type="button" onClick={() => saveEdit(row)}
                            className="rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-2 py-1">Save</button>
                          <button type="button" onClick={cancelEdit}
                            className="rounded border border-white/20 text-slate-400 text-[10px] font-bold px-2 py-1">✕</button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button type="button" onClick={() => startEdit(row)}
                            className="rounded bg-sky-700 hover:bg-sky-600 text-white text-[10px] font-bold px-2 py-1">Edit</button>
                          <button type="button" onClick={() => deleteEntry(row)}
                            className="rounded bg-rose-800 hover:bg-rose-700 text-white text-[10px] font-bold px-2 py-1">Del</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardPanel>
    </div>
  );
}

// ── Equipment Tracking Tab ─────────────────────────────────────────────────────
const EQ_STATUS_META = {
  "Working":           { color: "#34d399", bg: "bg-emerald-500/15 border-emerald-400/30 text-emerald-300", dot: "bg-emerald-400" },
  "Under Maintenance": { color: "#fbbf24", bg: "bg-amber-500/15 border-amber-400/30 text-amber-300",   dot: "bg-amber-400"   },
  "Transporting":      { color: "#38bdf8", bg: "bg-sky-500/15 border-sky-400/30 text-sky-300",         dot: "bg-sky-400"     },
  "Disassembly":       { color: "#f87171", bg: "bg-rose-500/15 border-rose-400/30 text-rose-300",      dot: "bg-rose-400"    },
  "Assembly":          { color: "#a78bfa", bg: "bg-violet-500/15 border-violet-400/30 text-violet-300",dot: "bg-violet-400"  },
  "Inspection":        { color: "#fb923c", bg: "bg-orange-500/15 border-orange-400/30 text-orange-300",dot: "bg-orange-400"  },
  "Expired":           { color: "#94a3b8", bg: "bg-slate-500/15 border-slate-400/30 text-slate-400",   dot: "bg-slate-400"   },
  "Unknown":           { color: "#64748b", bg: "bg-slate-600/15 border-slate-500/30 text-slate-400",   dot: "bg-slate-500"   },
  "No Entry":          { color: "#475569", bg: "bg-slate-700/15 border-slate-600/30 text-slate-500",   dot: "bg-slate-600"   },
};

function StatusBadge({ status }) {
  const meta = EQ_STATUS_META[status] || EQ_STATUS_META["Unknown"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${meta.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {status || "—"}
    </span>
  );
}

function EquipmentTrackingTab() {
  const [data, setData] = useState({ equipment: [], status_summary: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/management/equipment-tracking"));
      const json = await res.json();
      if (json.ok) setData(json);
      else setError(json.error || "Failed to load tracking data");
    } catch (e) {
      setError("Unable to reach server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const allTypes = useMemo(() => {
    const s = new Set(data.equipment.map((e) => e.equipment_type).filter(Boolean));
    return [...s].sort();
  }, [data.equipment]);

  const filtered = useMemo(() => {
    return data.equipment.filter((eq) => {
      const matchSearch =
        !searchTerm ||
        eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (eq.plate_number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (eq.current_location || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus =
        filterStatus === "all" || (eq.current_status || "No Entry") === filterStatus;
      const matchType =
        filterType === "all" || eq.equipment_type === filterType;
      return matchSearch && matchStatus && matchType;
    });
  }, [data.equipment, searchTerm, filterStatus, filterType]);

  const statusSummary = data.status_summary || {};
  const statusKeys = Object.keys(EQ_STATUS_META).filter(
    (k) => k !== "Unknown" && k !== "No Entry"
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xl font-black text-white">Equipment Tracking</h2>
          <p className="text-slate-400 text-sm">Real-time status, location &amp; hours for all equipment</p>
        </div>
        <button
          onClick={load}
          className="ml-auto rounded-xl border border-white/15 hover:border-sky-400/40 text-slate-400 hover:text-sky-300 text-xs font-bold px-4 py-2 transition"
        >
          ⟳ Refresh
        </button>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {statusKeys.map((st) => {
          const meta = EQ_STATUS_META[st];
          const count = statusSummary[st] || 0;
          return (
            <button
              key={st}
              onClick={() => setFilterStatus(filterStatus === st ? "all" : st)}
              className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                filterStatus === st
                  ? `${meta.bg} ring-1 ring-current`
                  : "border-white/10 bg-slate-900/60 hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{st}</span>
              </div>
              <div className="text-2xl font-black" style={{ color: meta.color }}>{count}</div>
            </button>
          );
        })}
        {(statusSummary["No Entry"] || 0) > 0 && (
          <button
            onClick={() => setFilterStatus(filterStatus === "No Entry" ? "all" : "No Entry")}
            className={`rounded-xl border p-3 text-left transition ${
              filterStatus === "No Entry"
                ? "bg-slate-600/15 border-slate-400/30 ring-1 ring-slate-400"
                : "border-white/10 bg-slate-900/60 hover:border-white/20"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-slate-600" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">No Entry</span>
            </div>
            <div className="text-2xl font-black text-slate-500">{statusSummary["No Entry"]}</div>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search equipment, plate, location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="rounded-xl border border-white/15 bg-slate-900/80 px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-400/60 focus:outline-none w-64"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/60 focus:outline-none cursor-pointer"
        >
          <option value="all">All Types</option>
          {allTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {(filterStatus !== "all" || filterType !== "all" || searchTerm) && (
          <button
            onClick={() => { setFilterStatus("all"); setFilterType("all"); setSearchTerm(""); }}
            className="rounded-xl border border-rose-400/30 text-rose-400 text-xs font-bold px-4 py-2 hover:bg-rose-500/10 transition"
          >
            ✕ Clear Filters
          </button>
        )}
        <span className="ml-auto text-xs text-slate-500 self-center">{filtered.length} equipment</span>
      </div>

      {loading && (
        <div className="text-center py-12 text-slate-400 text-sm animate-pulse">Loading tracking data…</div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}

      {/* Equipment Table */}
      {!loading && !error && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                {["Equipment", "Type", "Plate", "Current Status", "Current Location", "Last Entry", "Total Hours", "Entries", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-slate-500 text-sm">No equipment found</td></tr>
              )}
              {filtered.map((eq) => (
                <>
                  <tr
                    key={eq._id}
                    className={`border-b border-white/5 hover:bg-white/5 cursor-pointer transition ${expanded === eq._id ? "bg-white/5" : ""}`}
                    onClick={() => setExpanded(expanded === eq._id ? null : eq._id)}
                  >
                    <td className="px-4 py-3 font-semibold text-white">{eq.name}</td>
                    <td className="px-4 py-3 text-slate-400">{eq.equipment_type}</td>
                    <td className="px-4 py-3 font-mono text-amber-300 text-xs">{eq.plate_number || "—"}</td>
                    <td className="px-4 py-3">
                      {eq.current_status ? <StatusBadge status={eq.current_status} /> : <span className="text-slate-500 text-xs">No entry yet</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{eq.current_location || <span className="text-slate-500">—</span>}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{eq.last_date || "—"}</td>
                    <td className="px-4 py-3 text-sky-300 font-bold">{eq.total_hours ? `${eq.total_hours} h` : "0 h"}</td>
                    <td className="px-4 py-3 text-slate-400">{eq.entry_count}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{expanded === eq._id ? "▲" : "▼"}</td>
                  </tr>
                  {expanded === eq._id && (
                    <tr key={`${eq._id}-exp`} className="border-b border-white/10 bg-slate-950/60">
                      <td colSpan={9} className="px-6 py-5">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* Hours by Location */}
                          <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">📍 Hours by Location</div>
                            {Object.keys(eq.hours_by_location).length === 0 ? (
                              <div className="text-slate-500 text-xs">No data</div>
                            ) : (
                              <div className="space-y-2">
                                {Object.entries(eq.hours_by_location)
                                  .sort((a, b) => b[1] - a[1])
                                  .map(([loc, hrs]) => {
                                    const maxH = Math.max(...Object.values(eq.hours_by_location));
                                    const pct = maxH > 0 ? Math.round((hrs / maxH) * 100) : 0;
                                    return (
                                      <div key={loc}>
                                        <div className="flex justify-between text-xs mb-1">
                                          <span className="text-slate-300">{loc}</span>
                                          <span className="text-sky-300 font-bold">{hrs} h</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-slate-800">
                                          <div className="h-full rounded-full bg-sky-400/70" style={{ width: `${pct}%` }} />
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>

                          {/* Hours / Count by Status */}
                          <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">🔧 Status Breakdown</div>
                            {Object.keys(eq.hours_by_status).length === 0 ? (
                              <div className="text-slate-500 text-xs">No data</div>
                            ) : (
                              <div className="space-y-2">
                                {Object.entries(eq.hours_by_status)
                                  .sort((a, b) => b[1] - a[1])
                                  .map(([st, hrs]) => {
                                    const cnt = eq.count_by_status[st] || 0;
                                    return (
                                      <div key={st} className="flex items-center justify-between gap-2">
                                        <StatusBadge status={st} />
                                        <div className="text-right text-xs">
                                          <span className="text-white font-bold">{hrs} h</span>
                                          <span className="text-slate-500 ml-1">({cnt} {cnt === 1 ? "entry" : "entries"})</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>

                          {/* Recent History */}
                          <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">📋 Recent History</div>
                            {eq.history.length === 0 ? (
                              <div className="text-slate-500 text-xs">No entries yet</div>
                            ) : (
                              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                {eq.history.map((h) => (
                                  <div key={h.entry_id} className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <span className="text-xs font-bold text-white">{h.work_date}</span>
                                      <StatusBadge status={h.equipment_status || "Unknown"} />
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-400">
                                      <span>📍 {h.location || "—"}</span>
                                      <span>⏱ {h.hours != null ? `${h.hours} h` : "—"}</span>
                                      {h.operator_name && (
                                        <span className="inline-flex items-center gap-1.5">
                                          <WorkerAvatar
                                            name={h.operator_name}
                                            civilId={h.civil_id}
                                            profilePicture={h.profile_picture}
                                            sizeClass="w-5 h-5"
                                            textClass="text-[9px]"
                                          />
                                          {h.operator_name}
                                        </span>
                                      )}
                                    </div>
                                    {h.activity && (
                                      <div className="mt-1 text-xs text-slate-500 italic truncate">{h.activity}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main ManagementView ────────────────────────────────────────────────────────
function ManagementView() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("manpower");

  const tabs = [
    { id: "manpower",  label: "👷 Manpower" },
    { id: "equipment", label: "🚜 Equipment" },
    { id: "progress",  label: "📈 Progress Update" },
  ];

  return (
    <div className="min-h-screen min-h-[100dvh] w-full font-sans text-white mobile-bg-attachment-scroll" style={BG}>

      {/* ── Top bar ── */}
      <header className="w-full sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
        <div className="flex items-center gap-3 px-4 md:px-8 min-h-14 flex-wrap">
          <img src="/Logo - Copy.png" alt="Encogroup" className="h-9 w-auto object-contain shrink-0" />
          <div className="border-l border-white/10 pl-3">
            <div className="text-sm font-bold text-white">Management View</div>
            <div className="text-xs text-slate-400">
              {state?.adminName || state?.civilId || "Management"} · {state?.loginTime || ""}
            </div>
          </div>
          <div className="ml-auto">
            <Link to="/" className="rounded-xl border border-white/20 hover:border-rose-400/50 text-slate-300 hover:text-rose-300 text-xs font-bold px-3 py-2 transition no-underline">
              Logout
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 md:px-8 border-t border-white/10 overflow-x-auto scrollbar-thin flex-nowrap">
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
        {activeTab === "manpower"  && <ManpowerTab state={state} navigate={navigate} />}
        {activeTab === "equipment" && <EquipmentTab />}
        {activeTab === "progress"  && <ProgressTab state={state} />}
      </div>
    </div>
  );
}

export default ManagementView;
