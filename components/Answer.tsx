"use client";

import { useEffect, useState } from "react";
import { T } from "@/lib/i18n";
import type { Lang } from "@/lib/validation";
import type { AskResult } from "@/lib/client";
import { canSpeak, speak, stopSpeaking, whatsappLink } from "@/lib/speech";

interface Props {
  result: AskResult | null;
  lang: Lang;
  /** Optional follow-up action, e.g. drafting a reply to an explained document. */
  onDraftReply?: (answer: string) => void;
}

export function Answer({ result, lang, onDraftReply }: Props) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  useEffect(() => setSpeechSupported(canSpeak()), []);
  useEffect(() => () => stopSpeaking(), [result]);

  if (!result) return null;
  if (result.error) return <p className="error" role="alert">{result.error}</p>;
  if (!result.answer) return null;

  const t = T[lang];
  const answer = result.answer;

  const copy = () => {
    navigator.clipboard?.writeText(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggleSpeech = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else {
      setSpeaking(true);
      speak(answer, lang, () => setSpeaking(false));
    }
  };

  return (
    <div className="card" aria-live="polite">
      {/* Rendered as plain text: React escapes it, never HTML. */}
      <p className="answer">{answer}</p>
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
      <div className="row">
        <button className="secondary" onClick={copy}>{copied ? t.copied : t.copy}</button>
        {speechSupported && (
          <button className="secondary" onClick={toggleSpeech} aria-pressed={speaking}>
            {speaking ? t.stop : t.readAloud}
          </button>
        )}
        <a className="button secondary" href={whatsappLink(answer)} target="_blank" rel="noopener noreferrer">
          {t.whatsapp}
        </a>
        {onDraftReply && <button onClick={() => onDraftReply(answer)}>{t.draftReply}</button>}
      </div>
    </div>
  );
}
