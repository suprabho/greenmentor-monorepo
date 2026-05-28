"""
Source-schema replacement for the legacy 4-criterion confidence score.

Source records carry a Pedigree-matrix DQ overall score (1=best, 5=worst) in
`dq_score_overall`, plus per-axis scores `dq_geographic_rep`, `dq_temporal_rep`,
`dq_tech_rep`. We expose those as the "score" surface; calculate_confidence is
kept as a thin compatibility shim that returns (score 0–100, breakdown dict)
so the existing routers / audit log calls don't break.
"""
from app.models.emission_factor import EmissionFactor


def calculate_confidence(ef: EmissionFactor, weights: dict) -> tuple[int, dict]:
    """
    Compatibility shim. Maps the source schema's 1–5 pedigree scores to a
    0–100 confidence percentage so legacy callers keep working. Higher is
    better in both directions (1 pedigree → 100 pts; 5 pedigree → 0 pts).
    """
    breakdown: dict[str, int] = {}

    def _ped_to_pct(v):
        if v is None:
            return None
        # Clamp to 1..5 then invert: 1→100, 2→80, 3→60, 4→40, 5→20.
        v = max(1, min(5, int(v)))
        return (6 - v) * 20

    if (overall := _ped_to_pct(ef.dq_score_overall)) is not None:
        breakdown["overall"] = overall
        total = overall
    else:
        # Average of per-axis scores when no overall is set.
        axes = [_ped_to_pct(getattr(ef, k)) for k in ("dq_geographic_rep", "dq_temporal_rep", "dq_tech_rep")]
        axes = [v for v in axes if v is not None]
        total = round(sum(axes) / len(axes)) if axes else 0

    if (geo := _ped_to_pct(ef.dq_geographic_rep)) is not None:
        breakdown["geographic_rep"] = geo
    if (tmp := _ped_to_pct(ef.dq_temporal_rep)) is not None:
        breakdown["temporal_rep"] = tmp
    if (tech := _ped_to_pct(ef.dq_tech_rep)) is not None:
        breakdown["tech_rep"] = tech
    breakdown["total"] = total
    return total, breakdown


def score_summary(breakdown: dict) -> str:
    parts = []
    for k, label in (("overall", "Overall"), ("geographic_rep", "Geo"),
                     ("temporal_rep", "Temporal"), ("tech_rep", "Tech")):
        if k in breakdown:
            parts.append(f"{label}: {breakdown[k]}%")
    return " | ".join(parts) + f" → Total: {breakdown.get('total', '?')}%"
