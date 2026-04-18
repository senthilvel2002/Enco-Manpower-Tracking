import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiUrl } from "./api";
import LoadingOverlay from "./LoadingOverlay";

const BG = {
  backgroundImage: `linear-gradient(rgba(2,6,23,0.78), rgba(2,6,23,0.92)), url(/sohar-oman.jpg)`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
};

const inputCls =
  "w-full rounded-xl border border-white/15 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/20 transition";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5";
const selectCls =
  "w-full rounded-xl border border-white/15 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/20 transition cursor-pointer";

function AdminLogin() {
  const navigate = useNavigate();
  const [civilId, setCivilId] = useState("");
  const [password, setPassword] = useState("");
  const [viewType, setViewType] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/admin-login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ civil_id: civilId, view_type: viewType, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          res.status === 401 || res.status === 403
            ? "Access denied. Check your credentials."
            : res.status === 409
              ? data?.error || "Multiple matches; enter your full Civil ID."
              : data?.error || "Unable to sign in. Please try again."
        );
        return;
      }
      const loginTime = new Date().toLocaleString();
      const companyName = data.company_name || "";
      const adminName = data.admin_name || "";
      const resolvedCivilId = data.civil_id || civilId;
      if (data.view_type === "site_incharge") {
        navigate("/site-incharge", { state: { civilId: resolvedCivilId, adminName, companyName, loginTime } });
      } else {
        navigate("/management", { state: { civilId: resolvedCivilId, adminName, companyName, loginTime } });
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] w-full flex flex-col font-sans text-white mobile-bg-attachment-scroll" style={BG}>
      <LoadingOverlay show={isLoading} message="Signing in..." />

      <header className="w-full flex items-center gap-3 px-4 sm:px-6 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-4 bg-slate-950/50 backdrop-blur-md border-b border-white/10">
        <Link to="/" className="flex items-center gap-3 no-underline">
          <img src="/Logo - Copy.png" alt="Encogroup" className="h-9 w-auto object-contain" />
          <div className="hidden sm:block leading-none">
            <div className="text-white text-xs font-extrabold uppercase tracking-widest">Encogroup</div>
            <div className="text-slate-400 text-[10px] tracking-wider">Manpower Tracking</div>
          </div>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-12 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))]">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-xl p-8 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-3xl mb-6 mx-auto">
              🛡️
            </div>
            <h1 className="text-2xl font-black text-white text-center mb-1">Admin Access</h1>
            <p className="text-slate-400 text-sm text-center mb-8">
              Last 4 digits of Civil ID or full ID, your password, and your role
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="adminCivilId" className={labelCls}>Civil ID (last 4 or full)</label>
                <input
                  id="adminCivilId"
                  type="text"
                  className={inputCls}
                  placeholder="e.g. 1234 or full Civil ID"
                  value={civilId}
                  onChange={(e) => setCivilId(e.target.value)}
                  inputMode="numeric"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label htmlFor="adminPassword" className={labelCls}>Password</label>
                <input
                  id="adminPassword"
                  type="password"
                  className={inputCls}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div>
                <label htmlFor="adminViewType" className={labelCls}>View Type</label>
                <select
                  id="adminViewType"
                  className={selectCls}
                  value={viewType}
                  onChange={(e) => setViewType(e.target.value)}
                  required
                >
                  <option value="">Select your role</option>
                  <option value="site_incharge">Site Incharge View</option>
                  <option value="management">Management View</option>
                </select>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold py-3 transition-all duration-200 hover:shadow-[0_0_24px_rgba(56,189,248,0.25)] mt-2"
              >
                Sign In
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link to="/" className="text-slate-400 hover:text-sky-300 text-sm transition no-underline">
                ← Back to Home
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-slate-600 mt-6">
            Encogroup · Sohar Hub Program · Manpower Tracking
          </p>
        </div>
      </main>
    </div>
  );
}

export default AdminLogin;
