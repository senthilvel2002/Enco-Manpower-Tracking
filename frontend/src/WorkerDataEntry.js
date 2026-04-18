import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiUrl } from "./api";
import LoadingOverlay from "./LoadingOverlay";
import WorkerAvatar from "./WorkerAvatar";
import ImageCropModal from "./ImageCropModal";
import TimePicker from "./TimePicker";

const SPECIAL_ACTIVITY_NO_LOCATION = ["VISA", "Medical", "Medical Leave", "Personal Work"];

const BG = {
  backgroundImage: `linear-gradient(rgba(2,6,23,0.80), rgba(2,6,23,0.93)), url(/sohar-oman.jpg)`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
};

const inputCls =
  "w-full rounded-xl border border-white/15 bg-slate-900/80 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/20 transition";
const selectCls =
  "w-full rounded-xl border border-white/15 bg-slate-900/80 px-4 py-2.5 text-sm text-slate-100 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5";

function WorkerDataEntry() {
  const { state } = useLocation();
  const profileMenuRef = useRef(null);
  const [locations, setLocations] = useState([]);
  const [incharges, setIncharges] = useState([]);
  const [permitIssuers, setPermitIssuers] = useState([]);
  const [itemTags, setItemTags] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [profilePicture, setProfilePicture] = useState(state?.workerProfile?.profile_picture || "");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [workerPanel, setWorkerPanel] = useState(null); // 'profile' | 'attendance' | 'settings'
  const [myEntries, setMyEntries] = useState([]);
  const [myEntriesLoading, setMyEntriesLoading] = useState(false);
  const [profileSaveMsg, setProfileSaveMsg] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileCropOpen, setProfileCropOpen] = useState(false);
  const [form, setForm] = useState({
    civilId: state?.civilId || "",
    companyName: state?.companyName || state?.workerProfile?.company_name || "",
    workerName: state?.workerProfile?.name || "",
    designation: state?.workerProfile?.designation || "",
    workDate: new Date().toISOString().slice(0, 10),
    todayActivity: "",
    timeFrom: "",
    timeTo: "",
    location: "",
    incharge: "",
    permitIssuer: "",
    workerShift: "Day",
    leaveReason: "",
    itemTag: "",
  });
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityQuery, setActivityQuery] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const runWithLoading = useCallback(async (fn) => {
    setPendingCount((c) => c + 1);
    try { return await fn(); }
    finally { setPendingCount((c) => Math.max(0, c - 1)); }
  }, []);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await runWithLoading(() => fetch(apiUrl("/api/master-data/options")));
        const data = await res.json();
        if (data.ok) {
          setLocations(data.locations || []);
          setPermitIssuers(data.permit_issuer || []);
        }
      } catch (e) { console.error(e); }
    };
    fetchOptions();
  }, [runWithLoading]);

  useEffect(() => {
    const fetchItemTags = async () => {
      try {
        const res = await fetch(apiUrl("/api/progress/item-tags"));
        const data = await res.json();
        if (data.ok) setItemTags(data.item_tags || []);
      } catch { /* optional field, ignore */ }
    };
    fetchItemTags();
  }, []);

  useEffect(() => {
    const onDoc = (e) => {
      if (!profileMenuOpen) return;
      const el = profileMenuRef.current;
      if (el && !el.contains(e.target)) setProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [profileMenuOpen]);

  useEffect(() => {
    const cid = form.civilId;
    if (!cid) return;
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/worker/self?civil_id=${encodeURIComponent(cid)}`));
        const data = await res.json();
        if (data.ok && data.worker_profile?.profile_picture != null) {
          setProfilePicture(data.worker_profile.profile_picture || "");
        }
      } catch { /* keep route state */ }
    })();
  }, [form.civilId]);

  const loadMyEntries = useCallback(async () => {
    if (!form.civilId) return;
    setMyEntriesLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/worker/my-entries?civil_id=${encodeURIComponent(form.civilId)}&limit=40`));
      const data = await res.json();
      if (data.ok) setMyEntries(data.entries || []);
      else setMyEntries([]);
    } catch {
      setMyEntries([]);
    } finally {
      setMyEntriesLoading(false);
    }
  }, [form.civilId]);

  useEffect(() => {
    if (workerPanel === "attendance") loadMyEntries();
  }, [workerPanel, loadMyEntries]);

  useEffect(() => {
    const loadIncharge = async () => {
      if (!form.location) { setIncharges([]); return; }
      try {
        const params = new URLSearchParams({ location: form.location });
        const res = await runWithLoading(() => fetch(apiUrl(`/api/master-data/options?${params}`)));
        const data = await res.json();
        if (data.ok) setIncharges(data.incharge || []);
      } catch (e) { console.error(e); }
    };
    loadIncharge();
  }, [form.location, runWithLoading]);

  const handleChange = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const isOfficeLocation = form.location === "Head Office" || form.location === "Laydown Office";
  const specialActivityNoLocation = SPECIAL_ACTIVITY_NO_LOCATION;
  const isNoLocationActivity = specialActivityNoLocation.includes(form.todayActivity);
  const isLeaveRequest = form.workerShift === "Request for leave";
  const permitIssuerDisabled = form.location === "Head Office" || form.location === "Laydown Office";

  const activityOptions = useMemo(() => {
    if (isOfficeLocation) return ["Office Work", ...specialActivityNoLocation];
    return [
      ...specialActivityNoLocation,
      "Ground pre-assembly", "Structure pre-assembly", "Foundation surface cleaning",
      "Pipe rack support installation", "Cable tray support installation",
      "Instrument support installation", "Surface cleaning", "Final inspection",
      "Trial fit-up", "Structure assembly", "Formwork installation", "Pipe erection",
      "Cable tray installation", "Instrument mounting", "Surface inspection",
      "Dimensional survey", "Temporary bolting", "Dismantling", "Grout mixing",
      "Fit-up", "Cable pulling", "Tubing installation", "Touch-up painting",
      "Punch list clearance", "Column erection", "Grout pouring", "Welding",
      "Cable termination", "Hook-up works", "Final painting", "As-built documentation",
      "Beam erection", "Grout curing", "NDT inspection", "Electrical testing",
      "Loop checking", "DFT inspection", "Area handover", "Platform installation",
      "Pipe alignment", "Dismantling of electrical cable", "Dismantling of junction box",
      "Ladder & handrail installation", "Dismantling of cable rack",
      "Alignment (vertical & horizontal)", "Shim installation", "Final bolting",
      "Torque tightening", "Bolt marking", "Dismantling of cover",
      "Dismantling of structure", "Equipment maintenance", "Diesel filling",
    ];
  }, [isOfficeLocation, specialActivityNoLocation]);

  const filteredActivities = useMemo(() => {
    const q = activityQuery.trim().toLowerCase();
    if (!q) return activityOptions;
    return activityOptions.filter((a) => a.toLowerCase().includes(q));
  }, [activityOptions, activityQuery]);

  const calcHours = useMemo(() => {
    if (!form.timeFrom || !form.timeTo) return null;
    const toMin = (t) => { const [h, m] = t.split(":").map(Number); return isNaN(h) || isNaN(m) ? null : h * 60 + m; };
    const s = toMin(form.timeFrom), e = toMin(form.timeTo);
    if (s === null || e === null) return null;
    const diff = (e - s) / 60;
    return diff <= 0 ? null : Number(diff.toFixed(2));
  }, [form.timeFrom, form.timeTo]);

  const timeError = useMemo(() => {
    if (!form.timeFrom && !form.timeTo) return "Select From and To time";
    if (!form.timeFrom || !form.timeTo) return "Select both From and To time";
    if (calcHours === null) return "To time must be after From time";
    if (calcHours > 12) return "Maximum 12 hours per day";
    return "";
  }, [form.timeFrom, form.timeTo, calcHours]);

  const leaveReasonError = isLeaveRequest && !form.leaveReason.trim();
  const activityError = !form.todayActivity.trim();
  const submitDisabled = isLeaveRequest
    ? leaveReasonError || activityError
    : !!(timeError) || activityError;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    if (!isLeaveRequest && timeError) { setSubmitError(timeError); return; }
    if (isLeaveRequest && !form.leaveReason.trim()) { setSubmitError("Leave reason is required"); return; }
    if (!form.todayActivity.trim()) { setSubmitError("Main Activity is required"); return; }
    try {
      const res = await runWithLoading(() => fetch(apiUrl("/api/work-entries"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          civil_id: form.civilId,
          company_name: form.companyName,
          worker_name: form.workerName,
          work_date: form.workDate,
          today_activity: form.todayActivity,
          worker_time_from: isLeaveRequest ? "" : form.timeFrom,
          worker_time_to: isLeaveRequest ? "" : form.timeTo,
          location: form.location,
          incharge: form.incharge,
          permit_issuer: form.permitIssuer,
          worker_shift: form.workerShift,
          leave_reason: isLeaveRequest ? form.leaveReason.trim() : "",
          item_tag: form.itemTag || "",
        }),
      }));
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "duplicate_timing") {
          setSubmitError("⚠️ You already have an entry with the same timing today. Please choose a different time.");
          return;
        }
        setSubmitError(data.error || "Failed to submit entry");
        return;
      }
      setSubmitSuccess(true);
      setSubmitError("");
      setForm((p) => ({
        ...p, todayActivity: "", timeFrom: "", timeTo: "",
        location: "", incharge: "", permitIssuer: "", workerShift: "Day", leaveReason: "", itemTag: "",
      }));
      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch { alert("Unable to submit now"); }
  };

  const saveProfileDataUrl = async (dataUrl) => {
    if (!form.civilId) return;
    setProfileSaving(true);
    setProfileSaveMsg("");
    try {
      const res = await fetch(apiUrl("/api/worker/self/profile-picture"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ civil_id: form.civilId, profile_picture: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setProfilePicture(data.profile_picture || "");
      setProfileSaveMsg("Photo saved.");
    } catch (err) {
      setProfileSaveMsg(err.message || "Could not save photo.");
    } finally {
      setProfileSaving(false);
    }
  };

  const clearProfilePhoto = async () => {
    if (!form.civilId) return;
    setProfileSaving(true);
    setProfileSaveMsg("");
    try {
      const res = await fetch(apiUrl("/api/worker/self/profile-picture"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ civil_id: form.civilId, profile_picture: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Remove failed");
      setProfilePicture("");
      setProfileSaveMsg("Photo removed.");
    } catch (err) {
      setProfileSaveMsg(err.message || "Could not remove photo.");
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] w-full font-sans text-white mobile-bg-attachment-scroll" style={BG}>
      <LoadingOverlay show={pendingCount > 0} message="Loading data..." />

      {/* Top bar */}
      <header className="w-full sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
        <div className="flex items-center gap-4 px-4 sm:px-5 md:px-8 min-h-14">
          <Link to="/" className="flex items-center gap-3 no-underline shrink-0">
            <img src="/Logo - Copy.png" alt="Encogroup" className="h-9 w-auto object-contain" />
            <div className="hidden sm:block leading-none">
              <div className="text-white text-xs font-extrabold uppercase tracking-widest">Encogroup</div>
              <div className="text-slate-400 text-[10px] tracking-wider">Manpower Tracking</div>
            </div>
          </Link>
          <div className="border-l border-white/10 pl-4 ml-2 min-w-0 hidden sm:block">
            <div className="text-sm font-bold text-white">Daily Login</div>
            <div className="text-xs text-slate-400">{form.workDate}</div>
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-xl border border-white/15 bg-slate-900/50 px-2 py-1.5 sm:pr-3 hover:border-sky-400/40 transition"
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
              >
                <WorkerAvatar
                  name={form.workerName}
                  civilId={form.civilId}
                  profilePicture={profilePicture}
                  sizeClass="w-9 h-9"
                  textClass="text-sm font-bold"
                />
                <span className="text-sm font-semibold text-white max-w-[120px] sm:max-w-[160px] truncate hidden sm:inline">
                  {form.workerName || "Worker"}
                </span>
                <span className="text-slate-400 text-[10px] sm:text-xs" aria-hidden>▾</span>
              </button>
              {profileMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-white/15 bg-slate-900/95 backdrop-blur-xl shadow-2xl py-1 z-[60]"
                  role="menu"
                >
                  {[
                    { id: "profile", label: "Profile" },
                    { id: "attendance", label: "Attendance" },
                    { id: "settings", label: "Settings" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="menuitem"
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-sky-500/15 hover:text-white transition"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        if (opt.id === "profile") setProfileSaveMsg("");
                        setWorkerPanel(opt.id);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Link
              to="/"
              className="rounded-xl border border-white/20 hover:border-rose-400/50 text-slate-300 hover:text-rose-300 text-xs font-bold px-3 sm:px-4 py-2 transition no-underline"
            >
              Logout
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row min-h-[calc(100dvh-4rem)] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
        {/* Sidebar */}
        <aside className="lg:w-72 xl:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 bg-slate-950/60 backdrop-blur-lg p-6 flex flex-col gap-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <WorkerAvatar
              name={form.workerName}
              civilId={form.civilId}
              profilePicture={profilePicture}
              sizeClass="w-14 h-14"
              textClass="text-2xl font-black"
              rounded="xl"
            />
            <div>
              <div className="text-base font-bold text-white">{form.workerName || "-"}</div>
              <div className="text-xs text-slate-400 mt-0.5">{form.designation || "-"}</div>
            </div>
          </div>

          {/* Worker info */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
            {[
              { label: "Civil ID", value: form.civilId },
              { label: "Company", value: form.companyName },
              { label: "Date", value: form.workDate },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center gap-2">
                <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
                <span className="text-xs font-semibold text-slate-200 text-right">{value || "-"}</span>
              </div>
            ))}
          </div>

          {/* Shift badge */}
          <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-3">
            <div className="text-xs text-slate-400 mb-1">Current Shift</div>
            <div className={`text-sm font-bold ${isLeaveRequest ? "text-amber-300" : "text-sky-300"}`}>
              {form.workerShift}
            </div>
          </div>

          <Link to="/" className="mt-auto rounded-xl border border-white/15 hover:border-rose-400/40 text-slate-400 hover:text-rose-300 text-xs font-semibold py-2.5 text-center transition no-underline">
            ← Back to Home
          </Link>
        </aside>

        {/* Main form */}
        <main className="flex-1 p-5 md:p-8 overflow-y-auto">
          {submitSuccess && (
            <div className="mb-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4 flex items-center gap-3">
              <span className="text-emerald-400 text-xl">✓</span>
              <span className="text-sm font-semibold text-emerald-300">Submitted successfully. Have a safe work!</span>
            </div>
          )}

          {submitError && (
            <div className="mb-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 flex items-start gap-3">
              <span className="text-rose-400 text-xl shrink-0">✗</span>
              <span className="text-sm font-semibold text-rose-300">{submitError}</span>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-6 md:p-8">
            <div className="mb-7">
              <h2 className="text-xl font-black text-white mb-1">Attendance & Daily Activity</h2>
              <p className="text-slate-400 text-sm">Fill in all required fields and submit your daily login.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Grid fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {/* Civil ID */}
                <div>
                  <label className={labelCls}>Civil ID</label>
                  <input type="text" className={inputCls} value={form.civilId}
                    onChange={(e) => handleChange("civilId", e.target.value)} required />
                </div>
                {/* Work Date */}
                <div>
                  <label className={labelCls}>Work Date</label>
                  <input type="date" className={inputCls} value={form.workDate} readOnly required />
                </div>
                {/* Company */}
                <div>
                  <label className={labelCls}>Company Name</label>
                  <input type="text" className={inputCls} value={form.companyName} readOnly required />
                </div>
                {/* Designation */}
                <div>
                  <label className={labelCls}>Designation</label>
                  <input type="text" className={inputCls} value={form.designation} readOnly />
                </div>
                {/* Worker Name */}
                <div>
                  <label className={labelCls}>Worker Name</label>
                  <input type="text" className={inputCls} value={form.workerName}
                    onChange={(e) => handleChange("workerName", e.target.value)} required />
                </div>
                {/* Shift */}
                <div>
                  <label className={labelCls}>Shift Status</label>
                  <select className={selectCls} value={form.workerShift}
                    onChange={(e) => handleChange("workerShift", e.target.value)} required>
                    <option value="Day">Day</option>
                    <option value="Night">Night</option>
                    <option value="Request for leave">Request for leave</option>
                  </select>
                </div>
                {/* Location */}
                <div>
                  <label className={labelCls}>Area (Location)</label>
                  <select className={selectCls} value={form.location}
                    disabled={isNoLocationActivity || isLeaveRequest}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((p) => ({
                        ...p, location: val, incharge: "",
                        permitIssuer: (val === "Head Office" || val === "Laydown Office") ? "" : p.permitIssuer,
                        todayActivity: (val === "Head Office" || val === "Laydown Office")
                          ? (specialActivityNoLocation.includes(p.todayActivity) ? p.todayActivity : "Office Work")
                          : p.todayActivity,
                      }));
                    }}>
                    {locations.length === 0
                      ? <option value="">Null</option>
                      : <><option value="">Select Location</option>{locations.map((i) => <option key={i._id} value={i.name}>{i.name}</option>)}</>}
                  </select>
                </div>
                {/* Incharge */}
                <div>
                  <label className={labelCls}>Incharge</label>
                  <select className={selectCls} value={form.incharge}
                    onChange={(e) => handleChange("incharge", e.target.value)}
                    disabled={!form.location || isNoLocationActivity || isLeaveRequest}>
                    {!form.location
                      ? <option value="">Select location first</option>
                      : incharges.length === 0
                        ? <option value="">Null</option>
                        : <><option value="">Select Incharge</option>{incharges.map((i) => <option key={i._id} value={i.name}>{i.name}</option>)}</>}
                  </select>
                </div>
                {/* Permit Issuer */}
                <div>
                  <label className={labelCls}>Permit Issuer</label>
                  <select className={selectCls} value={form.permitIssuer}
                    onChange={(e) => handleChange("permitIssuer", e.target.value)}
                    disabled={permitIssuerDisabled || isNoLocationActivity || isLeaveRequest}>
                    {permitIssuers.length === 0
                      ? <option value="">Null</option>
                      : <><option value="">Select Permit Issuer</option>{permitIssuers.map((i) => <option key={i._id} value={i.name}>{i.name}</option>)}</>}
                  </select>
                </div>
                {/* Item Tag (optional) */}
                {itemTags.length > 0 && (
                  <div>
                    <label className={labelCls}>Item Tag <span className="text-slate-500 font-normal normal-case">(optional)</span></label>
                    <input
                      list="item-tag-list"
                      className={inputCls}
                      placeholder="Select or leave blank"
                      value={form.itemTag}
                      onChange={(e) => handleChange("itemTag", e.target.value)}
                      autoComplete="off"
                    />
                    <datalist id="item-tag-list">
                      {itemTags.map((t) => <option key={t.tag} value={t.tag}>{t.tag}</option>)}
                    </datalist>
                  </div>
                )}
              </div>

              {/* Time row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>From</label>
                  <TimePicker
                    value={form.timeFrom}
                    onChange={(v) => handleChange("timeFrom", v)}
                    disabled={isLeaveRequest}
                  />
                </div>
                <div>
                  <label className={labelCls}>To</label>
                  <TimePicker
                    value={form.timeTo}
                    onChange={(v) => handleChange("timeTo", v)}
                    disabled={isLeaveRequest}
                  />
                </div>
                <div>
                  <label className={labelCls}>Hours (Auto)</label>
                  <input type="text" className={`${inputCls} ${(timeError && form.timeFrom && form.timeTo) ? "border-rose-400/60 ring-1 ring-rose-400/20" : ""}`}
                    value={calcHours ?? "-"} readOnly />
                  <p className="mt-1 text-xs text-slate-500">
                    {isLeaveRequest ? "Leave: time not required" : timeError || "Max 12 hours/day"}
                  </p>
                </div>
              </div>

              {/* Main Activity */}
              <div>
                <label className={labelCls}>Main Activity <span className="text-rose-400">*</span></label>
                <div className="relative">
                  <input type="text" className={inputCls}
                    placeholder="Search or type activity..."
                    value={form.todayActivity}
                    onChange={(e) => {
                      const v = e.target.value;
                      setActivityQuery(v);
                      setActivityOpen(true);
                      if (specialActivityNoLocation.includes(v)) {
                        setForm((p) => ({ ...p, todayActivity: v, location: "", incharge: "", permitIssuer: "" }));
                        return;
                      }
                      handleChange("todayActivity", v);
                    }}
                    onFocus={() => { setActivityQuery(form.todayActivity); setActivityOpen(true); }}
                    onBlur={() => setTimeout(() => setActivityOpen(false), 150)}
                    autoComplete="off"
                    disabled={isLeaveRequest}
                    required
                  />
                  {activityOpen && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-slate-900 shadow-2xl scrollbar-thin">
                      {filteredActivities.slice(0, 60).map((opt) => (
                        <button key={opt} type="button"
                          className="w-full px-4 py-2.5 text-sm text-left text-slate-300 hover:bg-sky-500/20 hover:text-white transition border-b border-white/5 last:border-0"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            if (specialActivityNoLocation.includes(opt)) {
                              setForm((p) => ({ ...p, todayActivity: opt, location: "", incharge: "", permitIssuer: "" }));
                            } else {
                              handleChange("todayActivity", opt);
                            }
                            setActivityQuery(""); setActivityOpen(false);
                          }}>
                          {opt}
                        </button>
                      ))}
                      {filteredActivities.length === 0 && (
                        <div className="px-4 py-3 text-sm text-slate-500 text-center">No matches found</div>
                      )}
                    </div>
                  )}
                </div>
                {activityError && (
                  <p className="mt-1 text-xs text-rose-400">Main Activity is required</p>
                )}
              </div>

              {/* Leave reason */}
              {isLeaveRequest && (
                <div>
                  <label className={labelCls}>Reason for Leave <span className="text-rose-400">*</span></label>
                  <textarea
                    rows={3}
                    className="w-full rounded-xl border border-amber-400/30 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition resize-none"
                    placeholder="Enter reason for leave..."
                    value={form.leaveReason}
                    onChange={(e) => handleChange("leaveReason", e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Submit */}
              <div className="flex justify-end pt-2">
                <button type="submit" disabled={submitDisabled}
                  className="rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold px-8 py-3 transition-all duration-200 hover:shadow-[0_0_24px_rgba(56,189,248,0.25)]">
                  Submit Daily Login
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>

      <ImageCropModal
        open={profileCropOpen}
        onClose={() => setProfileCropOpen(false)}
        aspect={1}
        title="Crop profile photo"
        onConfirm={(dataUrl) => saveProfileDataUrl(dataUrl)}
      />

      {workerPanel && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="worker-panel-title"
          onClick={() => setWorkerPanel(null)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-white/15 bg-slate-900 shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start gap-4 mb-4">
              <h3 id="worker-panel-title" className="text-lg font-bold text-white">
                {workerPanel === "profile" && "Profile"}
                {workerPanel === "attendance" && "Attendance"}
                {workerPanel === "settings" && "Settings"}
              </h3>
              <button
                type="button"
                className="text-slate-400 hover:text-white text-2xl leading-none px-1"
                onClick={() => setWorkerPanel(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {workerPanel === "profile" && (
              <div className="space-y-5">
                <p className="text-sm text-slate-400">
                  Your photo is saved with your Civil ID and shown on this device after sign-in.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="shrink-0">
                    <WorkerAvatar
                      name={form.workerName}
                      civilId={form.civilId}
                      profilePicture={profilePicture}
                      sizeClass="w-28 h-28"
                      textClass="text-4xl font-black"
                      rounded="xl"
                    />
                  </div>
                  <div className="flex-1 space-y-3 w-full min-w-0">
                    <div>
                      <span className={labelCls}>Photo</span>
                      <button
                        type="button"
                        disabled={profileSaving}
                        onClick={() => setProfileCropOpen(true)}
                        className="mt-1 rounded-xl border border-sky-400/40 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 text-sm font-semibold px-4 py-2.5 transition disabled:opacity-50"
                      >
                        Choose & crop photo
                      </button>
                      <p className="mt-1 text-xs text-slate-500">Drag zoom to frame your face, then confirm.</p>
                    </div>
                    {profilePicture && (
                      <button
                        type="button"
                        onClick={clearProfilePhoto}
                        disabled={profileSaving}
                        className="text-sm text-rose-300 hover:text-rose-200 underline disabled:opacity-50"
                      >
                        Remove photo
                      </button>
                    )}
                    {profileSaveMsg && (
                      <p className={`text-sm ${profileSaveMsg.includes("saved") || profileSaveMsg.includes("removed") ? "text-emerald-400" : "text-rose-300"}`}>
                        {profileSaveMsg}
                      </p>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Name</span>
                    <span className="text-slate-200 font-medium text-right">{form.workerName || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Civil ID</span>
                    <span className="text-slate-200 font-medium text-right font-mono">{form.civilId || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Company</span>
                    <span className="text-slate-200 font-medium text-right">{form.companyName || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Designation</span>
                    <span className="text-slate-200 font-medium text-right">{form.designation || "—"}</span>
                  </div>
                </div>
              </div>
            )}

            {workerPanel === "attendance" && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <WorkerAvatar
                    name={form.workerName}
                    civilId={form.civilId}
                    profilePicture={profilePicture}
                    sizeClass="w-10 h-10"
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">{form.workerName || "—"}</p>
                    <p className="text-sm text-slate-400">Your recent daily log submissions.</p>
                  </div>
                </div>
                {myEntriesLoading ? (
                  <p className="text-slate-500 text-sm">Loading…</p>
                ) : myEntries.length === 0 ? (
                  <p className="text-slate-500 text-sm">No entries found yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400">
                          <th className="p-2 font-semibold">Date</th>
                          <th className="p-2 font-semibold">Activity</th>
                          <th className="p-2 font-semibold">Location</th>
                          <th className="p-2 font-semibold">Hrs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myEntries.map((row) => (
                          <tr key={row._id} className="border-b border-white/5 text-slate-200">
                            <td className="p-2 whitespace-nowrap">{row.work_date || "—"}</td>
                            <td className="p-2 max-w-[140px] truncate" title={row.today_activity || ""}>
                              {row.today_activity || "—"}
                            </td>
                            <td className="p-2 max-w-[100px] truncate">{row.location || "—"}</td>
                            <td className="p-2 whitespace-nowrap">
                              {row.worker_shift === "Request for leave" ? "Leave" : (row.worker_hours ?? "—")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {workerPanel === "settings" && (
              <div className="space-y-3 text-sm text-slate-300">
                <p className="text-slate-400">
                  App preferences for the worker portal can be extended here (for example notifications or default shift).
                </p>
                <ul className="list-disc list-inside text-slate-500 space-y-1">
                  <li>Photo and profile data are tied to your Civil ID in the system.</li>
                  <li>Use Logout when you finish on a shared device.</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkerDataEntry;
