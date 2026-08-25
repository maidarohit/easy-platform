"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import auth from "../lib/auth";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import type { BusinessDna, BusinessDnaContent } from "../lib/business-dna";
import type { BusinessDnaLanguage } from "../lib/business-dna";
import { useBrowserSpeech } from "../hooks/useBrowserSpeech";
import { appendSpeechTranscript, speechLocaleForLanguage } from "../lib/browser-speech";
import {
  answerToBusinessDnaPatch,
  BUSINESS_INTAKE_QUESTIONS,
  getApplicableQuestions,
  getNextBusinessIntakeQuestion,
  isQuestionComplete,
  businessIntakeQuestionText,
  type BusinessIntakeQuestion,
} from "../lib/business-intake-questions";

const languageOptions: readonly { value: BusinessDnaLanguage; label: string }[] = [
  { value: "english", label: "English" },
  { value: "hindi", label: "हिन्दी" },
  { value: "hinglish", label: "Hinglish" },
];

const intakeCopy = {
  english: {
    headline: "Tell us about your business",
    support: "Speak naturally or type it. Tell us what you do, what you want to build, or where you want your business to go.",
    vision: "Tell us your vision. What do you want to build or grow?",
    placeholder: "Write naturally in your own words…",
    ownWords: "Or tell me in my own words",
    answer: "Your answer",
    listen: "Tap the mic and tell us about your business",
    listening: "Listening…",
    read: "Read aloud",
    stopReading: "Stop reading",
    auto: "Speak questions automatically",
  },
  hindi: {
    headline: "अपने व्यवसाय के बारे में बताइए",
    support: "स्वाभाविक रूप से बोलें या लिखें। बताइए आप क्या करते हैं और व्यवसाय को कहाँ ले जाना चाहते हैं।",
    vision: "अपना विज़न बताइए। आप क्या बनाना या बढ़ाना चाहते हैं?",
    placeholder: "अपने शब्दों में लिखिए…",
    ownWords: "या अपने शब्दों में बताइए",
    answer: "आपका जवाब",
    listen: "माइक दबाकर अपने व्यवसाय के बारे में बताइए",
    listening: "सुन रहे हैं…",
    read: "सुनें",
    stopReading: "आवाज़ बंद करें",
    auto: "सवाल अपने-आप बोलकर सुनाएँ",
  },
  hinglish: {
    headline: "Tell us about your business",
    support: "Aap naturally bol sakte hain ya type kar sakte hain. Apne business aur goals ke baare mein batayein.",
    vision: "Apna vision batayein. Aap kya build ya grow karna chahte hain?",
    placeholder: "Apne words mein likhiye…",
    ownWords: "Or tell me in my own words",
    answer: "Your answer",
    listen: "Mic tap karke apne business ke baare mein batayein",
    listening: "Listening…",
    read: "Read aloud",
    stopReading: "Stop reading",
    auto: "Speak questions automatically",
  },
} as const;

function contentFromBusinessDna(dna: BusinessDna | null): BusinessDnaContent {
  if (!dna) return {};
  const content = { ...dna } as BusinessDnaContent & { metadata?: BusinessDna["metadata"] };
  delete content.metadata;
  const conversation = { ...(content.conversation ?? {}) } as Record<string, unknown>;
  delete conversation.confirmed;
  delete conversation.confirmedAt;
  delete conversation.revisionCount;
  return { ...content, conversation } as BusinessDnaContent;
}

function answerForQuestion(question: BusinessIntakeQuestion, dna: BusinessDnaContent) {
  const [section, field] = question.path.split(".") as [keyof BusinessDnaContent, string];
  const value = (dna[section] as Record<string, unknown> | undefined)?.[field];
  return Array.isArray(value) ? value.join(", ") : typeof value === "string" ? value : "";
}

function ArrowIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.6"><path d="M3.5 10h13m-4.5-4 4.5 4-4.5 4" /></svg>;
}

const primaryButtonClass = "inline-flex min-h-13 items-center justify-center gap-3 rounded-[14px] bg-[#173D32] px-6 py-3.5 text-base font-semibold text-[#F7F4EC] shadow-[0_12px_30px_rgba(23,61,50,0.16)] transition hover:-translate-y-0.5 hover:bg-[#0E2C24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] focus-visible:ring-offset-4 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0";

