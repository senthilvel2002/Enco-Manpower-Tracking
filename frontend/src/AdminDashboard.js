import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiUrl } from "./api";
import WorkerAvatar from "./WorkerAvatar";

function AdminDashboard() {
  const { state } = useLocation();
  const [dashboard, setDashboard] = useState({
    summary: { total_workers: 0, total_entries: 0, today_entries: 0 },
    site_incharge_view: [],
    location_analytics: [],
    recent_entries: [],
  });

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await fetch(apiUrl("/api/admin/dashboard"));
        const data = await response.json();
        if (data.ok) {
          setDashboard(data);
        }
      } catch (error) {
        console.error("Failed to load dashboard", error);
      }
    };
    loadDashboard();
  }, []);

  return (
    <div
      className="admin-dashboard-page"
      style={{ "--page-bg-image": `url(${process.env.PUBLIC_URL}/sohar-oman.jpg)` }}
    >
      <header className="admin-topbar">
        <img src="/logo.png" alt="Company Logo" className="brand-logo dashboard-logo" />
        <div>
          <h1>Management Dashboard</h1>
          <p>
            Welcome, {state?.civilId || "Admin"} - Site Incharge and management
            views
          </p>
        </div>
        <Link to="/" className="back-link">
          Logout
        </Link>
      </header>

      <section className="dashboard-grid">
        <article className="metric-card">
          <h3>Total Workers</h3>
          <p>{dashboard.summary.total_workers}</p>
        </article>
        <article className="metric-card">
          <h3>Total Entries</h3>
          <p>{dashboard.summary.total_entries}</p>
        </article>
        <article className="metric-card">
          <h3>Today's Entries</h3>
          <p>{dashboard.summary.today_entries}</p>
        </article>
      </section>

      <section className="dashboard-panels">
        <article className="panel-card">
          <h3>Site Incharge View</h3>
          {dashboard.site_incharge_view.map((item) => (
            <div key={item.name} className="panel-row">
              <span>{item.name}</span>
              <strong>{item.entries}</strong>
            </div>
          ))}
        </article>

        <article className="panel-card">
          <h3>Location Analytics</h3>
          {dashboard.location_analytics.map((item) => (
            <div key={item.name} className="panel-row">
              <span>{item.name}</span>
              <strong>{item.entries}</strong>
            </div>
          ))}
        </article>
      </section>

      <section className="panel-card">
        <h3>Recent Work Entries</h3>
        <div className="entries-table">
          <div className="entries-head">
            <span>Worker</span>
            <span>Company</span>
            <span>Location</span>
            <span>Incharge</span>
            <span>Date</span>
          </div>
          {dashboard.recent_entries.map((entry) => (
            <div className="entries-row" key={entry._id}>
              <span className="inline-flex items-center gap-2 min-w-0">
                <WorkerAvatar
                  name={entry.worker_name}
                  civilId={entry.civil_id}
                  profilePicture={entry.profile_picture}
                  sizeClass="w-7 h-7"
                />
                <span>{entry.worker_name}</span>
              </span>
              <span>{entry.company_name}</span>
              <span>{entry.location}</span>
              <span>{entry.incharge}</span>
              <span>{entry.work_date}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default AdminDashboard;
