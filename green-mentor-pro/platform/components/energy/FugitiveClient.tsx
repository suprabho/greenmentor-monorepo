// Fugitive (Scope 1) data entry: 5 estimation methods behind a tab switch, one
// config-driven form, plus the entries table with maker–checker actions. The
// server resolves GWP + equipment leak rate and computes released mass → tCO2e.
"use client";

import { useMemo, useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { Card, PageHeader } from "@/components/ui";
import { Field, Input, Select, Button, Table, Th, Td } from "@/components/esg/ui";
import { HierarchyPicker } from "./HierarchyPicker";
import { EvidenceUpload, type EvidenceFile } from "./EvidenceUpload";
import { StatusBadge } from "./StatusBadge";
import { ApprovalActions } from "./ApprovalActions";
import type { EnergySite, FugitiveEntry, FugitiveMasters } from "@/lib/energy/types";

const fmt = (n: number | null, d = 3) => (n == null ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: d }));

// Per-method numeric fields (keys match lib/energy/schema.ts fugitiveEntrySchema).
type NumField = { key: string; label: string };
const METHODS: { id: number; label: string; equipment?: "refrigeration" | "fire"; fields: NumField[] }[] = [
  {
    id: 1, label: "Screening", equipment: "refrigeration",
    fields: [
      { key: "refrigerant_capacity", label: "Refrigerant capacity (kg)" },
      { key: "amount_refrigerant_charged", label: "Refrigerant charged (kg)" },
    ],
  },
  {
    id: 2, label: "Purchased gases",
    fields: [
      { key: "reporting_year", label: "Reporting year" },
      { key: "quantity_purchased", label: "Quantity purchased (kg)" },
    ],
  },
  {
    id: 3, label: "Material balance",
    fields: [
      { key: "reporting_year", label: "Reporting year" },
      { key: "inventory_start", label: "Inventory start (kg)" },
      { key: "inventory_end", label: "Inventory end (kg)" },
      { key: "purchased", label: "Purchased (kg)" },
      { key: "disposed", label: "Disposed (kg)" },
    ],
  },
  {
    id: 4, label: "Simplified balance",
    fields: [
      { key: "reporting_year", label: "Reporting year" },
      { key: "service_refrigerant_purchases", label: "Service purchases (kg)" },
      { key: "retiring_equipment_capacity", label: "Retiring capacity (kg)" },
      { key: "recovered_refrigerant", label: "Recovered (kg)" },
      { key: "new_equipment_capacity", label: "New equipment capacity (kg)" },
      { key: "new_equipment_refrigerant_purchases", label: "New equipment charge (kg)" },
    ],
  },
  {
    id: 5, label: "Fire suppression", equipment: "fire",
    fields: [
      { key: "reporting_year", label: "Reporting year" },
      { key: "suppressant_capacity", label: "Suppressant capacity (kg)" },
      { key: "number_of_units", label: "Number of units" },
      { key: "emission_factor", label: "Emission factor (0–1, blank = equipment default)" },
    ],
  },
];

