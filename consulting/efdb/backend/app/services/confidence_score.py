"""
Rule-based confidence score calculation.
All logic is deterministic — given the same EF record and the same weight config,
you always get the same score. This makes scores auditable and explainable.
"""
from datetime import date
from app.models.emission_factor import EmissionFactor


def calculate_confidence(ef: EmissionFactor, weights: dict) -> tuple[int, dict]:
    """
    Calculate the confidence score for an emission factor record.

    Returns:
        (score: int 0–100, breakdown: dict with per-criterion points)
    """
    breakdown = {}
    total = 0

    # ── 1. Source type ─────────────────────────────────────────────────────
    st_config = weights.get("source_type", {})
    st_values = st_config.get("values", {})
    st_max = st_config.get("max_points", 35)
    if ef.source_type:
        source_type_str = ef.source_type if isinstance(ef.source_type, str) else ef.source_type.value
        source_pts = st_values.get(source_type_str, 5)
    else:
        source_pts = 0
    source_pts = min(source_pts, st_max)
    breakdown["source_type"] = source_pts
    total += source_pts

    # ── 2. Audited / peer-reviewed ─────────────────────────────────────────
    aud_config = weights.get("audited", {})
    aud_max = aud_config.get("max_points", 20)
    # Infer audit status from source type
    audited_types = {"Government / Regulatory body", "Intergovernmental body", "Peer-reviewed publication"}
    published_types = {"GHG Protocol / Industry standard", "Commercial LCA database export", "Industry association"}
    source_type_str = (ef.source_type if isinstance(ef.source_type, str) else ef.source_type.value) if ef.source_type else ""
    if source_type_str in audited_types:
        aud_pts = aud_config.get("audited", 20)
    elif source_type_str in published_types:
        aud_pts = aud_config.get("published", 10)
    else:
        aud_pts = aud_config.get("none", 0)
    aud_pts = min(aud_pts, aud_max)
    breakdown["audited"] = aud_pts
    total += aud_pts

    # ── 3. Geography specificity ───────────────────────────────────────────
    geo_config = weights.get("geography", {})
    geo_max = geo_config.get("max_points", 25)
    if ef.geography_region:
        geo_pts = geo_config.get("country_region", 25)
    elif ef.geography_country:
        geo_pts = geo_config.get("country", 20)
    elif ef.geography_global:
        geo_pts = geo_config.get("global", 5)
    else:
        geo_pts = geo_config.get("global", 5)
    geo_pts = min(geo_pts, geo_max)
    breakdown["geography"] = geo_pts
    total += geo_pts

    # ── 4. Data recency ────────────────────────────────────────────────────
    rec_config = weights.get("recency", {})
    rec_max = rec_config.get("max_points", 20)
    decay = rec_config.get("points_per_year_decay", 2)
    today = date.today()
    if ef.validity_end:
        ref_date = ef.validity_end
    elif ef.validity_start:
        ref_date = ef.validity_start
    else:
        ref_date = None

    if ref_date:
        years_old = max(0, (today.year - ref_date.year))
        rec_pts = max(0, rec_max - years_old * decay)
    else:
        rec_pts = 0
    rec_pts = min(rec_pts, rec_max)
    breakdown["recency"] = rec_pts
    total += rec_pts

    total = min(total, 100)
    breakdown["total"] = total
    return total, breakdown


def score_summary(breakdown: dict) -> str:
    """Human-readable explanation of a confidence score breakdown."""
    parts = []
    if "source_type" in breakdown:
        parts.append(f"Source type: {breakdown['source_type']} pts")
    if "audited" in breakdown:
        parts.append(f"Audited/published: {breakdown['audited']} pts")
    if "geography" in breakdown:
        parts.append(f"Geography specificity: {breakdown['geography']} pts")
    if "recency" in breakdown:
        parts.append(f"Data recency: {breakdown['recency']} pts")
    return " | ".join(parts) + f" → Total: {breakdown.get('total', '?')}%"
