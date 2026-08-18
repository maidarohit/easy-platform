"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import auth from "../lib/auth";
import { useProjectMemory } from "../hooks/useProjectMemory";

type Message = {
  role: "user" | "assistant";
  content: string;
};
type SpeechRecognitionResultLike = {
  [index: number]: {
    transcript: string;
  };
  length: number;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export default function AssistantWidget() {
  const { projectId } = useProjectMemory();

  const [userId, setUserId] = useState("");
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [handsFree, setHandsFree] = useState(false);

const handsFreeRef = useRef(false);
useEffect(() => {
  handsFreeRef.current = handsFree;
}, [handsFree]);

const sendMessageRef = useRef<
  (text?: string) => Promise<void>
>(async () => {});

const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi, I’m Easy Assistant. Ask me anything about your current project.",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? "");
    });

    return unsubscribe;
  }, []);
  useEffect(() => {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  const SpeechRecognitionApi =
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition;

  if (!SpeechRecognitionApi) return;

  const recognition = new SpeechRecognitionApi();

  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = navigator.language || "en-US";

  recognition.onresult = (event) => {
    let transcript = "";

    for (
      let index = event.resultIndex;
      index < event.results.length;
      index += 1
    ) {
      transcript += event.results[index]?.[0]?.transcript ?? "";
    }

    const cleanTranscript = transcript.trim();

    if (!cleanTranscript) return;
if (handsFreeRef.current) {
  setInput("");
  void sendMessageRef.current(cleanTranscript);
  return;
}
    setInput((previous) =>
      previous.trim()
        ? `${previous.trim()} ${cleanTranscript}`
        : cleanTranscript
    );
  };

  recognition.onend = () => {
    setListening(false);
  };

  recognition.onerror = () => {
    setListening(false);
  };

  recognitionRef.current = recognition;

  return () => {
    recognition.onresult = null;
    recognition.onend = null;
    recognition.onerror = null;
    recognitionRef.current = null;
  };
}, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  useEffect(() => {
    const resetForProject = window.setTimeout(() => {
      setMessages([
      {
        role: "assistant",
        content: projectId
          ? "Project connected. I can use your Project Memory and saved AI results."
          : "Hi, I’m Easy Assistant. Open a project and I’ll become project-aware.",
      },
    ]);

      setInput("");
    }, 0);

    return () => window.clearTimeout(resetForProject);
  }, [projectId]);

  function speakHandsFreeReply(text: string) {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = navigator.language || "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onend = () => {
      if (!handsFreeRef.current) return;

      const recognition = recognitionRef.current;

      if (!recognition) return;

      try {
        recognition.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    };

    utterance.onerror = () => {
      setListening(false);
    };

    window.speechSynthesis.speak(utterance);
  }

  const sendMessage = async (overrideMessage?: string) => {
  const cleanMessage = (overrideMessage ?? input).trim();

    if (!cleanMessage || loading) return;

    if (!userId) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: "Please sign in before using Easy Assistant.",
        },
      ]);
      return;
    }

    if (!projectId) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "Please open a project first so I can access its Project Memory.",
        },
      ]);
      return;
    }

    const previousMessages = messages;

    const userMessage: Message = {
      role: "user",
      content: cleanMessage,
    };

    setMessages((previous) => [...previous, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error("Please sign in before using Easy Assistant.");
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          projectId,
          message: cleanMessage,
          messages: previousMessages,
          currentPage: window.location.pathname,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Assistant request failed.");
      }

      const assistantReply =
  data?.reply ||
  "I couldn’t generate a response for that request.";

setMessages((previous) => [
  ...previous,
  {
    role: "assistant",
    content: assistantReply,
  },
]);

if (handsFreeRef.current) {
  speakHandsFreeReply(assistantReply);
}
    } catch (error) {
      console.error("Easy Assistant error:", error);

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "I ran into a problem while answering. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);
  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };
  const toggleVoiceInput = () => {
  const recognition = recognitionRef.current;

  if (!recognition) {
    setMessages((previous) => [
      ...previous,
      {
        role: "assistant",
        content:
          "Voice input is not available in this browser. Please type your message instead.",
      },
    ]);

    return;
  }

  if (listening) {
    recognition.stop();
    setListening(false);
    return;
  }

  try {
    recognition.start();
    setListening(true);
  } catch (error) {
    console.error("Voice input error:", error);
    setListening(false);
  }
};
const toggleSpeakMessage = (text: string, index: number) => {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window)
  ) {
    return;
  }

  if (
    speakingIndex === index &&
    window.speechSynthesis.speaking
  ) {
    window.speechSynthesis.cancel();
    setSpeakingIndex(null);
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.lang = navigator.language || "en-US";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;

  utterance.onstart = () => {
    setSpeakingIndex(index);
  };

  utterance.onend = () => {
    setSpeakingIndex(null);
  };

  utterance.onerror = () => {
    setSpeakingIndex(null);
  };

  window.speechSynthesis.speak(utterance);
};
  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-[100] flex h-[560px] w-[390px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[28px] border border-black/10 bg-[#fffdf8] shadow-2xl">
          <div className="border-b border-black/10 px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-500">
                  Easy Intelligence
                </div>

                <h2 className="mt-1 text-lg font-semibold text-[#083c32]">
                  Easy Assistant
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
  handsFreeRef.current = false;
  setHandsFree(false);

  window.speechSynthesis?.cancel();

  try {
    recognitionRef.current?.stop();
  } catch {}

  setListening(false);
  setSpeakingIndex(null);
  setOpen(false);
}}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-lg text-black/60 transition hover:bg-black/5"
                aria-label="Close assistant"
              >
                ×
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-black/50">
              <span
                className={`h-2 w-2 rounded-full ${
                  projectId ? "bg-cyan-400" : "bg-amber-400"
                }`}
              />

              {projectId
                ? "Project Memory connected"
                : "Open a project to connect memory"}
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${
                  message.role === "user"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
  className={`max-w-[85%] rounded-[20px] px-4 py-3 text-sm leading-6 ${
    message.role === "user"
      ? "bg-[#083c32] text-white"
      : "border border-black/10 bg-white text-[#173b34]"
  }`}
>
  <div>{message.content}</div>

  {message.role === "assistant" && (
    <div className="mt-2 flex justify-end">
      <button
        type="button"
        onClick={() => toggleSpeakMessage(message.content, index)}
        className={`flex h-7 w-7 items-center justify-center rounded-full border transition ${
          speakingIndex === index
            ? "border-cyan-300 bg-cyan-50 text-cyan-600"
            : "border-black/10 bg-[#fffdf8] text-[#083c32] hover:bg-cyan-50"
        }`}
        aria-label={
          speakingIndex === index
            ? "Stop speaking"
            : "Read response aloud"
        }
        title={
          speakingIndex === index
            ? "Stop speaking"
            : "Read aloud"
        }
      >
        {speakingIndex === index ? (
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="currentColor"
          >
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 5 6 9H3v6h3l5 4V5Z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </svg>
        )}
      </button>
    </div>
  )}
</div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-[20px] border border-black/10 bg-white px-4 py-3 text-sm text-black/50">
                  Thinking...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-black/10 bg-white/70 p-4">
            <div className="flex items-end gap-2 rounded-[20px] border border-black/10 bg-white p-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  projectId
                    ? "Ask about this project..."
                    : "Open a project first..."
                }
                rows={1}
                disabled={loading}
                className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-[#083c32] outline-none placeholder:text-black/35"
              />
              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={loading || !projectId || handsFree}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  listening
                    ? "animate-pulse bg-red-500 text-white"
                    : "border border-black/10 bg-white text-[#083c32] hover:bg-cyan-50"
                }`}
                aria-label={
                  listening ? "Stop voice input" : "Start voice input"
                }
                title={
                  listening ? "Stop listening" : "Speak your message"
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="2" width="6" height="11" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <path d="M12 17v5" />
                  <path d="M8 22h8" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#083c32] text-white transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send message"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m5 12 14-7-4 14-3-6-7-1Z" />
                </svg>
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
  <button
    type="button"
    disabled={loading || !projectId}
    onClick={() => {
      const nextMode = !handsFreeRef.current;

      handsFreeRef.current = nextMode;
      setHandsFree(nextMode);

      if (!nextMode) {
        window.speechSynthesis?.cancel();

        try {
          recognitionRef.current?.stop();
        } catch {}

        setListening(false);
        setSpeakingIndex(null);
        return;
      }

      const recognition = recognitionRef.current;

      if (!recognition) {
        handsFreeRef.current = false;
        setHandsFree(false);
        return;
      }

      try {
        recognition.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    }}
    className={`rounded-full border px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] transition ${
      handsFree
        ? "border-cyan-300 bg-cyan-50 text-cyan-600"
        : "border-black/10 bg-white text-black/45"
    }`}
  >
    {handsFree ? "● Voice Mode On" : "Voice Mode"}
  </button>

  <div className="text-[9px] uppercase tracking-[0.16em] text-black/35">
    Project-aware AI copilot
  </div>
</div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="fixed bottom-6 right-6 z-[101] flex h-14 w-14 items-center justify-center rounded-full border border-cyan-300/50 bg-[#083c32] text-white shadow-xl transition hover:scale-105"
        aria-label="Open Easy Assistant"
      >
        {open ? (
          <span className="text-xl">×</span>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M8 10h8M8 14h5" />
            <path d="M5 19l1.5-3A7 7 0 1 1 19 9a7 7 0 0 1-9.5 6.6L5 19Z" />
          </svg>
        )}
      </button>
    </>
  );
}