export function FugitiveClient({
  masters,
  initialSites,
  initialEntries,
  canReview,
}: {
  masters: FugitiveMasters;
  initialSites: EnergySite[];
  initialEntries: FugitiveEntry[];
  canReview: boolean;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [sites, setSites] = useState(initialSites);
  const [method, setMethod] = useState(1);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [gas, setGas] = useState("");
  const [source, setSource] = useState("");
  const [equipment, setEquipment] = useState("");
  const [unitId, setUnitId] = useState("");
  const [nums, setNums] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState<EvidenceFile[]>([]);
  const [showForm, setShowForm] = useState(initialEntries.length === 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cfg = METHODS.find((m) => m.id === method)!;
  const gasSources = useMemo(() => masters.gases.find((g) => g.gas === gas)?.sources ?? [], [masters.gases, gas]);
  const gwpPreview = gasSources.find((s) => s.source === source)?.gwp ?? null;

  function reset() {
    setSiteId(null); setGas(""); setSource(""); setEquipment(""); setUnitId(""); setNums({}); setEvidence([]);
  }

  async function refresh() {
    const res = await fetch("/api/energy/fugitive");
    if (res.ok) setEntries((await res.json()).entries);
  }

  async function submit() {
    if (!gas || !source) {
      setError("Gas and GWP source are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        method,
        site_id: siteId,
        gas,
        database_source: source,
        equipment_type: equipment || null,
        unit_id: unitId || null,
        evidence_paths: evidence.map((e) => e.path),
      };
      for (const f of cfg.fields) if (nums[f.key] !== undefined && nums[f.key] !== "") payload[f.key] = nums[f.key];
      const res = await fetch("/api/energy/fugitive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save entry");
      setEntries((prev) => [data.entry, ...prev]);
      reset();
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save entry");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this entry?")) return;
    const res = await fetch(`/api/energy/fugitive/${id}`, { method: "DELETE" });
    if (res.ok) setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const siteLabel = (id: string | null) => {
    const s = sites.find((x) => x.id === id);
    return s ? `${s.business_unit} — ${s.location}` : "Org level";
  };
  const equipmentOptions = cfg.equipment === "fire" ? masters.fireEquipment : masters.refrigerationEquipment;

  return (
    <div>
      <PageHeader
        title="Fugitive Emission — Scope 1"
        sub="Refrigerant and fire-suppressant losses. Pick an estimation method; CO₂e = released mass × the gas's GWP-100."
        action={
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus size={15} weight="bold" /> Add entry
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6 p-5">
          {/* Method tabs */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { setMethod(m.id); setEquipment(""); setNums({}); }}
                className={
                  "rounded-pill px-3 py-1.5 text-[12.5px] font-semibold transition-colors " +
                  (method === m.id ? "bg-teal-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")
                }
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <HierarchyPicker sites={sites} value={siteId} onChange={setSiteId} onSitesChange={setSites} />

            <Field label={method === 5 ? "Suppressant gas" : "Refrigerant type"} required>
              <Select value={gas} onChange={(e) => { setGas(e.target.value); setSource(""); }}>
                <option value="">Select…</option>
                {masters.gases.map((g) => (
                  <option key={g.gas} value={g.gas}>{g.gas}</option>
                ))}
              </Select>
            </Field>

            <Field label="Database source for GWP" required hint={gwpPreview != null ? `GWP-100 = ${gwpPreview}` : undefined}>
              <Select value={source} onChange={(e) => setSource(e.target.value)} disabled={!gas}>
                <option value="">Select…</option>
                {gasSources.map((s) => (
                  <option key={s.source} value={s.source}>{s.source}</option>
                ))}
              </Select>
            </Field>

            {cfg.equipment && (
              <Field label={cfg.equipment === "fire" ? "Equipment type" : "Refrigeration equipment"}>
                <Select value={equipment} onChange={(e) => setEquipment(e.target.value)}>
                  <option value="">Select…</option>
                  {equipmentOptions.map((eq) => (
                    <option key={eq.id} value={eq.name}>{eq.name}</option>
                  ))}
                </Select>
              </Field>
            )}

            {cfg.fields.map((f) => (
              <Field key={f.key} label={f.label}>
                <Input
                  type="number"
                  step="0.0001"
                  value={nums[f.key] ?? ""}
                  onChange={(e) => setNums((n) => ({ ...n, [f.key]: e.target.value }))}
                />
              </Field>
            ))}

            <Field label="Unit">
              <Select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                <option value="">kg</option>
                {masters.units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Select>
            </Field>

            <EvidenceUpload files={evidence} onChange={setEvidence} />
          </div>
          {error && <p className="mt-3 text-[12.5px] font-medium text-danger">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Submit entry"}</Button>
          </div>
        </Card>
      )}

      <Card className="p-1.5">
        <Table
          empty={entries.length === 0}
          head={
            <>
              <Th>Method</Th>
              <Th>Facility</Th>
              <Th>Gas</Th>
              <Th className="text-right">GWP</Th>
              <Th className="text-right">Released (kg)</Th>
              <Th className="text-right">tCO₂e</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </>
          }
        >
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-gray-100 last:border-0">
              <Td className="text-ink">{e.method_label ?? `Method ${e.method}`}</Td>
              <Td className="max-w-[150px] truncate">{siteLabel(e.site_id)}</Td>
              <Td>{e.gas ?? "—"}</Td>
              <Td className="text-right">{fmt(e.gwp, 0)}</Td>
              <Td className="text-right" title={e.calc_formula ?? undefined}>{fmt(e.released_kg)}</Td>
              <Td className="text-right font-semibold text-ink">{fmt(e.tco2e)}</Td>
              <Td><StatusBadge status={e.status} comment={e.comment} /></Td>
              <Td className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {canReview && e.status === "Submitted" && (
                    <ApprovalActions kind="fugitive" id={e.id} onDone={refresh} />
                  )}
                  <Button variant="ghost" className="px-2 py-1 text-gray-400 hover:text-danger" onClick={() => remove(e.id)}>
                    Delete
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
