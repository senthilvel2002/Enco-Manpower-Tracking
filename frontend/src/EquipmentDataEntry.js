import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiUrl } from "./api";
import LoadingOverlay from "./LoadingOverlay";
import WorkerAvatar from "./WorkerAvatar";
import ImageCropModal from "./ImageCropModal";
import TimePicker from "./TimePicker";

const BG = {
  backgroundImage: `linear-gradient(rgba(2,6,23,0.82), rgba(2,6,23,0.94)), url(/sohar-oman.jpg)`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
};

const inputCls =
  "w-full rounded-xl border border-white/15 bg-slate-900/80 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition";
const inputReadonlyCls =
  "w-full rounded-xl border border-white/10 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-300 cursor-default";
const selectCls =
  "w-full rounded-xl border border-white/15 bg-slate-900/80 px-4 py-2.5 text-sm text-slate-100 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5";

const TYPE_ICONS = {
  Crane: "🏗️",
  Manlift: "🛗",
  Forklift: "🚜",
  "Scissor Lift": "⬆️",
  Trailer: "🚛",
  Bus: "🚌",
  Compressor: "⚙️",
  Generator: "⚡",
  "Tower Light": "💡",
  "Pick-Up": "🛻",
  Telehandler: "🏗️",
};

function Badge({ children, color = "amber" }) {
  const colors = {
    amber: "bg-amber-500/15 text-amber-300 border-amber-400/30",
    sky: "bg-sky-500/15 text-sky-300 border-sky-400/30",
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
    rose: "bg-rose-500/15 text-rose-300 border-rose-400/30",
    slate: "bg-slate-500/15 text-slate-400 border-slate-400/20",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colors[color] || colors.amber}`}>
      {children}
    </span>
  );
}


function EquipmentDataEntry() {
  const { state } = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Master lists
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);

  const EQUIPMENT_STATUSES = [
    "Working", "Under Maintenance", "Transporting",
    "Disassembly", "Assembly", "Inspection", "Expired",
  ];

  // Form state
  const [form, setForm] = useState({
    civilId: state?.civilId || "",
    companyName: state?.companyName || state?.workerProfile?.company_name || "",
    operatorName: state?.workerProfile?.name || "",
    designation: state?.workerProfile?.designation || "",
    workDate: new Date().toISOString().slice(0, 10),
    equipmentType: "",
    equipmentId: "",
    equipmentStatus: "",
    location: "",
    timeFrom: "",
    timeTo: "",
    activity: "",
    rentalAmount: "",
  });

  // Selected equipment details (fetched after selection)
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [profilePicture, setProfilePicture] = useState(state?.workerProfile?.profile_picture || "");
  const [equipCropOpen, setEquipCropOpen] = useState(false);
  const [equipPicSaving, setEquipPicSaving] = useState(false);
  const [equipPicMsg, setEquipPicMsg] = useState("");

  const runWithLoading = useCallback(async (fn) => {
    setPendingCount((c) => c + 1);
    try { return await fn(); }
    finally { setPendingCount((c) => Math.max(0, c - 1)); }
  }, []);

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

  // Load equipment types on mount
  useEffect(() => {
    const load = async () => {
      try {
        const res = await runWithLoading(() => fetch(apiUrl("/api/equipment/types")));
        const data = await res.json();
        if (data.ok) setEquipmentTypes(data.types || []);
      } catch (e) { console.error(e); }
    };
    load();
  }, [runWithLoading]);


  // Load equipment list when type changes
  useEffect(() => {
    if (!form.equipmentType) {
      setEquipmentList([]);
      setSelectedEquipment(null);
      setForm((p) => ({ ...p, equipmentId: "" }));
      return;
    }
    const load = async () => {
      try {
        const params = new URLSearchParams({
          type: form.equipmentType,
          date: form.workDate,
        });
        const res = await runWithLoading(() =>
          fetch(apiUrl(`/api/equipment/list?${params}`))
        );
        const data = await res.json();
        if (data.ok) setEquipmentList(data.equipment || []);
      } catch (e) { console.error(e); }
    };
    load();
    setSelectedEquipment(null);
    setForm((p) => ({ ...p, equipmentId: "" }));
  }, [form.equipmentType, form.workDate, runWithLoading]);

  // When equipment is selected, fill details and pre-fill location
  const handleEquipmentSelect = (equipmentId) => {
    setForm((p) => ({ ...p, equipmentId }));
    if (!equipmentId) {
      setSelectedEquipment(null);
      return;
    }
    const eq = equipmentList.find((e) => e._id === equipmentId);
    setSelectedEquipment(eq || null);
    if (eq?.location) {
      setForm((p) => ({ ...p, equipmentId, location: eq.location }));
    }
  };

  const handleChange = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  // Hours calculation
  const calcHours = useMemo(() => {
    if (!form.timeFrom || !form.timeTo) return null;
    const toMin = (t) => {
      const [h, m] = t.split(":").map(Number);
      return isNaN(h) || isNaN(m) ? null : h * 60 + m;
    };
    const s = toMin(form.timeFrom), e = toMin(form.timeTo);
    if (s === null || e === null || e <= s) return null;
    return Number(((e - s) / 60).toFixed(2));
  }, [form.timeFrom, form.timeTo]);

  // Auto-calculate rental amount for rental equipment (hourly contract rate × hours)
  const autoRentalAmount = useMemo(() => {
    if (!selectedEquipment || selectedEquipment.ownership !== "rental") return null;
    if (calcHours === null) return null;
    const hourlyRate = selectedEquipment.contract_rate?.hourly;
    if (hourlyRate === null || hourlyRate === undefined || hourlyRate === 0) return null;
    return Number((calcHours * hourlyRate).toFixed(2));
  }, [selectedEquipment, calcHours]);

  const timeError = useMemo(() => {
    if (!form.timeFrom && !form.timeTo) return "Select From and To time";
    if (!form.timeFrom || !form.timeTo) return "Select both From and To time";
    if (calcHours === null) return "To time must be after From time";
    return "";
  }, [form.timeFrom, form.timeTo, calcHours]);

  const isRental = selectedEquipment?.ownership === "rental";

  const mergeEquipmentPicture = useCallback((eqId, pictureUrl) => {
    setSelectedEquipment((prev) =>
      prev && prev._id === eqId ? { ...prev, equipment_picture: pictureUrl || "" } : prev
    );
    setEquipmentList((list) =>
      list.map((e) => (e._id === eqId ? { ...e, equipment_picture: pictureUrl || "" } : e))
    );
  }, []);

  const saveEquipmentCroppedPicture = async (dataUrl) => {
    if (!form.civilId || !form.equipmentId) return;
    setEquipPicSaving(true);
    setEquipPicMsg("");
    try {
      const res = await fetch(apiUrl("/api/equipment/self/picture"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          civil_id: form.civilId,
          equipment_id: form.equipmentId,
          equipment_picture: dataUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      mergeEquipmentPicture(form.equipmentId, data.equipment_picture || "");
      setEquipPicMsg("Equipment photo saved.");
    } catch (err) {
      setEquipPicMsg(err.message || "Could not save photo.");
    } finally {
      setEquipPicSaving(false);
    }
  };

  const clearEquipmentPicture = async () => {
    if (!form.civilId || !form.equipmentId) return;
    setEquipPicSaving(true);
    setEquipPicMsg("");
    try {
      const res = await fetch(apiUrl("/api/equipment/self/picture"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          civil_id: form.civilId,
          equipment_id: form.equipmentId,
          equipment_picture: null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Remove failed");
      mergeEquipmentPicture(form.equipmentId, "");
      setEquipPicMsg("Photo removed.");
    } catch (err) {
      setEquipPicMsg(err.message || "Could not remove.");
    } finally {
      setEquipPicSaving(false);
    }
  };

  const submitDisabled =
    !form.equipmentId ||
    !form.equipmentType ||
    !form.equipmentStatus ||
    !form.location.trim() ||
    !!timeError;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (timeError) { setSubmitError(timeError); return; }
    if (!form.equipmentId) { setSubmitError("Select an equipment"); return; }
    setSubmitError("");
    try {
      const rentalAmountFinal =
        isRental
          ? (autoRentalAmount !== null ? autoRentalAmount : (form.rentalAmount !== "" ? Number(form.rentalAmount) : null))
          : null;

      const res = await runWithLoading(() =>
        fetch(apiUrl("/api/equipment-entries"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            civil_id: form.civilId,
            company_name: form.companyName,
            operator_name: form.operatorName,
            equipment_id: form.equipmentId,
            work_date: form.workDate,
            time_from: form.timeFrom,
            time_to: form.timeTo,
            location: form.location.trim(),
            equipment_status: form.equipmentStatus,
            activity: form.activity,
            rental_amount: rentalAmountFinal,
          }),
        })
      );
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
      setSelectedEquipment(null);
      setForm((p) => ({
        ...p,
        equipmentType: "",
        equipmentId: "",
        equipmentStatus: "",
        location: "",
        timeFrom: "",
        timeTo: "",
        activity: "",
        rentalAmount: "",
      }));
      setEquipmentList([]);
      setTimeout(() => setSubmitSuccess(false), 5000);
    } catch {
      setSubmitError("Unable to submit. Please try again.");
    }
  };

  const typeIcon = TYPE_ICONS[form.equipmentType] || "🔧";

  // Available (not locked) equipment for current type
  const availableEquipment = equipmentList.filter((eq) => !eq.is_locked);
  const lockedEquipment = equipmentList.filter((eq) => eq.is_locked);

  return (
    <div className="min-h-screen min-h-[100dvh] w-full font-sans text-white mobile-bg-attachment-scroll" style={BG}>
      <LoadingOverlay show={pendingCount > 0} message="Loading..." />

      {/* Top bar */}
      <header className="w-full sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
        <div className="flex items-center gap-4 px-4 sm:px-5 md:px-8 min-h-14">
          <Link to="/" className="flex items-center gap-3 no-underline shrink-0">
            <img src="/Logo - Copy.png" alt="Encogroup" className="h-9 w-auto object-contain" />
            <div className="hidden sm:block leading-none">
              <div className="text-white text-xs font-extrabold uppercase tracking-widest">Encogroup</div>
              <div className="text-slate-400 text-[10px] tracking-wider">Equipment Tracking</div>
            </div>
          </Link>
          <div className="border-l border-white/10 pl-4 ml-2">
            <div className="text-sm font-bold text-white">Equipment Daily Entry</div>
            <div className="text-xs text-slate-400">{form.workDate}</div>
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <WorkerAvatar
              name={form.operatorName}
              civilId={form.civilId}
              profilePicture={profilePicture}
              sizeClass="w-9 h-9"
            />
            <span className="text-sm font-semibold text-white max-w-[120px] truncate hidden sm:inline">
              {form.operatorName || "Operator"}
            </span>
            <Link to="/" className="rounded-xl border border-white/20 hover:border-rose-400/50 text-slate-300 hover:text-rose-300 text-xs font-bold px-3 sm:px-4 py-2 transition no-underline">
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
              name={form.operatorName}
              civilId={form.civilId}
              profilePicture={profilePicture}
              sizeClass="w-14 h-14"
              textClass="text-2xl font-black"
              rounded="xl"
            />
            <div>
              <div className="text-base font-bold text-white">{form.operatorName || "-"}</div>
              <div className="text-xs text-slate-400 mt-0.5">{form.designation || "Operator"}</div>
            </div>
          </div>

          {/* Operator info */}
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

          {/* Selected equipment summary */}
          {selectedEquipment ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 space-y-3">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Selected Equipment</div>
              {selectedEquipment.equipment_picture ? (
                <div className="rounded-xl overflow-hidden border border-white/10 aspect-video bg-black/40">
                  <img src={selectedEquipment.equipment_picture} alt="" className="w-full h-full object-cover max-h-32" />
                </div>
              ) : (
                <div className="text-2xl text-center">{typeIcon}</div>
              )}
              <div className="text-sm font-bold text-white text-center">{selectedEquipment.name}</div>
              {selectedEquipment.plate_number && (
                <div className="text-center">
                  <span className="inline-block bg-slate-800 border border-white/10 rounded-lg px-3 py-1 text-xs font-mono text-amber-300">
                    {selectedEquipment.plate_number}
                  </span>
                </div>
              )}
              <div className="flex justify-center gap-2 flex-wrap">
                <Badge color={isRental ? "rose" : "emerald"}>
                  {isRental ? "RENTAL" : "ENCO OWNED"}
                </Badge>
                <Badge color="slate">{selectedEquipment.equipment_type}</Badge>
              </div>
              <div className="text-xs text-slate-500 text-center">{selectedEquipment.location}</div>
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={equipPicSaving}
                  onClick={() => setEquipCropOpen(true)}
                  className="w-full rounded-lg border border-amber-400/35 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 text-xs font-semibold py-2 transition disabled:opacity-50"
                >
                  {selectedEquipment.equipment_picture ? "Change equipment photo" : "Add equipment photo"}
                </button>
                {selectedEquipment.equipment_picture && (
                  <button
                    type="button"
                    disabled={equipPicSaving}
                    onClick={clearEquipmentPicture}
                    className="w-full text-xs text-rose-300/90 hover:text-rose-200 underline disabled:opacity-50"
                  >
                    Remove photo
                  </button>
                )}
                {equipPicMsg && (
                  <p className={`text-xs text-center ${equipPicMsg.includes("saved") || equipPicMsg.includes("removed") ? "text-emerald-400" : "text-rose-300"}`}>
                    {equipPicMsg}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-center">
              <div className="text-4xl mb-2">🚜</div>
              <div className="text-xs text-slate-500">No equipment selected</div>
            </div>
          )}

          <Link to="/" className="mt-auto rounded-xl border border-white/15 hover:border-rose-400/40 text-slate-400 hover:text-rose-300 text-xs font-semibold py-2.5 text-center transition no-underline">
            ← Back to Home
          </Link>
        </aside>

        {/* Main form */}
        <main className="flex-1 p-5 md:p-8 overflow-y-auto">
          {submitSuccess && (
            <div className="mb-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4 flex items-center gap-3">
              <span className="text-emerald-400 text-xl">✓</span>
              <span className="text-sm font-semibold text-emerald-300">Equipment entry submitted successfully!</span>
            </div>
          )}

          {submitError && (
            <div className="mb-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 flex items-center gap-3">
              <span className="text-rose-400 text-xl">✗</span>
              <span className="text-sm font-semibold text-rose-300">{submitError}</span>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-6 md:p-8">
            <div className="mb-7">
              <h2 className="text-xl font-black text-white mb-1">Equipment Daily Entry</h2>
              <p className="text-slate-400 text-sm">Select equipment type, then choose the equipment and fill in working hours.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

              {/* ── Section 1: Operator Info (read-only) ── */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-amber-400/80 mb-3 flex items-center gap-2">
                  <span>👤</span> Operator Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Civil ID</label>
                    <input className={inputReadonlyCls} value={form.civilId} readOnly />
                  </div>
                  <div>
                    <label className={labelCls}>Operator Name</label>
                    <input className={inputReadonlyCls} value={form.operatorName || "-"} readOnly />
                  </div>
                  <div>
                    <label className={labelCls}>Company</label>
                    <input className={inputReadonlyCls} value={form.companyName || "-"} readOnly />
                  </div>
                  <div>
                    <label className={labelCls}>Work Date</label>
                    <input className={inputReadonlyCls} value={form.workDate} readOnly />
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10" />

              {/* ── Section 2: Equipment Selection ── */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-amber-400/80 mb-3 flex items-center gap-2">
                  <span>🔧</span> Equipment Selection
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Type */}
                  <div>
                    <label className={labelCls}>Equipment Type <span className="text-rose-400">*</span></label>
                    <select
                      className={selectCls}
                      value={form.equipmentType}
                      onChange={(e) => handleChange("equipmentType", e.target.value)}
                      required
                    >
                      <option value="">Select type...</option>
                      {equipmentTypes.map((t) => (
                        <option key={t} value={t}>
                          {TYPE_ICONS[t] ? `${TYPE_ICONS[t]} ` : ""}{t}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Equipment Name */}
                  <div>
                    <label className={labelCls}>Equipment Name <span className="text-rose-400">*</span></label>
                    <select
                      className={selectCls}
                      value={form.equipmentId}
                      onChange={(e) => handleEquipmentSelect(e.target.value)}
                      disabled={!form.equipmentType}
                      required
                    >
                      <option value="">
                        {!form.equipmentType ? "Select type first" : "Select equipment..."}
                      </option>
                      {availableEquipment.length > 0 && (
                        <optgroup label="Available">
                          {availableEquipment.map((eq) => (
                            <option key={eq._id} value={eq._id}>
                              {eq.name}{eq.plate_number ? ` [${eq.plate_number}]` : ""}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {lockedEquipment.length > 0 && (
                        <optgroup label="Already logged today (unavailable)">
                          {lockedEquipment.map((eq) => (
                            <option key={eq._id} value={eq._id} disabled>
                              🔒 {eq.name}{eq.plate_number ? ` [${eq.plate_number}]` : ""}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    {form.equipmentType && availableEquipment.length === 0 && equipmentList.length > 0 && (
                      <p className="mt-1 text-xs text-amber-400">All equipment of this type is already logged today.</p>
                    )}
                  </div>
                </div>

                {/* Auto-filled equipment details */}
                {selectedEquipment && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div>
                      <label className={labelCls}>Plate / Serial No.</label>
                      <input
                        className={inputReadonlyCls + " font-mono"}
                        value={selectedEquipment.plate_number || "N/A"}
                        readOnly
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Ownership</label>
                      <div className={`${inputReadonlyCls} flex items-center gap-2`}>
                        {!isRental ? (
                          <><span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                          <span className="text-emerald-300 font-semibold">ENCO Owned</span></>
                        ) : (
                          <><span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                          <span className="text-rose-300 font-semibold">Rental</span></>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Location / Area</label>
                      <input className={inputReadonlyCls} value={selectedEquipment.location || "-"} readOnly />
                    </div>
                    <div>
                      <label className={labelCls}>Type</label>
                      <input className={inputReadonlyCls} value={selectedEquipment.equipment_type || "-"} readOnly />
                    </div>
                  </div>
                )}
              </div>


              <div className="border-t border-white/10" />

              {/* ── Section 3: Status & Location ── */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-amber-400/80 mb-3 flex items-center gap-2">
                  <span>📍</span> Status &amp; Location <span className="text-rose-400 text-[10px] normal-case font-normal ml-1">All fields required</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Equipment Status */}
                  <div>
                    <label className={labelCls}>Equipment Status <span className="text-rose-400">*</span></label>
                    <select
                      className={selectCls}
                      value={form.equipmentStatus}
                      onChange={(e) => handleChange("equipmentStatus", e.target.value)}
                      required
                    >
                      <option value="">Select status...</option>
                      {EQUIPMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {form.equipmentStatus && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${
                          form.equipmentStatus === "Working" ? "bg-emerald-400" :
                          form.equipmentStatus === "Under Maintenance" ? "bg-amber-400" :
                          form.equipmentStatus === "Transporting" ? "bg-sky-400" :
                          form.equipmentStatus === "Disassembly" ? "bg-rose-400" :
                          form.equipmentStatus === "Assembly" ? "bg-violet-400" :
                          form.equipmentStatus === "Inspection" ? "bg-orange-400" :
                          "bg-slate-400"
                        }`} />
                        <span className="text-xs text-slate-400">{form.equipmentStatus}</span>
                      </div>
                    )}
                  </div>

                  {/* Location */}
                  <div>
                    <label className={labelCls}>Current Location <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="Where is this equipment working today?"
                      value={form.location}
                      onChange={(e) => handleChange("location", e.target.value)}
                      required
                    />
                    <p className="mt-1 text-[10px] text-slate-500">Pre-filled from equipment master — update if different</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10" />

              {/* ── Section 4: Hours ── */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-amber-400/80 mb-3 flex items-center gap-2">
                  <span>⏱️</span> Working Hours
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>From <span className="text-rose-400">*</span></label>
                    <TimePicker
                      value={form.timeFrom}
                      onChange={(v) => handleChange("timeFrom", v)}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>To <span className="text-rose-400">*</span></label>
                    <TimePicker
                      value={form.timeTo}
                      onChange={(v) => handleChange("timeTo", v)}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Hours (Auto-Calculated)</label>
                    <input
                      type="text"
                      className={`${inputReadonlyCls} ${calcHours !== null ? "text-amber-300 font-bold" : ""}`}
                      value={calcHours !== null ? `${calcHours} hrs` : "-"}
                      readOnly
                    />
                    {timeError && form.timeFrom && form.timeTo && (
                      <p className="mt-1 text-xs text-rose-400">{timeError}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Section 5: Activity ── */}
              <div className="border-t border-white/10" />
              <div>
                <label className={labelCls}>Activity / Notes</label>
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition resize-none"
                  placeholder="Describe the work done with this equipment today..."
                  value={form.activity}
                  onChange={(e) => handleChange("activity", e.target.value)}
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitDisabled}
                  className="rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold px-8 py-3 transition-all duration-200 hover:shadow-[0_0_24px_rgba(251,191,36,0.25)]"
                >
                  Submit Equipment Entry
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>

      <ImageCropModal
        open={equipCropOpen}
        onClose={() => setEquipCropOpen(false)}
        aspect={4 / 3}
        title="Crop equipment photo"
        onConfirm={(dataUrl) => saveEquipmentCroppedPicture(dataUrl)}
      />
    </div>
  );
}

export default EquipmentDataEntry;
