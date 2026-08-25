import type { BusinessDnaLanguage } from "@/app/lib/business-dna";

export type SpeechRecognitionResultLike = { [index: number]: { transcript: string }; length: number };
export type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
export type SpeechRecognitionErrorLike = { error?: string };
export type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
};
export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
export type SpeechBrowser = typeof window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
  SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
};

export function speechLocaleForLanguage(language: BusinessDnaLanguage) {
  return language === "hindi" ? "hi-IN" : "en-IN";
}

export function appendSpeechTranscript(existing: string, transcript: string) {
  const spoken = transcript.trim();
  if (!spoken) return existing;
  return existing.trim() ? `${existing.trimEnd()} ${spoken}` : spoken;
}

export function createSpeechRecognition(options: {
  browser: SpeechBrowser;
  locale: string;
  onTranscript: (transcript: string) => void;
  onEnd: () => void;
  onError: (error: string) => void;
}) {
  const Constructor = options.browser.SpeechRecognition ?? options.browser.webkitSpeechRecognition;
  if (!Constructor) return null;
  const recognition = new Constructor();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = options.locale;
  recognition.onresult = (event) => {
    let transcript = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      transcript += event.results[index]?.[0]?.transcript ?? "";
    }
    if (transcript.trim()) options.onTranscript(transcript.trim());
  };
  recognition.onend = options.onEnd;
  recognition.onerror = (event) => options.onError(event.error ?? "recognition-error");
  return recognition;
}

export function speakBrowserText(options: {
  browser: SpeechBrowser;
  text: string;
  locale: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}) {
  const Utterance = options.browser.SpeechSynthesisUtterance ?? globalThis.SpeechSynthesisUtterance;
  if (!options.browser.speechSynthesis || !Utterance) return false;
  options.browser.speechSynthesis.cancel();
  const utterance = new Utterance(options.text);
  utterance.lang = options.locale;
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;
  utterance.onstart = options.onStart ?? null;
  utterance.onend = options.onEnd ?? null;
  utterance.onerror = options.onError ?? null;
  options.browser.speechSynthesis.speak(utterance);
  return true;
}
