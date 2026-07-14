// Facility picker — rebuild of the legacy BidirectionalHierarchyFilter's two
// levels (Business Unit / Location). Pick an existing site or add one inline
// (POST /api/energy/sites), which appends to the list and selects it.
"use client";

import { useState } from "react";
import { Field, Select, Input, Button } from "@/components/esg/ui";
import type { EnergySite } from "@/lib/energy/types";

export function HierarchyPicker({
  sites,
  value,
  onChange,
  onSitesChange,
}: {
  sites: EnergySite[];
  value: string | null;
  onChange: (siteId: string | null) => void;
  onSitesChange: (sites: EnergySite[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [bu, setBu] = useState("");
  const [loc, setLoc] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function addSite() {
    if (!bu.trim() || !loc.trim()) {
      setErr("Business unit and location are required");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/energy/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_unit: bu.trim(), location: loc.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add facility");
      const next = [...sites.filter((s) => s.id !== data.site.id), data.site];
      onSitesChange(next);
      onChange(data.site.id);
      setBu("");
      setLoc("");
      setAdding(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not add facility");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Field label="Facility" hint="Business Unit → Location" error={err ?? undefined}>
      <div className="flex gap-2">
        <Select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={adding}
        >
          <option value="">Organization level</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.business_unit} — {s.location}
            </option>
          ))}
        </Select>
        <Button type="button" variant="secondary" onClick={() => setAdding((v) => !v)}>
          {adding ? "Cancel" : "+ New"}
        </Button>
      </div>
      {adding && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Input placeholder="Business unit" value={bu} onChange={(e) => setBu(e.target.value)} className="flex-1" />
          <Input placeholder="Location" value={loc} onChange={(e) => setLoc(e.target.value)} className="flex-1" />
          <Button type="button" onClick={addSite} disabled={saving}>
            {saving ? "Adding…" : "Add"}
          </Button>
        </div>
      )}
    </Field>
  );
}
