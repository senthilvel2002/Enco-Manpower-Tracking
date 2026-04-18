import { useState } from "react";
import { useNavigate } from "react-router-dom";

const BASE = "https://www.encogroup.net";

const NAV_LINKS = [
  { label: "About Us",      href: `${BASE}/about-us` },
  { label: "Our Business",  href: `${BASE}/our-business` },
  { label: "Where We Work", href: `${BASE}/where-we-work` },
  { label: "Sustainability",href: `${BASE}/sustainability` },
  { label: "News",          href: `${BASE}/news` },
  { label: "Contact",       href: `${BASE}/contact-us` },
];

const BUSINESSES = [
  { icon: "🏗️", title: "Engineering, Procurement & Construction (EPC)", desc: "EPC contracts for structural steel, API 650/620 tanks, piping and pipelines across industrial sectors." },
  { icon: "🔩", title: "Fabrication & Manufacturing", desc: "Steel structure fabrication and specialized manufacturing for complex industrial requirements." },
  { icon: "🔍", title: "Inspection Services", desc: "Tank inspection (API 653), rehabilitation, corrosion assessment and advanced NDT testing." },
  { icon: "⚙️", title: "Operation & Maintenance", desc: "Comprehensive maintenance of storage tanks, industrial facilities and plant infrastructure." },
  { icon: "🌊", title: "Offshore Services", desc: "Offshore project execution and marine industrial solutions across global operations." },
  { icon: "🤝", title: "Dealership", desc: "Authorised dealerships for Kemppi, Promotech, Cold Jet, G.B.C, NDT Italiana & Tecnoseal Industry." },
];

const REGIONS = [
  { label: "Middle East", countries: ["Lebanon", "KSA", "UAE", "Sultanate of Oman"] },
  { label: "Gulf",        countries: ["Bahrain", "Kuwait", "Qatar"] },
  { label: "Europe",      countries: ["Lithuania", "Germany", "France"] },
  { label: "Africa",      countries: ["Côte d'Ivoire", "Nigeria"] },
];

const DEALERS = ["KEMPPI", "PROMOTECH", "COLD JET", "G.B.C", "NDT ITALIANA", "TECNOSEAL INDUSTRY"];

const STATS = [
  { value: "14+", label: "Years of Excellence" },
  { value: "4",   label: "Continents" },
  { value: "100+", label: "Skilled Professionals" },
  { value: "500+", label: "Projects Delivered" },
];

const LOGIN_OPTIONS = [
  { key: "worker",        label: "Worker Login",        path: "/worker",           icon: "👷", desc: "Log your daily attendance & shift" },
  { key: "equipment",     label: "Equipment Entry",     path: "/equipment",        icon: "🚜", desc: "Log daily equipment entry details" },
  { key: "site_incharge", label: "Site Incharge Login", path: "/site-incharge-login", icon: "🏗️", desc: "Review and approve worker entries" },
  { key: "management",   label: "Admin Login",          path: "/management-login", icon: "🔐", desc: "Manage workforce data & analytics" },
];

