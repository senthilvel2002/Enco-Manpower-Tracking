/**
 * TimePicker – 12-hour AM/PM format (internally stores/receives "HH:MM" 24h)
 *
 * Props:
 *   value    – "HH:MM" 24-hour string (controlled)
 *   onChange – called with new "HH:MM" 24-hour string
 *   disabled – greys out the whole picker
 *   required – HTML5 form validation
 *   presets  – array of "HH:MM" 24h strings for quick-tap buttons
 */

// ── helpers ──────────────────────────────────────────────────────────────────

/** "14:30"  →  { h12: 2, ampm: "PM", mm: "30" } */
function to12(hhmm) {
  if (!hhmm) return { h12: "", ampm: "AM", mm: "" };
  const [hStr, mStr] = hhmm.split(":");
  const h24 = parseInt(hStr, 10);
  const mm   = mStr || "00";
  if (isNaN(h24)) return { h12: "", ampm: "AM", mm };
  const ampm = h24 < 12 ? "AM" : "PM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return { h12, ampm, mm };
}

/** { h12: 2, ampm: "PM", mm: "30" }  →  "14:30" */
function to24(h12, ampm, mm) {
  if (h12 === "" || mm === "") return "";
  let h = parseInt(h12, 10);
  if (isNaN(h)) return "";
  if (ampm === "AM") {
    if (h === 12) h = 0;
  } else {
    if (h !== 12) h += 12;
  }
  return `${String(h).padStart(2, "0")}:${mm}`;
}

/** "14:30"  →  "2:30 PM" (display label for presets) */
function displayLabel(hhmm) {
  const { h12, ampm, mm } = to12(hhmm);
  if (h12 === "") return hhmm;
  return `${h12}:${mm} ${ampm}`;
}

// ── constants ─────────────────────────────────────────────────────────────────

const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES  = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

const DEFAULT_PRESETS = [
  "06:00", "07:00", "08:00", "09:00",
  "12:00", "13:00", "17:00", "18:00",
];

// ── component ─────────────────────────────────────────────────────────────────

function TimePicker({
  value    = "",
  onChange,
  disabled = false,
  required = false,
  presets  = DEFAULT_PRESETS,
}) {
  const { h12, ampm, mm } = to12(value);

  const emit = (newH12, newAmpm, newMm) => {
    const result = to24(newH12, newAmpm, newMm);
    onChange(result);
  };

  const handleHour  = (e) => emit(e.target.value === "" ? "" : parseInt(e.target.value, 10), ampm, mm || "00");
  const handleAmpm  = (e) => emit(h12, e.target.value, mm || "00");
  const handleMin   = (e) => emit(h12 || 12, ampm, e.target.value);
  const handlePreset = (p) => { if (!disabled) onChange(p); };

  const sel =
    "rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 " +
    "focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition " +
    "cursor-pointer appearance-none disabled:opacity-50 disabled:cursor-not-allowed";

  // Display label shown after selection
  const label = value ? displayLabel(value) : "";

  return (
    <div className={`space-y-2 ${disabled ? "opacity-60 pointer-events-none" : ""}`}>

      {/* Dropdowns row */}
      <div className="flex items-center gap-1.5">

        {/* Hour  1–12 */}
        <select
          value={h12}
          onChange={handleHour}
          disabled={disabled}
          className={`${sel} w-16 text-center`}
          aria-label="Hour"
        >
          <option value="">Hr</option>
          {HOURS_12.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>

        <span className="text-slate-400 font-extrabold text-base select-none">:</span>

        {/* Minute */}
        <select
          value={mm}
          onChange={handleMin}
          disabled={disabled}
          className={`${sel} w-16 text-center`}
          aria-label="Minute"
        >
          <option value="">Min</option>
          {MINUTES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* AM / PM */}
        <select
          value={ampm}
          onChange={handleAmpm}
          disabled={disabled}
          className={`${sel} w-16 text-center font-bold`}
          aria-label="AM or PM"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>

        {/* Confirmation label */}
        {label && (
          <span className="text-amber-300 font-bold text-sm tabular-nums whitespace-nowrap">
            {label}
          </span>
        )}
      </div>

      {/* Quick preset buttons (shown in 12h format) */}
      {!disabled && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePreset(p)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                value === p
                  ? "bg-amber-500/30 border-amber-400/60 text-amber-200"
                  : "border-white/15 bg-slate-800/60 text-slate-400 hover:border-amber-400/40 hover:text-amber-300"
              }`}
            >
              {displayLabel(p)}
            </button>
          ))}
        </div>
      )}

      {/* Hidden input for HTML5 required validation */}
      {required && (
        <input
          type="text"
          tabIndex={-1}
          readOnly
          required={required}
          value={value}
          style={{ opacity: 0, height: 0, width: 0, position: "absolute", pointerEvents: "none" }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export default TimePicker;
