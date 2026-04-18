/**
 * Native `title` text for avatar hover — worker_profile from API plus entry fallbacks.
 * @param {Record<string, unknown>|null|undefined} profile
 * @param {Record<string, unknown>|null|undefined} entry
 */
export function formatWorkerProfileTooltip(profile, entry) {
  const p = profile && typeof profile === "object" ? profile : {};
  const name = String(p.name || entry?.worker_name || "").trim();
  const civil = String(p.civil_id || entry?.civil_id || "").trim();
  const company = String(p.company_name || entry?.company_name || "").trim();
  const desig = String(p.designation || entry?.designation || "").trim();
  const cat = String(p.category || entry?.category || "").trim();
  const email = String(p.email || "").trim();
  const parts = [
    name && `Name: ${name}`,
    civil && `Civil ID: ${civil}`,
    company && `Company: ${company}`,
    desig && `Designation: ${desig}`,
    cat && `Category: ${cat}`,
    email && `Email: ${email}`,
  ].filter(Boolean);
  return parts.length ? parts.join("\n") : "";
}
