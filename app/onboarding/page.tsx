"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import auth from "../lib/auth";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import type { BusinessDna, BusinessDnaContent } from "../lib/business-dna";
import {
  answerToBusinessDnaPatch,
  BUSINESS_INTAKE_QUESTIONS,
  getApplicableQuestions,
  getNextBusinessIntakeQuestion,
  isQuestionComplete,
  type BusinessIntakeQuestion,
} from "../lib/business-intake-questions";

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

  const content = useMemo(() => contentFromBusinessDna(dna), [dna]);
  const nextQuestion = useMemo(() => getNextBusinessIntakeQuestion(content), [content]);
  const activeQuestion = useMemo(() => BUSINESS_INTAKE_QUESTIONS.find((question) => question.id === activeQuestionId) ?? nextQuestion, [activeQuestionId, nextQuestion]);
  const hasVision = Boolean(content.conversation?.originalVisionText?.trim());
  const complete = hasVision && !activeQuestion;

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
      await saveDnaPatch(id, { conversation: { originalVisionText: vision } });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "We could not save your vision.");
    } finally {
      setIsSaving(false);
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
        <section className="flex flex-1 items-center py-10 sm:py-14">
          <div className="mx-auto w-full max-w-3xl">
            {isLoading ? (
              <p role="status" className="text-center text-base text-[#606A64]">Opening your business conversation…</p>
            ) : !hasVision ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#173D32]">Let’s begin</p>
                <h1 className="mt-4 text-[clamp(2.7rem,7vw,5rem)] font-semibold leading-[1.02] tracking-[-0.055em] text-[#173D32]">Tell us about your business</h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-[#606A64] sm:text-xl">Speak naturally or type it. Tell us what you do, what you want to build, or where you want your business to go.</p>
                <div className="mt-9 rounded-[26px] border border-[#D8DCCF] bg-[#FCFBF7] p-5 shadow-[0_18px_50px_rgba(40,52,45,0.08)] sm:p-8">
                  <label htmlFor="business-vision" className="block text-xl font-semibold leading-8 text-[#173D32]">Tell us your vision. What do you want to build or grow?</label>
                  <textarea id="business-vision" value={vision} onChange={(event) => setVision(event.target.value)} rows={7} maxLength={4000} placeholder="Write naturally in your own words…" className="mt-5 w-full resize-y rounded-[18px] border border-[#D8DCCF] bg-white px-5 py-4 text-lg leading-8 outline-none transition placeholder:text-[#8A918C] focus:border-[#A8B8A7] focus:ring-4 focus:ring-[#A8B8A7]/20" />
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
                  <h1 className="mt-4 text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-[1.08] tracking-[-0.04em] text-[#173D32]">{activeQuestion.question}</h1>
                  {activeQuestion.help && <p className="mt-3 text-base leading-7 text-[#606A64]">{activeQuestion.help}</p>}
                  {activeQuestion.options && <div className="mt-7 grid gap-3 sm:grid-cols-2">{activeQuestion.options.map((option) => <button key={option.value} type="button" aria-pressed={answer === option.value} onClick={() => setAnswer(option.value)} className={`min-h-14 rounded-[15px] border px-4 py-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] ${answer === option.value ? "border-[#173D32] bg-[#EEE9DC] text-[#173D32]" : "border-[#D8DCCF] bg-white text-[#606A64] hover:border-[#A8B8A7]"}`}>{option.label}</button>)}</div>}
                  {activeQuestion.answerType !== "choice" && <label className="mt-6 block text-sm font-semibold text-[#173D32]">{activeQuestion.options ? "Or tell me in my own words" : "Your answer"}{activeQuestion.answerType === "textarea" ? <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={5} maxLength={4000} className="mt-2.5 w-full resize-y rounded-[16px] border border-[#D8DCCF] bg-white px-4 py-4 text-base leading-7 font-normal outline-none focus:border-[#A8B8A7] focus:ring-4 focus:ring-[#A8B8A7]/20" /> : <input value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={500} className="mt-2.5 min-h-14 w-full rounded-[16px] border border-[#D8DCCF] bg-white px-4 text-base font-normal outline-none focus:border-[#A8B8A7] focus:ring-4 focus:ring-[#A8B8A7]/20" />}</label>}
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
