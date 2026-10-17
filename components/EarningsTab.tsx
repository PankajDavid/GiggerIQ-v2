"use client";

import { useState } from "react";
import { T } from "@/lib/i18n";
import type { Lang } from "@/lib/validation";
import type { Earning } from "@/lib/earnings";
import { useEarnings, type EarningInput } from "@/lib/useEarnings";
import { askGiggerIQ, type AskResult } from "@/lib/client";
import { Answer } from "./Answer";

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): EarningInput => ({ date: today(), platform: "", amount: "", hours: "" });

export function EarningsTab({ lang }: { lang: Lang }) {
  const t = T[lang];
  const { entries, totals, save, remove } = useEarnings();
  const [form, setForm] = useState<EarningInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);

  const reset = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const error = save(form, editingId);
    setFormError(error ?? "");
    if (!error) reset();
  };

  const startEdit = (x: Earning) => {
    setEditingId(x.id);
    setForm({ date: x.date, platform: x.platform, amount: String(x.amount), hours: String(x.hours) });
  };

  const analyse = async () => {
    setBusy(true);
    setResult(await askGiggerIQ({ mode: "earnings", lang, entries }));
    setBusy(false);
  };

  const field = (key: keyof EarningInput) => ({
    id: key,
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
    required: true,
  });

  return (
    <>
      <form className="card" onSubmit={submit} noValidate>
        <label htmlFor="date">{t.date}</label>
        <input type="date" {...field("date")} />
        <label htmlFor="platform">{t.platform}</label>
        <input maxLength={40} {...field("platform")} />
        <label htmlFor="amount">{t.amount}</label>
        <input type="number" inputMode="decimal" min={0} max={100000} {...field("amount")} />
        <label htmlFor="hours">{t.hours}</label>
        <input type="number" inputMode="decimal" min={0} max={24} step="0.5" {...field("hours")} />
        {formError && <p className="error" role="alert">{formError}</p>}
        <div className="row">
          <button type="submit">{editingId ? t.save : t.add}</button>
          {editingId && <button type="button" className="secondary" onClick={reset}>{t.cancel}</button>}
        </div>
        <p className="muted">{t.storedNote}</p>
      </form>

      <section className="card" aria-label={t.total}>
        <div className="totals">
          <div><span className="muted">{t.total}</span><strong>Rs {totals.totalAmount}</strong></div>
          <div><span className="muted">{t.totalHours}</span><strong>{totals.totalHours}</strong></div>
          <div><span className="muted">{t.perHour}</span><strong>Rs {totals.perHour}</strong></div>
        </div>
        {entries.length === 0 ? (
          <p className="muted">{t.noEntries}</p>
        ) : (
          <ul className="entries">
            {entries.map((x) => (
              <li key={x.id} className="entry">
                <span>{x.date} · {x.platform} · Rs {x.amount} · {x.hours}h</span>
                <span className="row tight">
                  <button className="secondary" onClick={() => startEdit(x)} aria-label={`${t.edit} ${x.date} ${x.platform}`}>{t.edit}</button>
                  <button className="secondary" onClick={() => remove(x.id)} aria-label={`${t.del} ${x.date} ${x.platform}`}>{t.del}</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="row">
          <button onClick={analyse} disabled={busy || entries.length === 0}>{busy ? t.thinking : t.analyse}</button>
        </div>
      </section>
      <Answer result={result} lang={lang} />
    </>
  );
}
