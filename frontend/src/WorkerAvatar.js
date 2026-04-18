/**
 * Avatar for workers: uses profile_picture when present, else initial letter.
 * @param {object} props
 * @param {string} [props.name]
 * @param {string} [props.civilId]
 * @param {string} [props.profilePicture] — data URL from API
 * @param {string} [props.sizeClass]
 * @param {string} [props.textClass]
 * @param {"full"|"xl"} [props.rounded]
 * @param {string} [props.title] — native tooltip (e.g. full worker profile on hover)
 */
export default function WorkerAvatar({
  name,
  civilId,
  profilePicture,
  sizeClass = "w-8 h-8",
  textClass = "text-xs font-bold",
  rounded = "full",
  title,
}) {
  const initial = String(name || civilId || "?")
    .trim()
    .slice(0, 1)
    .toUpperCase();
  const roundCls = rounded === "xl" ? "rounded-xl" : "rounded-full";
  const tip = title || undefined;
  if (profilePicture) {
    return (
      <img
        src={profilePicture}
        alt=""
        title={tip}
        className={`${sizeClass} ${roundCls} object-cover border border-white/15 shrink-0 bg-slate-800 cursor-default`}
      />
    );
  }
  return (
    <div
      title={tip}
      className={`${sizeClass} ${roundCls} bg-slate-600/50 border border-white/10 flex items-center justify-center text-slate-200 ${textClass} shrink-0 cursor-default`}
    >
      {initial}
    </div>
  );
}
