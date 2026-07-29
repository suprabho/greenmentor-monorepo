"use client";

import { useState, type ReactNode } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import { Card } from "@/components/ui";
import { Button } from "@/components/marketing-ui/Button";

interface EditableSectionProps {
  title: string;
  /** Read-only rendering of the current value. */
  summary: ReactNode;
  /** The form, shown in place of the summary while editing. */
  children: ReactNode;
  /** Return false to keep the editor open (e.g. client-side validation failed). */
  onSave: () => Promise<boolean>;
  /** Called when the user cancels, so the section can drop its local edits. */
  onCancel?: () => void;
  saveDisabled?: boolean;
}

/**
 * One self-contained editable block on /profile. Each section saves on its own
 * so a failure in one doesn't discard edits in another, and so the PATCH stays
 * a genuine partial update.
 */
export function EditableSection({
  title,
  summary,
  children,
  onSave,
  onCancel,
  saveDisabled = false,
}: EditableSectionProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (await onSave()) setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    onCancel?.();
    setError(null);
    setEditing(false);
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-pill border border-gray-200 px-3 py-1.5 text-[12.5px] font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
          >
            <PencilSimple size={13} weight="bold" />
            Edit
          </button>
        )}
      </div>

      <div className="mt-4">{editing ? children : summary}</div>

      {error && (
        <p role="alert" className="mt-3 rounded-[6px] bg-red-50 px-3 py-2 text-[12.5px] text-danger">
          {error}
        </p>
      )}

      {editing && (
        <div className="mt-5 flex items-center gap-2 border-t border-gray-100 pt-4">
          <Button size="sm" onClick={handleSave} loading={saving} disabled={saveDisabled}>
            Save
          </Button>
          <Button size="sm" variant="ghost-light" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      )}
    </Card>
  );
}
