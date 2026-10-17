// Browser speech helpers: voice input and read-aloud for workers who find typing or reading hard.
// Both use built-in browser APIs (no extra service); buttons are hidden where unsupported.
import type { Lang } from "./validation";

export const SPEECH_LOCALE: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", pa: "pa-IN" };

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

export interface Recognizer {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognizerCtor = new () => Recognizer;

function recognizerCtor(): RecognizerCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canListen = () => recognizerCtor() !== null;
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Start voice input; calls onText with the full transcript so far. Returns the recognizer so it can be stopped. */
export function listen(lang: Lang, onText: (text: string) => void, onEnd: () => void): Recognizer | null {
  const Ctor = recognizerCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = SPEECH_LOCALE[lang];
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (e) => {
    const text = Array.from(e.results)
      .map((r) => r[0]?.transcript ?? "")
      .join(" ");
    onText(text.slice(0, 1000));
  };
  rec.onend = onEnd;
  rec.onerror = onEnd;
  rec.start();
  return rec;
}

/**
 * Find an installed voice for this language. Without one the browser falls back to
 * an English voice that skips Devanagari/Gurmukhi text, so we hide Read aloud instead.
 */
export function voiceFor(lang: Lang): SpeechSynthesisVoice | null {
  if (!canSpeak()) return null;
  const prefix = SPEECH_LOCALE[lang].split("-")[0].toLowerCase();
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase().replace("_", "-") === SPEECH_LOCALE[lang].toLowerCase()) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ??
    null
  );
}

/** Calls back whenever the browser's voice list loads or changes (it loads asynchronously). */
export function onVoicesChanged(callback: () => void): () => void {
  if (!canSpeak()) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", callback);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", callback);
}

export function speak(text: string, lang: Lang, onEnd: () => void) {
  const voice = voiceFor(lang);
  if (!voice) return onEnd();
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

/** WhatsApp share link (opens the app on phones). Text is URL-encoded; capped to keep the link valid. */
export function whatsappLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text.slice(0, 3000))}`;
}