function VoiceControl({ speech, label }: { speech: ReturnType<typeof useBrowserSpeech>; label: string }) {
  const fallback = !speech.recognitionSupported
    ? "Voice isn't available in this browser. You can type your answer instead."
    : speech.recognitionError === "permission-denied"
      ? "Microphone permission was not allowed. You can type your answer instead."
      : speech.recognitionError
        ? "Voice could not hear that clearly. Your text is safe — please try again or keep typing."
        : "";
  return (
    <div className="mt-5 flex flex-wrap items-center gap-4">
      <button type="button" disabled={!speech.recognitionSupported} onClick={() => speech.listening ? speech.stopListening() : speech.startListening()} aria-label={speech.listening ? "Stop listening" : "Start microphone"} className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-40 ${speech.listening ? "animate-pulse border-red-400 bg-red-500" : "border-[#173D32] bg-[#173D32] hover:scale-105"}`}>
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2"><rect x="9" y="2" width="6" height="11" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" /></svg>
      </button>
      <div><p role="status" className="text-sm font-semibold text-[#173D32]">{label}</p><p className="mt-1 text-xs text-[#606A64]">{fallback || "Your transcript stays editable until you press Continue."}</p></div>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const [dna, setDna] = useState<BusinessDna | null>(null);
  const [vision, setVision] = useState("");
  const [answer, setAnswer] = useState("");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [questionHistory, setQuestionHistory] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState<BusinessDnaLanguage>("english");
  const [autoSpeak, setAutoSpeak] = useState(false);

  const content = useMemo(() => contentFromBusinessDna(dna), [dna]);
  const nextQuestion = useMemo(() => getNextBusinessIntakeQuestion(content), [content]);
  const activeQuestion = useMemo(() => BUSINESS_INTAKE_QUESTIONS.find((question) => question.id === activeQuestionId) ?? nextQuestion, [activeQuestionId, nextQuestion]);
  const hasVision = Boolean(content.conversation?.originalVisionText?.trim());
  const complete = hasVision && !activeQuestion;
  const copy = intakeCopy[language];
  const activeQuestionText = activeQuestion ? businessIntakeQuestionText(activeQuestion, language) : "";
  const speech = useBrowserSpeech({
    locale: speechLocaleForLanguage(language),
    onTranscript: (transcript) => {
      if (hasVision) setAnswer((previous) => appendSpeechTranscript(previous, transcript));
      else setVision((previous) => appendSpeechTranscript(previous, transcript));
    },
  });
  const { speak, stopSpeaking } = speech;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await auth.authStateReady();
        if (!auth.currentUser) {
          setError("Please sign in to tell us about your business.");
          return;
        }
        const id = new URL(window.location.href).searchParams.get("projectId")?.trim() ?? "";
        if (id) {
          const [projectResponse, dnaResponse] = await Promise.all([
            authenticatedFetch(`/api/projects?projectId=${encodeURIComponent(id)}`),
            authenticatedFetch(`/api/business-dna?projectId=${encodeURIComponent(id)}`),
          ]);
          if (!projectResponse.ok || !dnaResponse.ok) throw new Error("We could not open this business safely.");
          const data = await dnaResponse.json();
          if (!cancelled) {
            setProjectId(id);
            setDna(data.dna ?? null);
            setVision(data.dna?.conversation?.originalVisionText ?? "");
            setLanguage(data.dna?.conversation?.preferredLanguage ?? "english");
          }
        } else {
          const storedIdea = sessionStorage.getItem("easy-selected-business-idea");
          if (storedIdea) {
            try {
              const saved = JSON.parse(storedIdea);
              const idea = saved?.idea ?? saved;
              if (!cancelled && typeof idea?.title === "string") setVision(idea.title);
            } catch {
              // An invalid optional idea handoff must not block onboarding.
            }
          }
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "We could not load your business.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!autoSpeak || !activeQuestionText) return;
    speak(activeQuestionText);
    return stopSpeaking;
  }, [activeQuestionText, autoSpeak, speak, stopSpeaking]);

  async function saveDnaPatch(id: string, patch: BusinessDnaContent) {
    const response = await authenticatedFetch("/api/business-dna", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id, dna: patch }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "We could not save your answer.");
    setDna(data.dna);
    return data.dna as BusinessDna;
  }

  async function saveInitialVision() {
    if (!vision.trim() || isSaving) return;
    setIsSaving(true);
    setError("");
    try {
      await auth.authStateReady();
      if (!auth.currentUser) throw new Error("Please sign in before continuing.");
      let id = projectId;
      if (!id) {
        id = crypto.randomUUID();
        const response = await authenticatedFetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, name: `Business Vision ${id.slice(0, 8)}`, originalBrief: vision, brandDescription: vision }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "We could not create your business project.");
        id = data.project?.id;
        if (!id) throw new Error("Your business project could not be opened.");
        setProjectId(id);
        router.replace(`/onboarding?projectId=${encodeURIComponent(id)}`);
        sessionStorage.removeItem("easy-selected-business-idea");
      }
      await saveDnaPatch(id, { conversation: { originalVisionText: vision, preferredLanguage: language } });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "We could not save your vision.");
    } finally {
      setIsSaving(false);
    }
  }

  async function changeLanguage(nextLanguage: BusinessDnaLanguage) {
    speech.stopListening();
    speech.stopSpeaking();
    setLanguage(nextLanguage);
    if (!projectId) return;
    try {
      await saveDnaPatch(projectId, { conversation: { preferredLanguage: nextLanguage } });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "We could not save your language choice.");
    }
  }

  async function saveAnswer(skip = false) {
    if (!activeQuestion || !projectId || isSaving || (activeQuestion.required && !answer.trim())) return;
    setIsSaving(true);
    setError("");
    try {
      await saveDnaPatch(projectId, answerToBusinessDnaPatch(activeQuestion, skip ? "" : answer));
      setQuestionHistory((history) => [...history.filter((id) => id !== activeQuestion.id), activeQuestion.id]);
      setActiveQuestionId(null);
      setAnswer("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "We could not save your answer.");
    } finally {
      setIsSaving(false);
    }
  }

  function goBack() {
    const applicable = getApplicableQuestions(content);
    const historyCandidate = [...questionHistory].reverse().find((id) => applicable.some((question) => question.id === id));
    const completed = applicable.filter((question) => isQuestionComplete(question, content));
    const target = historyCandidate ?? completed.at(-1)?.id ?? null;
    if (target) {
      const targetQuestion = BUSINESS_INTAKE_QUESTIONS.find((question) => question.id === target);
      if (targetQuestion) setAnswer(answerForQuestion(targetQuestion, content));
      setActiveQuestionId(target);
    }
  }

  const applicableQuestions = getApplicableQuestions(content);
  const completedCount = applicableQuestions.filter((question) => isQuestionComplete(question, content)).length;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F7F4EC] text-[#1B211E]">
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-16 h-96 w-96 rounded-full bg-[#A8B8A7]/20 blur-[110px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-28 bottom-0 h-80 w-80 rounded-full bg-[#EEE9DC] blur-[90px]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between gap-6 border-b border-[#D8DCCF] pb-5">
          <span className="text-lg font-semibold tracking-[-0.02em] text-[#173D32]">Buzypeezy</span>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#606A64]">Your business story</span>
        </header>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex rounded-[14px] border border-[#D8DCCF] bg-[#FCFBF7] p-1" aria-label="Choose language">
            {languageOptions.map((option) => <button key={option.value} type="button" aria-pressed={language === option.value} onClick={() => void changeLanguage(option.value)} className={`rounded-[10px] px-4 py-2 text-sm font-semibold transition ${language === option.value ? "bg-[#173D32] text-white" : "text-[#606A64] hover:bg-[#EEE9DC]"}`}>{option.label}</button>)}
          </div>
          <label className="flex items-center gap-2 text-sm text-[#606A64]"><input type="checkbox" checked={autoSpeak} onChange={(event) => { setAutoSpeak(event.target.checked); if (!event.target.checked) speech.stopSpeaking(); }} />{copy.auto}</label>
        </div>
        <section className="flex flex-1 items-center py-10 sm:py-14">
          <div className="mx-auto w-full max-w-3xl">
            {isLoading ? (
              <p role="status" className="text-center text-base text-[#606A64]">Opening your business conversation…</p>
            ) : !hasVision ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#173D32]">Let’s begin</p>
                <h1 className="mt-4 text-[clamp(2.7rem,7vw,5rem)] font-semibold leading-[1.02] tracking-[-0.055em] text-[#173D32]">{copy.headline}</h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-[#606A64] sm:text-xl">{copy.support}</p>
                <div className="mt-9 rounded-[26px] border border-[#D8DCCF] bg-[#FCFBF7] p-5 shadow-[0_18px_50px_rgba(40,52,45,0.08)] sm:p-8">
                  <div className="flex items-start justify-between gap-4"><label htmlFor="business-vision" className="block text-xl font-semibold leading-8 text-[#173D32]">{copy.vision}</label>{speech.synthesisSupported && <button type="button" onClick={() => speech.speaking ? speech.stopSpeaking() : speech.speak(copy.vision)} className="shrink-0 rounded-full border border-[#D8DCCF] px-3 py-2 text-xs font-semibold text-[#173D32]">{speech.speaking ? copy.stopReading : copy.read}</button>}</div>
                  <textarea id="business-vision" value={vision} onChange={(event) => setVision(event.target.value)} rows={7} maxLength={4000} placeholder={copy.placeholder} className="mt-5 w-full resize-y rounded-[18px] border border-[#D8DCCF] bg-white px-5 py-4 text-lg leading-8 outline-none transition placeholder:text-[#8A918C] focus:border-[#A8B8A7] focus:ring-4 focus:ring-[#A8B8A7]/20" />
                  <VoiceControl speech={speech} label={speech.listening ? copy.listening : copy.listen} />
                </div>
                <button type="button" disabled={!vision.trim() || isSaving} onClick={saveInitialVision} className={`${primaryButtonClass} mt-7`}>{isSaving ? "Saving…" : "Continue"} {!isSaving && <ArrowIcon />}</button>
              </div>
            ) : complete ? (
              <div className="mx-auto max-w-2xl text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#A8B8A7] bg-[#EEE9DC] text-2xl text-[#173D32]">✓</div>
                <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-[#173D32]">Conversation saved</p>
                <h1 className="mt-4 text-[clamp(2.6rem,6vw,4.5rem)] font-semibold leading-[1.04] tracking-[-0.05em] text-[#173D32]">Great — I have enough information to understand your business.</h1>
                <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-[#606A64]">Your answers are saved. The next step will let you review and correct what I understood.</p>
                <button type="button" disabled className={`${primaryButtonClass} mt-8`}>Review what I understood — coming next</button>
                <button type="button" onClick={goBack} className="mt-6 block w-full text-sm font-semibold text-[#606A64] underline decoration-[#A8B8A7] underline-offset-4">Back to my answers</button>
              </div>
            ) : activeQuestion ? (
              <div>
                <div className="flex items-center justify-between gap-5 text-sm text-[#606A64]"><span>Let’s take this one step at a time.</span><span>{completedCount} answers saved</span></div>
                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#E3E6DB]"><div className="h-full rounded-full bg-[#A8B8A7] transition-all" style={{ width: `${Math.max(8, (completedCount / applicableQuestions.length) * 100)}%` }} /></div>
                <div className="mt-7 rounded-[28px] border border-[#D8DCCF] bg-[#FCFBF7] p-6 shadow-[0_18px_50px_rgba(40,52,45,0.08)] sm:p-9">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7B847E]">About your business</p>
                  <div className="mt-4 flex items-start justify-between gap-4"><h1 className="text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-[1.08] tracking-[-0.04em] text-[#173D32]">{activeQuestionText}</h1>{speech.synthesisSupported && <button type="button" onClick={() => speech.speaking ? speech.stopSpeaking() : speech.speak(activeQuestionText)} className="shrink-0 rounded-full border border-[#D8DCCF] px-3 py-2 text-xs font-semibold text-[#173D32]">{speech.speaking ? copy.stopReading : copy.read}</button>}</div>
                  {activeQuestion.help && <p className="mt-3 text-base leading-7 text-[#606A64]">{activeQuestion.help}</p>}
                  {activeQuestion.options && <div className="mt-7 grid gap-3 sm:grid-cols-2">{activeQuestion.options.map((option) => <button key={option.value} type="button" aria-pressed={answer === option.value} onClick={() => setAnswer(option.value)} className={`min-h-14 rounded-[15px] border px-4 py-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] ${answer === option.value ? "border-[#173D32] bg-[#EEE9DC] text-[#173D32]" : "border-[#D8DCCF] bg-white text-[#606A64] hover:border-[#A8B8A7]"}`}>{option.label}</button>)}</div>}
                  <label className="mt-6 block text-sm font-semibold text-[#173D32]">{activeQuestion.options ? copy.ownWords : copy.answer}{activeQuestion.answerType === "textarea" ? <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={5} maxLength={4000} className="mt-2.5 w-full resize-y rounded-[16px] border border-[#D8DCCF] bg-white px-4 py-4 text-base leading-7 font-normal outline-none focus:border-[#A8B8A7] focus:ring-4 focus:ring-[#A8B8A7]/20" /> : <input value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={500} className="mt-2.5 min-h-14 w-full rounded-[16px] border border-[#D8DCCF] bg-white px-4 text-base font-normal outline-none focus:border-[#A8B8A7] focus:ring-4 focus:ring-[#A8B8A7]/20" />}</label>
                  <VoiceControl speech={speech} label={speech.listening ? copy.listening : copy.listen} />
                </div>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={goBack} className="min-h-13 rounded-[14px] border border-[#D8DCCF] bg-[#FCFBF7] px-5 text-sm font-semibold text-[#173D32] transition hover:border-[#A8B8A7]">Back</button>
                  <button type="button" disabled={isSaving || !answer.trim()} onClick={() => saveAnswer(false)} className={primaryButtonClass}>{isSaving ? "Saving…" : "Continue"} {!isSaving && <ArrowIcon />}</button>
                  {!activeQuestion.required && <button type="button" disabled={isSaving} onClick={() => saveAnswer(true)} className="min-h-13 px-3 text-sm font-semibold text-[#606A64] underline decoration-[#A8B8A7] underline-offset-4">Skip</button>}
                </div>
              </div>
            ) : null}
            {error && <p role="alert" className="mt-6 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
