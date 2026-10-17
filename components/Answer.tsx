"use client";

import { useState } from "react";
import { T } from "@/lib/i18n";
import type { Lang } from "@/lib/validation";
import type { AskResult } from "@/lib/client";

export function Answer({ result, lang }: { result: AskResult | null; lang: Lang }) {
  const [copied, setCopied] = useState(false);
  if (!result) return null;
  if (result.error) return <p className="error" role="alert">{result.error}</p>;

  const t = T[lang];
  const copy = () => {
    navigator.clipboard?.writeText(result.answer ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="card" aria-live="polite">
      {/* Rendered as plain text: React escapes it, never HTML. */}
      <p className="answer">{result.answer}</p>
      {result.sources && result.sources.length > 0 && (
        <>
          <p><strong>{t.sources}:</strong></p>
          <ul>
            {result.sources.map((s) => (
              <li key={s.link + s.name}>
                <a href={s.link} target="_blank" rel="noopener noreferrer">{s.name}</a>
              </li>
            ))}
          </ul>
        </>
      )}
      <button className="secondary" onClick={copy}>{copied ? t.copied : t.copy}</button>
    </div>
  );
}
