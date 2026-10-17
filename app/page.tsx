"use client";

import { useState } from "react";
import { T, LANG_NAMES } from "@/lib/i18n";
import { LANGS, type Lang } from "@/lib/validation";
import { AskTab } from "@/components/AskTab";
import { EarningsTab } from "@/components/EarningsTab";

type Tab = "ask" | "earnings";

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
  const [tab, setTab] = useState<Tab>("ask");
  const t = T[lang];

  return (
    <main lang={lang}>
      <header>
        <div>
          <h1>GiggerIQ</h1>
          <p className="tagline">{t.tagline}</p>
        </div>
        <div>
          <label htmlFor="lang" className="muted inline">{t.language}</label>
          <select id="lang" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
          </select>
        </div>
      </header>
      <nav className="tabs" aria-label="Sections">
        <button className="secondary" aria-pressed={tab === "ask"} onClick={() => setTab("ask")}>{t.ask}</button>
        <button className="secondary" aria-pressed={tab === "earnings"} onClick={() => setTab("earnings")}>{t.earnings}</button>
      </nav>
      {tab === "ask" ? <AskTab lang={lang} /> : <EarningsTab lang={lang} />}
    </main>
  );
}
