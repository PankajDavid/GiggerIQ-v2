"use client";

import { useEffect, useRef, useState } from "react";
import { T, MODE_LABELS } from "@/lib/i18n";
import type { Lang, Mode } from "@/lib/validation";
import { askGiggerIQ, prepareImage, type AskResult } from "@/lib/client";
import { Answer } from "./Answer";
import { canListen, listen, type Recognizer } from "@/lib/speech";

type AskMode = Exclude<Mode, "earnings" | "scan">;
const MAX_ORIGINAL_BYTES = 15 * 1024 * 1024; // before in-browser shrinking

export function AskTab({ lang }: { lang: Lang }) {
  const t = T[lang];
  const [mode, setMode] = useState<AskMode>("complaint");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognizer = useRef<Recognizer | null>(null);

  useEffect(() => setVoiceSupported(canListen()), []);

  const toggleVoice = () => {
    if (listening) {
      recognizer.current?.stop();
      return;
    }
    setListening(true);
    recognizer.current = listen(lang, setText, () => setListening(false));
    if (!recognizer.current) setListening(false);
  };

  /** Connected workflow: turn an explained document into a complaint/appeal draft. */
  const draftReply = (explanation: string) => {
    setMode("complaint");
    setResult(null);
    setText(`Help me write a reply or appeal to this notice. What the notice says: ${explanation}`.slice(0, 1000));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const chooseMode = (m: AskMode) => {
    setMode(m);
    setResult(null);
  };

  const buildImage = async () => {
    if (!file) throw new Error(t.photo);
    if (file.size > MAX_ORIGINAL_BYTES) throw new Error(t.photoTooBig);
    try {
      return await prepareImage(file);
    } catch {
      throw new Error(t.photoUnreadable);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const image = mode === "document" ? await buildImage() : undefined;
      setResult(await askGiggerIQ({ mode, lang, text, image }));
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : t.photoUnreadable });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form className="card" onSubmit={submit}>
        <fieldset className="plain">
          <legend className="muted">{t.ask}</legend>
          <div className="modes">
            {(Object.keys(MODE_LABELS[lang]) as AskMode[]).map((m) => (
              <button type="button" key={m} className="secondary" aria-pressed={mode === m} onClick={() => chooseMode(m)}>
                {MODE_LABELS[lang][m]}
              </button>
            ))}
          </div>
        </fieldset>
        {mode === "document" && (
          <>
            <label htmlFor="photo">{t.photo}</label>
            <input id="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </>
        )}
        <label htmlFor="question">{t.question}</label>
        <textarea id="question" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
        {voiceSupported && (
          <button type="button" className="secondary" onClick={toggleVoice} aria-pressed={listening}>
            {listening ? t.listening : `🎤 ${t.speak}`}
          </button>
        )}
        <p className="muted">{t.privacy}</p>
        <div className="row">
          <button type="submit" disabled={busy}>{busy ? t.thinking : t.send}</button>
        </div>
      </form>
      <Answer result={result} lang={lang} onDraftReply={mode === "document" ? draftReply : undefined} />
    </>
  );
}
