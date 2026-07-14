// Fuel (Scope 1) data entry: add-entry form + entries table with maker–checker
// actions. Plain useState + fetch (the platform's form convention). The server
// resolves the emission factor and computes tCO2e on submit; we render what
// comes back.
"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { Card, Chip, PageHeader } from "@/components/ui";
import { Field, Input, Select, Button, Table, Th, Td } from "@/components/esg/ui";
import { HierarchyPicker } from "./HierarchyPicker";
import { EvidenceUpload, type EvidenceFile } from "./EvidenceUpload";
import { StatusBadge } from "./StatusBadge";
import { ApprovalActions } from "./ApprovalActions";
import type { EnergyMasters, EnergySite, FuelEntry } from "@/lib/energy/types";

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number | null, d = 3) => (n == null ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: d }));

const EMPTY = {
  site_id: null as string | null,
  bill_date: today(),
  fuel_type_id: "",
  use_type_id: "",
  quantity: "",
  unit_id: "",
  amount_paid: "",
  currency_id: "",
  heat_content: "",
  manual_ef: "",
};

export function FuelClient({
  masters,
  initialSites,
  initialEntries,
  canReview,
}: {
  masters: EnergyMasters;
  initialSites: EnergySite[];
  initialEntries: FuelEntry[];
  canReview: boolean;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [sites, setSites] = useState(initialSites);
  const [form, setForm] = useState(EMPTY);
  const [evidence, setEvidence] = useState<EvidenceFile[]>([]);
  const [showForm, setShowForm] = useState(initialEntries.length === 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fuelUnits = masters.units.filter((u) => u.kind === "fuel" || u.kind === "both");
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function refresh() {
    const res = await fetch("/api/energy/fuel");
    if (res.ok) setEntries((await res.json()).entries);
  }

  async function submit() {
    if (!form.fuel_type_id || !form.quantity) {
      setError("Fuel type and quantity are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/energy/fuel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, evidence_paths: evidence.map((e) => e.path) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save entry");
      setEntries((prev) => [data.entry, ...prev]);
      setForm({ ...EMPTY, bill_date: today() });
      setEvidence([]);
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save entry");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this entry?")) return;
    const res = await fetch(`/api/energy/fuel/${id}`, { method: "DELETE" });
    if (res.ok) setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const siteLabel = (id: string | null) => {
    const s = sites.find((x) => x.id === id);
    return s ? `${s.business_unit} — ${s.location}` : "Org level";
  };

  return (
    <div>
      <PageHeader
        title="Fuel — Scope 1"
        sub="Stationary & mobile combustion. The emission factor is looked up automatically; override it if you have a bill-specific value."
        action={
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus size={15} weight="bold" /> Add entry
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6 p-5">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <HierarchyPicker
              sites={sites}
              value={form.site_id}
              onChange={(site_id) => set({ site_id })}
              onSitesChange={setSites}
            />
            <Field label="Bill date" required>
              <Input type="date" max={today()} value={form.bill_date} onChange={(e) => set({ bill_date: e.target.value })} />
            </Field>
            <Field label="Fuel type" required>
              <Select value={form.fuel_type_id} onChange={(e) => set({ fuel_type_id: e.target.value })}>
                <option value="">Select…</option>
                {masters.fuelTypes.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Use type">
              <Select value={form.use_type_id} onChange={(e) => set({ use_type_id: e.target.value })}>
                <option value="">Select…</option>
                {masters.useTypes.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Quantity consumed" required>
              <Input type="number" step="0.0001" min="0" value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} />
            </Field>
            <Field label="Unit">
              <Select value={form.unit_id} onChange={(e) => set({ unit_id: e.target.value })}>
                <option value="">Select…</option>
                {fuelUnits.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Amount paid">
              <Input type="number" step="0.01" min="0" value={form.amount_paid} onChange={(e) => set({ amount_paid: e.target.value })} />
            </Field>
            <Field label="Currency">
              <Select value={form.currency_id} onChange={(e) => set({ currency_id: e.target.value })}>
                <option value="">Select…</option>
                {masters.currencies.map((c) => (
                  <option key={c.id} value={c.id}>{c.code}</option>
                ))}
              </Select>
            </Field>
            <Field label="Emission factor override" hint="kg CO2e per unit — leave blank to auto-lookup">
              <Input type="number" step="0.0001" min="0" value={form.manual_ef} onChange={(e) => set({ manual_ef: e.target.value })} />
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
              <Th>Bill date</Th>
              <Th>Facility</Th>
              <Th>Fuel</Th>
              <Th>Source</Th>
              <Th className="text-right">Quantity</Th>
              <Th className="text-right">EF</Th>
              <Th className="text-right">tCO₂e</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </>
          }
        >
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-gray-100 last:border-0">
              <Td>{e.bill_date}</Td>
              <Td className="max-w-[180px] truncate">{siteLabel(e.site_id)}</Td>
              <Td className="text-ink">{e.fuel_type_name ?? "—"}</Td>
              <Td>
                {e.source_type ? (
                  <Chip tone={e.source_type === "Renewable" ? "green" : "neutral"}>{e.source_type}</Chip>
                ) : "—"}
              </Td>
              <Td className="text-right">{fmt(e.quantity)} {e.unit_name ?? ""}</Td>
              <Td className="text-right" title={e.calc_formula ?? undefined}>{fmt(e.emission_factor, 4)}</Td>
              <Td className="text-right font-semibold text-ink">{fmt(e.tco2e)}</Td>
              <Td><StatusBadge status={e.status} comment={e.comment} /></Td>
              <Td className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {canReview && e.status === "Submitted" && (
                    <ApprovalActions kind="fuel" id={e.id} onDone={refresh} />
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
