"use client";

import { useEffect, useMemo, useState } from "react";
import { computeTotals, earningSchema, parseStoredEarnings, MAX_ENTRIES, type Earning } from "./earnings";

const STORAGE_KEY = "giggeriq-earnings";

export interface EarningInput {
  date: string;
  platform: string;
  amount: string;
  hours: string;
}

/** Earnings state persisted to localStorage, validated on every read and write. */
export function useEarnings() {
  const [entries, setEntries] = useState<Earning[]>([]);

  useEffect(() => {
    try {
      setEntries(parseStoredEarnings(localStorage.getItem(STORAGE_KEY)));
    } catch {
      /* storage blocked: start empty */
    }
  }, []);

  const persist = (next: Earning[]) => {
    const sorted = [...next].sort((a, b) => a.date.localeCompare(b.date));
    setEntries(sorted);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    } catch {
      /* storage blocked: keep in memory */
    }
  };

  /** Returns an error message, or null on success. */
  const save = (input: EarningInput, editingId: string | null): string | null => {
    const parsed = earningSchema.safeParse({
      id: editingId ?? crypto.randomUUID(),
      date: input.date,
      platform: input.platform,
      amount: Number(input.amount),
      hours: Number(input.hours),
    });
    if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid entry";
    if (!editingId && entries.length >= MAX_ENTRIES) return `Limit of ${MAX_ENTRIES} entries reached`;

    persist(editingId ? entries.map((e) => (e.id === editingId ? parsed.data : e)) : [...entries, parsed.data]);
    return null;
  };

  const remove = (id: string) => persist(entries.filter((e) => e.id !== id));
  const totals = useMemo(() => computeTotals(entries), [entries]);

  return { entries, totals, save, remove };
}