export default function Home() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-slate-950 font-sans text-white">

      {/* ════════════════ NAVBAR ════════════════ */}
      <header className="w-full sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
        <div className="w-full flex items-center justify-between px-4 sm:px-5 md:px-10 xl:px-16 min-h-14">

          {/* Logo */}
          <a href={BASE} target="_blank" rel="noreferrer" className="flex items-center gap-3 shrink-0 no-underline">
            <img src="/Logo - Copy.png" alt="Encogroup" className="h-10 w-auto object-contain" style={{ filter: "brightness(1.2)" }} />
            <div className="hidden sm:block leading-none">
              <div className="text-white text-sm font-extrabold uppercase tracking-widest">Encogroup</div>
              <div className="text-slate-400 text-[10px] tracking-wider">Manpower Tracking · Sohar Hub</div>
            </div>
          </a>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((lnk) => (
              <a
                key={lnk.label}
                href={lnk.href}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/10 transition font-medium no-underline"
              >
                {lnk.label}
              </a>
            ))}
          </nav>

          {/* Hamburger */}
          <button
            className="lg:hidden p-2 rounded-lg text-slate-300 hover:bg-white/10 transition"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="lg:hidden px-5 pb-4 flex flex-col gap-1 bg-slate-950/95">
            {NAV_LINKS.map((lnk) => (
              <a
                key={lnk.label}
                href={lnk.href}
                target="_blank"
                rel="noreferrer"
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/10 transition no-underline"
              >
                {lnk.label}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* ════════════════ HERO ════════════════ */}
      <section
        className="relative w-full flex flex-col items-center justify-center text-center px-4 py-24 md:py-36"
        style={{
          backgroundImage: `linear-gradient(rgba(2,6,23,0.60), rgba(2,6,23,0.80)), url(${process.env.PUBLIC_URL}/sohar-oman.jpg)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          minHeight: "min(92vh, 92dvh)",
        }}
      >
        {/* Badge */}
        <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-500/15 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-sky-200 mb-5">
          Sohar Hub Program · Workforce Portal
        </span>

        {/* Headline */}
        <h1 className="text-4xl md:text-5xl xl:text-6xl font-black text-white leading-tight max-w-3xl mb-5">
          Delivering Reliable<br className="hidden md:block" /> Industrial Solutions
        </h1>

        {/* Tagline */}
        <p className="text-slate-300 text-base md:text-lg max-w-2xl mb-4 leading-relaxed">
          Encogroup supports operations across engineering, fabrication, inspection, offshore, and
          maintenance services. This manpower tracking portal is tailored for secure and efficient
          workforce visibility in the Sohar Hub Program.
        </p>
        <p className="text-slate-400 text-sm mb-12">Select your role below to continue</p>

        {/* Login cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-5xl">
          {LOGIN_OPTIONS.map(({ key, label, path, icon, desc }) => (
            <button
              key={key}
              type="button"
              onClick={() => navigate(path)}
              className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/15 bg-slate-900/60 backdrop-blur-sm px-5 py-7 transition-all duration-200 hover:border-sky-400/60 hover:bg-sky-500/20 hover:shadow-[0_0_32px_rgba(56,189,248,0.18)] hover:scale-[1.03] cursor-pointer"
            >
              <span className="w-12 h-12 rounded-full flex items-center justify-center text-2xl border border-white/20 bg-white/5 group-hover:border-sky-300/50 group-hover:bg-sky-500/20 transition-all">
                {icon}
              </span>
              <div>
                <div className="text-sm font-bold text-slate-100 group-hover:text-white">{label}</div>
                <div className="text-xs text-slate-400 mt-1 group-hover:text-slate-300">{desc}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ════════════════ STATS ════════════════ */}
      <section className="w-full bg-slate-900 border-y border-white/10 py-10 px-5 md:px-10 xl:px-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto text-center">
          {STATS.map(({ value, label }) => (
            <div key={label}>
              <div className="text-3xl md:text-4xl font-black text-sky-400">{value}</div>
              <div className="text-slate-400 text-sm mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════ ABOUT US ════════════════ */}
      <section className="w-full px-5 md:px-10 xl:px-16 py-20 bg-slate-950">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-12 items-start">
          <div className="md:w-1/2">
            <span className="text-xs font-bold uppercase tracking-widest text-sky-400 mb-3 block">About Us</span>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-5 leading-snug">
              Electromechanical Industrial Construction Since 2010
            </h2>
            <p className="text-slate-300 leading-relaxed mb-4">
              Encogroup is a global electromechanical industrial construction company headquartered in
              Lebanon. With over a decade of experience, we bring world-class engineering expertise to
              the Middle East, Gulf, Europe and Africa.
            </p>
            <p className="text-slate-400 leading-relaxed mb-6">
              Our portfolio spans EPC projects for structural steel, API 650/620 storage tanks,
              piping systems and power plants — delivered with precision, safety, and reliability.
            </p>
            <a
              href={`${BASE}/about-us`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition no-underline"
            >
              Learn More <span>→</span>
            </a>
          </div>
          <div className="md:w-1/2 grid grid-cols-2 gap-4">
            {[
              { icon: "🛡️", label: "Safety First", text: "Zero-compromise safety standards across all project sites." },
              { icon: "🌐", label: "Global Reach", text: "Operations across 4 continents and 10+ countries." },
              { icon: "📐", label: "Precision Engineering", text: "ISO-aligned processes and expert project management." },
              { icon: "🤝", label: "Trusted Partnerships", text: "Long-term relationships with global industrial leaders." },
            ].map(({ icon, label, text }) => (
              <div key={label} className="rounded-xl border border-white/10 bg-slate-900/70 p-5">
                <div className="text-2xl mb-2">{icon}</div>
                <div className="text-sm font-bold text-slate-100 mb-1">{label}</div>
                <div className="text-xs text-slate-400 leading-relaxed">{text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ OUR BUSINESS ════════════════ */}
      <section className="w-full px-5 md:px-10 xl:px-16 py-20 bg-slate-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-sky-400 mb-3 block">Our Business</span>
            <h2 className="text-3xl md:text-4xl font-black text-white">What We Do</h2>
            <p className="text-slate-400 mt-3 max-w-xl mx-auto text-sm">
              From EPC contracts to dealerships — a full-spectrum industrial service offering.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BUSINESSES.map(({ icon, title, desc }) => (
              <a
                key={title}
                href={`${BASE}/our-business`}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-6 hover:border-sky-400/40 hover:bg-slate-800/60 transition-all no-underline"
              >
                <span className="text-3xl">{icon}</span>
                <div className="text-sm font-bold text-slate-100 group-hover:text-white leading-snug">{title}</div>
                <div className="text-xs text-slate-400 group-hover:text-slate-300 leading-relaxed">{desc}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ WHERE WE WORK ════════════════ */}
      <section className="w-full px-5 md:px-10 xl:px-16 py-20 bg-slate-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-sky-400 mb-3 block">Where We Work</span>
            <h2 className="text-3xl md:text-4xl font-black text-white">Global Presence</h2>
            <p className="text-slate-400 mt-3 max-w-xl mx-auto text-sm">
              Encogroup operates across four continents, bringing industrial solutions wherever they are needed.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {REGIONS.map(({ label, countries }) => (
              <a
                key={label}
                href={`${BASE}/where-we-work`}
                target="_blank"
                rel="noreferrer"
                className="group rounded-2xl border border-white/10 bg-slate-900/60 p-6 hover:border-sky-400/40 hover:bg-slate-800/60 transition-all no-underline"
              >
                <div className="text-sky-400 text-xs font-bold uppercase tracking-widest mb-3">{label}</div>
                <ul className="space-y-1.5">
                  {countries.map((c) => (
                    <li key={c} className="text-slate-300 text-sm flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                      {c}
                    </li>
                  ))}
                </ul>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ DEALERSHIPS ════════════════ */}
      <section className="w-full px-5 md:px-10 xl:px-16 py-16 bg-slate-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-sky-400 mb-3 block">Authorised Dealerships</span>
            <h2 className="text-2xl md:text-3xl font-black text-white">Trusted Global Brands</h2>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {DEALERS.map((d) => (
              <span
                key={d}
                className="px-5 py-2.5 rounded-xl border border-white/15 bg-slate-800/60 text-slate-200 text-sm font-bold tracking-wider hover:border-sky-400/50 hover:text-white transition"
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ SUSTAINABILITY ════════════════ */}
      <section className="w-full px-5 md:px-10 xl:px-16 py-20 bg-slate-950">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-10">
          <div className="md:w-1/2">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3 block">Sustainability</span>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-5">
              Committed to a Safer,<br /> Greener Future
            </h2>
            <p className="text-slate-300 leading-relaxed mb-4">
              Encogroup integrates environmental responsibility and social governance into every
              project. From responsible material sourcing to minimising our environmental footprint,
              sustainability is a core pillar of our operations.
            </p>
            <a
              href={`${BASE}/sustainability`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition no-underline"
            >
              Our Commitment <span>→</span>
            </a>
          </div>
          <div className="md:w-1/2 grid grid-cols-1 gap-4">
            {[
              { icon: "🌱", label: "Environmental Stewardship", text: "Reducing our environmental footprint across all operations through responsible practices." },
              { icon: "👥", label: "Community Engagement", text: "Investing in local communities and workforce development programs." },
              { icon: "🏅", label: "Health & Safety", text: "Rigorous HSE standards ensuring safe working conditions on every site." },
            ].map(({ icon, label, text }) => (
              <div key={label} className="flex items-start gap-4 rounded-xl border border-white/10 bg-slate-900/70 p-5">
                <span className="text-2xl shrink-0">{icon}</span>
                <div>
                  <div className="text-sm font-bold text-slate-100 mb-1">{label}</div>
                  <div className="text-xs text-slate-400 leading-relaxed">{text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ FOOTER ════════════════ */}
      <footer className="w-full bg-slate-900 border-t border-white/10">
        {/* Main footer grid */}
        <div className="w-full px-5 md:px-10 xl:px-16 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src="/Logo - Copy.png" alt="Encogroup" className="h-10 w-auto object-contain opacity-90" />
              <div className="leading-none">
                <div className="text-white text-sm font-extrabold uppercase tracking-widest">Encogroup</div>
                <div className="text-slate-400 text-[10px] tracking-wider">Industrial Solutions</div>
              </div>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Electromechanical industrial construction company delivering reliable solutions across
              the Middle East, Gulf, Europe and Africa since 2010.
            </p>
            <div className="mt-4 flex gap-3">
              <a href={`${BASE}/contact-us`} target="_blank" rel="noreferrer"
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition no-underline">
                Contact Us
              </a>
              <a href={`${BASE}/join-us`} target="_blank" rel="noreferrer"
                className="px-4 py-2 rounded-lg border border-white/20 hover:border-sky-300/50 text-slate-300 hover:text-white text-xs font-bold transition no-underline">
                Join Us
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <div className="text-white text-sm font-bold uppercase tracking-wider mb-4">Quick Links</div>
            <ul className="space-y-2">
              {[
                { label: "Home",          href: BASE },
                { label: "About Us",      href: `${BASE}/about-us` },
                { label: "Our Business",  href: `${BASE}/our-business` },
                { label: "Where We Work", href: `${BASE}/where-we-work` },
                { label: "Sustainability",href: `${BASE}/sustainability` },
                { label: "News",          href: `${BASE}/news` },
              ].map(({ label, href }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noreferrer"
                    className="text-slate-400 hover:text-sky-300 text-xs transition no-underline">
                    → {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <div className="text-white text-sm font-bold uppercase tracking-wider mb-4">Company</div>
            <ul className="space-y-2">
              {[
                { label: "Privacy Policy",    href: `${BASE}/privacy-policy` },
                { label: "Disclaimers",       href: `${BASE}/disclaimers` },
                { label: "Terms & Conditions",href: `${BASE}/terms-conditions` },
                { label: "Careers",           href: `${BASE}/careers` },
                { label: "Contact Us",        href: `${BASE}/contact-us` },
              ].map(({ label, href }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noreferrer"
                    className="text-slate-400 hover:text-sky-300 text-xs transition no-underline">
                    → {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Offices */}
          <div>
            <div className="text-white text-sm font-bold uppercase tracking-wider mb-4">Our Offices</div>
            <ul className="space-y-2">
              {["Lebanon (HQ)", "KSA", "Bahrain", "UAE", "Sultanate of Oman", "Côte d'Ivoire", "Lithuania"].map((loc) => (
                <li key={loc} className="text-slate-400 text-xs flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                  {loc}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="w-full px-5 md:px-10 xl:px-16 py-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-slate-500 text-xs">© All rights reserved for Encogroup 2024</span>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span>Manpower Tracking Portal</span>
            <span className="mx-2">·</span>
            <span>Sohar Hub Program</span>
            <span className="mx-2">·</span>
            <a href={BASE} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300 no-underline transition">
              www.encogroup.net
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
