"""
Conflict detection: when a new EF is committed, check if any existing EFs
cover the same (or similar) activity, overlapping validity period, and
same or broader geography.
"""
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from app.models.emission_factor import EmissionFactor
from app.models.audit_log import AuditLog, AuditAction
import uuid


SIMILARITY_THRESHOLD = 0.3  # pg_trgm similarity score — tune as needed


async def detect_conflicts(
    ef: EmissionFactor,
    db: AsyncSession,
    exclude_id: uuid.UUID | None = None,
) -> list[EmissionFactor]:
    """
    Return a list of EF records that potentially conflict with the given EF.
    Conflict criteria:
      - Similar canonical activity name (trigram similarity ≥ threshold)
      - Overlapping validity period (or both have no validity)
      - Same or broader geography
    """
    conditions = [
        EmissionFactor.is_current == True,
        EmissionFactor.is_superseded == False,
    ]
    if exclude_id:
        conditions.append(EmissionFactor.id != exclude_id)

    # Activity name similarity via pg_trgm
    conditions.append(
        func.similarity(EmissionFactor.canonical_activity_name, ef.canonical_activity_name) >= SIMILARITY_THRESHOLD
    )

    # Geography: conflict if existing record covers same or broader area
    geo_conditions = [EmissionFactor.geography_global == True]
    if ef.geography_global or ef.geography_country:
        if ef.geography_country:
            geo_conditions.append(EmissionFactor.geography_country == ef.geography_country)
    conditions.append(or_(*geo_conditions))

    result = await db.execute(select(EmissionFactor).where(and_(*conditions)).limit(20))
    candidates = result.scalars().all()

    # Filter by overlapping validity
    conflicts = []
    for candidate in candidates:
        if _validity_overlaps(ef, candidate):
            conflicts.append(candidate)
    return conflicts


def _validity_overlaps(a: EmissionFactor, b: EmissionFactor) -> bool:
    """Return True if the validity windows of a and b overlap (or either is open-ended)."""
    a_start = a.validity_start or date(1990, 1, 1)
    a_end = a.validity_end or date(2099, 12, 31)
    b_start = b.validity_start or date(1990, 1, 1)
    b_end = b.validity_end or date(2099, 12, 31)
    return a_start <= b_end and b_start <= a_end


async def detect_and_flag_conflicts(ef: EmissionFactor, db: AsyncSession) -> int:
    """
    Detect conflicts for a newly committed EF. Flag both the new EF and
    any conflicting existing records. Returns the count of conflicts found.
    """
    conflicts = await detect_conflicts(ef, db, exclude_id=ef.id)
    if not conflicts:
        return 0

    # Flag the new record
    ef.has_conflict = True

    # Flag all conflicting existing records
    for conflict in conflicts:
        conflict.has_conflict = True

    db.add(AuditLog(
        action=AuditAction.conflict_flagged,
        emission_factor_id=ef.id,
        details={"conflicting_ids": [str(c.id) for c in conflicts]},
    ))
    return len(conflicts)
