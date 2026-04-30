"""Canonical work-site location names (manpower entries, imports, analytics)."""


def normalize_work_location_name(raw: str) -> str:
    """
    Map synonyms to a single master name from `locations`:
    - Car parking, Parking area, Car park → Car parking
    - N/A, #N/A, dash placeholders → Common area
    Other values are returned unchanged (preserves casing for non-aliases).
    """
    s = (raw or "").strip()
    if not s:
        return ""
    sl = s.lower()
    if sl in ("#n/a", "n/a", "-", "—"):
        return "Common area"
    if sl in ("parking area", "car parking", "car park"):
        return "Car parking"
    return s


def migrate_stored_location_aliases(db) -> None:
    """
    Rewrite stored location strings to canonical names and drop obsolete master rows.
    Idempotent — safe to run on each init-db.
    """
    for canonical in ("Car parking", "Common area"):
        db.locations.update_one(
            {"name": canonical},
            {"$setOnInsert": {"name": canonical, "is_active": True}},
            upsert=True,
        )

    for coll_name, field in (
        ("work_entries", "location"),
        ("equipment_entries", "location"),
        ("equipment_details", "location"),
    ):
        coll = db[coll_name]
        for doc in coll.find({field: {"$exists": True, "$nin": [None, ""]}}, {field: 1}):
            old = doc.get(field) or ""
            new = normalize_work_location_name(old)
            if new and new != old:
                coll.update_one({"_id": doc["_id"]}, {"$set": {field: new}})

    for doc in db.incharge.find({"locations": {"$exists": True, "$ne": []}}):
        locs = doc.get("locations") or []
        seen: set[str] = set()
        new_locs: list[str] = []
        for loc in locs:
            n = normalize_work_location_name(loc or "")
            if not n or n in seen:
                continue
            seen.add(n)
            new_locs.append(n)
        if new_locs != locs:
            db.incharge.update_one({"_id": doc["_id"]}, {"$set": {"locations": new_locs}})

    for obsolete in ("Parking area", "parking area", "N/A", "#N/A"):
        canon = normalize_work_location_name(obsolete)
        if canon and canon != obsolete:
            db.locations.delete_many({"name": obsolete})
