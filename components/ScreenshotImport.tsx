"use client";

import { useState } from "react";
import { T } from "@/lib/i18n";
import type { Lang } from "@/lib/validation";
import type { Earning } from "@/lib/earnings";
import { askGiggerIQ, prepareImage } from "@/lib/client";

interface Props {
  lang: Lang;
  onConfirm: (entries: Earning[]) => void;
}

/** Upload an earnings screenshot; Gemini extracts entries; the worker reviews before anything is saved. */
export function ScreenshotImport({ lang, onConfirm }: Props) {
  const t = T[lang];
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Earning[] | null>(null);
  const [error, setError] = useState("");

  const scan = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setFound(null);
    try {
      const image = await prepareImage(file);
      const res = await askGiggerIQ({ mode: "scan", lang, text: "", image });
      if (res.error) setError(res.error);
      else if (!res.entries?.length) setError(t.scanNone);
      else setFound(res.entries);
    } catch {
      setError(t.photoUnreadable);
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (found) onConfirm(found);
    setFound(null);
  };

  return (
    <section className="card" aria-label={t.scanTitle}>
      <label htmlFor="scan">{t.scanTitle}</label>
      <p className="muted">{t.scanHelp}</p>
      <input
        id="scan"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(e) => {
          scan(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {busy && <p className="muted" aria-live="polite">{t.scanning}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {found && (
        <div aria-live="polite">
          <p><strong>{t.scanFound}</strong></p>
          <ul className="entries">
            {found.map((x) => (
              <li key={x.id} className="entry">{x.date} · {x.platform} · Rs {x.amount} · {x.hours}h</li>
            ))}
          </ul>
          <div className="row">
            <button onClick={confirm}>{t.addAll}</button>
            <button className="secondary" onClick={() => setFound(null)}>{t.discard}</button>
          </div>
        </div>
      )}
    </section>
  );
}
