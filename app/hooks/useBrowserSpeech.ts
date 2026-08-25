"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSpeechRecognition, speakBrowserText, type SpeechBrowser, type SpeechRecognitionLike } from "@/app/lib/browser-speech";

export function useBrowserSpeech(options: { locale: string; onTranscript: (transcript: string) => void }) {
  const transcriptRef = useRef(options.onTranscript);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [recognitionSupported, setRecognitionSupported] = useState(true);
  const [synthesisSupported, setSynthesisSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [recognitionError, setRecognitionError] = useState("");
  useEffect(() => {
    transcriptRef.current = options.onTranscript;
  }, [options.onTranscript]);

  useEffect(() => {
    const browser = window as SpeechBrowser;
    const recognition = createSpeechRecognition({
      browser,
      locale: options.locale,
      onTranscript: (transcript) => transcriptRef.current(transcript),
      onEnd: () => setListening(false),
      onError: (error) => {
        setListening(false);
        setRecognitionError(error === "not-allowed" || error === "service-not-allowed" ? "permission-denied" : "recognition-error");
      },
    });
    recognitionRef.current = recognition;
    setRecognitionSupported(Boolean(recognition));
    setSynthesisSupported(Boolean(browser.speechSynthesis && (browser.SpeechSynthesisUtterance ?? globalThis.SpeechSynthesisUtterance)));
    return () => {
      try { recognition?.stop(); } catch {}
      if (recognition) {
        recognition.onresult = null;
        recognition.onend = null;
        recognition.onerror = null;
      }
      browser.speechSynthesis?.cancel();
      recognitionRef.current = null;
    };
  }, [options.locale]);

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setRecognitionSupported(false);
      return false;
    }
    try {
      setRecognitionError("");
      recognition.start();
      setListening(true);
      return true;
    } catch {
      setListening(false);
      setRecognitionError("recognition-error");
      return false;
    }
  }, []);

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
  }, []);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    const worked = speakBrowserText({
      browser: window as SpeechBrowser,
      text,
      locale: options.locale,
      onStart: () => setSpeaking(true),
      onEnd: () => { setSpeaking(false); onEnd?.(); },
      onError: () => setSpeaking(false),
    });
    if (!worked) setSynthesisSupported(false);
    return worked;
  }, [options.locale]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return { listening, speaking, recognitionSupported, synthesisSupported, recognitionError, startListening, stopListening, speak, stopSpeaking };
}
