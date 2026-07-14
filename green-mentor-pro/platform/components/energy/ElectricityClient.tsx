// Electricity (Scope 2) data entry: add-entry form + entries table with maker–
// checker actions. The server nets out solar export and computes tCO2e on submit.
"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { Card, Chip, PageHeader } from "@/components/ui";
import { Field, Input, Select, Button, Table, Th, Td } from "@/components/esg/ui";
import { HierarchyPicker } from "./HierarchyPicker";
import { EvidenceUpload, type EvidenceFile } from "./EvidenceUpload";
import { StatusBadge } from "./StatusBadge";
import { ApprovalActions } from "./ApprovalActions";
import type { EnergyMasters, EnergySite, ElectricityEntry } from "@/lib/energy/types";

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number | null, d = 3) => (n == null ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: d }));
const OTHER = "__other__";

const EMPTY = {
  site_id: null as string | null,
  bill_date: today(),
  bill_start: "",
  bill_end: "",
  electricity_source_id: "",
  transaction_type: "",
  board_select: "",
  board_custom: "",
  unit_used: "",
  unit_id: "",
  solar_export_kwh: "",
  amount_paid: "",
  currency_id: "",
  manual_ef: "",
};

export function ElectricityClient({
  masters,
  initialSites,
  initialEntries,
  canReview,
}: {
  masters: EnergyMasters;
  initialSites: EnergySite[];
  initialEntries: ElectricityEntry[];
  canReview: boolean;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [sites, setSites] = useState(initialSites);
  const [form, setForm] = useState(EMPTY);
  const [evidence, setEvidence] = useState<EvidenceFile[]>([]);
  const [showForm, setShowForm] = useState(initialEntries.length === 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elecUnits = masters.units.filter((u) => u.kind === "electricity" || u.kind === "both");
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function refresh() {
    const res = await fetch("/api/energy/electricity");
    if (res.ok) setEntries((await res.json()).entries);
  }

  async function submit() {
    if (!form.electricity_source_id || !form.unit_used) {
      setError("Electricity source and units (kWh) are required");
      return;
    }
    const board = form.board_select === OTHER ? form.board_custom.trim() : form.board_select;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/energy/electricity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: form.site_id,
          bill_date: form.bill_date,
          bill_start: form.bill_start || null,
          bill_end: form.bill_end || null,
          electricity_source_id: form.electricity_source_id,
          transaction_type: form.transaction_type || null,
          electricity_board: board || null,
          unit_used: form.unit_used,
          unit_id: form.unit_id || null,
          solar_export_kwh: form.solar_export_kwh || null,
          amount_paid: form.amount_paid || null,
          currency_id: form.currency_id || null,
          manual_ef: form.manual_ef || null,
          evidence_paths: evidence.map((e) => e.path),
        }),
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
    const res = await fetch(`/api/energy/electricity/${id}`, { method: "DELETE" });
    if (res.ok) setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const siteLabel = (id: string | null) => {
    const s = sites.find((x) => x.id === id);
    return s ? `${s.business_unit} — ${s.location}` : "Org level";
  };

  return (
    <div>
      <PageHeader
        title="Electricity — Scope 2"
        sub="Grid and self-generated electricity. On-site solar export is netted out; renewable sources carry a zero factor."
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
            <Field label="Billing period">
              <div className="flex gap-2">
                <Input type="date" value={form.bill_start} onChange={(e) => set({ bill_start: e.target.value })} />
                <Input type="date" min={form.bill_start || undefined} value={form.bill_end} onChange={(e) => set({ bill_end: e.target.value })} />
              </div>
            </Field>
            <Field label="Electricity source" required>
              <Select value={form.electricity_source_id} onChange={(e) => set({ electricity_source_id: e.target.value })}>
                <option value="">Select…</option>
                {masters.electricitySources.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Transaction type">
              <Select value={form.transaction_type} onChange={(e) => set({ transaction_type: e.target.value })}>
                <option value="">Select…</option>
                {masters.transactionTypes.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Electricity board (DISCOM)">
              <Select value={form.board_select} onChange={(e) => set({ board_select: e.target.value })}>
                <option value="">Select…</option>
                {masters.electricityBoards.map((b) => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
                <option value={OTHER}>Other…</option>
              </Select>
              {form.board_select === OTHER && (
                <Input className="mt-2" placeholder="Board name" value={form.board_custom} onChange={(e) => set({ board_custom: e.target.value })} />
              )}
            </Field>
            <Field label="Units consumed (kWh)" required>
              <Input type="number" step="0.01" min="0" value={form.unit_used} onChange={(e) => set({ unit_used: e.target.value })} />
            </Field>
            <Field label="Unit">
              <Select value={form.unit_id} onChange={(e) => set({ unit_id: e.target.value })}>
                <option value="">kWh</option>
                {elecUnits.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Solar export (kWh)" hint="Netted out of Scope 2">
              <Input type="number" step="0.01" min="0" value={form.solar_export_kwh} onChange={(e) => set({ solar_export_kwh: e.target.value })} />
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
            <Field label="Emission factor override" hint="kg CO2e per kWh — leave blank to auto-lookup">
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
              <Th>Source</Th>
              <Th>Txn</Th>
              <Th className="text-right">kWh</Th>
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
              <Td className="max-w-[160px] truncate">{siteLabel(e.site_id)}</Td>
              <Td className="text-ink">
                {e.electricity_source_name ?? "—"}
                {e.source_type === "Renewable" && <Chip tone="green" className="ml-1.5">RE</Chip>}
              </Td>
              <Td>{e.transaction_type ?? "—"}</Td>
              <Td className="text-right">{fmt(e.unit_used)}</Td>
              <Td className="text-right" title={e.calc_formula ?? undefined}>{fmt(e.emission_factor, 4)}</Td>
              <Td className="text-right font-semibold text-ink">{fmt(e.tco2e)}</Td>
              <Td><StatusBadge status={e.status} comment={e.comment} /></Td>
              <Td className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {canReview && e.status === "Submitted" && (
                    <ApprovalActions kind="electricity" id={e.id} onDone={refresh} />
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
