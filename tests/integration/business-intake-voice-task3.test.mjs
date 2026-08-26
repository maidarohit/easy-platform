import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  appendSpeechTranscript,
  createSpeechRecognition,
  speakBrowserText,
  speechLocaleForLanguage,
} from "../../app/lib/browser-speech.ts";
import { validateBusinessDnaPatch } from "../../app/lib/business-dna.ts";

class MockRecognition {
  continuous = true;
  interimResults = true;
  lang = "";
  starts = 0;
  stops = 0;
  onresult = null;
  onend = null;
  onerror = null;
  start() { this.starts += 1; }
  stop() { this.stops += 1; }
}

class MockUtterance {
  constructor(text) { this.text = text; }
  lang = "";
  rate = 1;
  pitch = 1;
  volume = 1;
  onstart = null;
  onend = null;
  onerror = null;
}

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const languagePatch = (language) => validateBusinessDnaPatch({ conversation: { preferredLanguage: language } });

test("1. English mode persists", () => assert.equal(languagePatch("english").conversation.preferredLanguage, "english"));
test("2. Hindi mode persists", () => assert.equal(languagePatch("hindi").conversation.preferredLanguage, "hindi"));
test("3. Hinglish mode persists", () => assert.equal(languagePatch("hinglish").conversation.preferredLanguage, "hinglish"));
test("4. en-IN is used for English recognition", () => assert.equal(speechLocaleForLanguage("english"), "en-IN"));
test("5. hi-IN is used for Hindi recognition", () => assert.equal(speechLocaleForLanguage("hindi"), "hi-IN"));

test("6. Hinglish mode preserves a mixed transcript", () => {
  assert.equal(speechLocaleForLanguage("hinglish"), "en-IN");
  assert.equal(appendSpeechTranscript("", "Hum दिल्ली mein grow karna चाहते हैं."), "Hum दिल्ली mein grow karna चाहते हैं.");
});

test("7. transcript remains editable before Continue", async () => {
  const page = await source("app/onboarding/page.tsx");
  assert.match(page, /value=\{vision\} onChange=\{\(event\) => setVision/);
  assert.match(page, /value=\{answer\} onChange=\{\(event\) => setAnswer/);
});

test("8. voice recognition does not auto-submit", async () => {
  const page = await source("app/onboarding/page.tsx");
  const callback = page.slice(page.indexOf("onTranscript:"), page.indexOf("const { speak"));
  assert.match(callback, /setAnswer|setVision/);
  assert.doesNotMatch(callback, /saveDnaPatch|saveAnswer|saveInitialVision|Continue/);
});

test("9. typed content is retained when speech starts", () => {
  assert.equal(appendSpeechTranscript("Already typed", "new words"), "Already typed new words");
});

test("10. microphone permission denial falls back without changing text", () => {
  let error = "";
  let text = "Keep this";
  const recognition = createSpeechRecognition({ browser: { SpeechRecognition: MockRecognition }, locale: "en-IN", onTranscript: (value) => { text = value; }, onEnd() {}, onError: (value) => { error = value; } });
  recognition.onerror({ error: "not-allowed" });
  assert.equal(error, "not-allowed");
  assert.equal(text, "Keep this");
});

test("11. unsupported SpeechRecognition safely returns null", () => {
  assert.equal(createSpeechRecognition({ browser: {}, locale: "en-IN", onTranscript() {}, onEnd() {}, onError() {} }), null);
});

test("12. recognition errors do not reset intake", () => {
  let text = "Existing answer";
  const recognition = createSpeechRecognition({ browser: { webkitSpeechRecognition: MockRecognition }, locale: "en-IN", onTranscript: (value) => { text = value; }, onEnd() {}, onError() {} });
  recognition.onerror({ error: "network" });
  assert.equal(text, "Existing answer");
});

test("13. read-aloud uses mocked speechSynthesis", () => {
  let spoken;
  const browser = { SpeechSynthesisUtterance: MockUtterance, speechSynthesis: { cancel() {}, speak(value) { spoken = value; } } };
  assert.equal(speakBrowserText({ browser, text: "Where is your business?", locale: "en-IN" }), true);
  assert.equal(spoken.text, "Where is your business?");
  assert.equal(spoken.lang, "en-IN");
});

test("14. missing speechSynthesis does not break intake", () => {
  assert.equal(speakBrowserText({ browser: { SpeechSynthesisUtterance: MockUtterance }, text: "Question", locale: "en-IN" }), false);
});

test("15. Hindi Unicode persists to Business DNA", () => {
  const value = "मैं अपना व्यवसाय पूरे भारत में बढ़ाना चाहता हूँ।";
  assert.equal(validateBusinessDnaPatch({ conversation: { originalVisionText: value } }).conversation.originalVisionText, value);
});

test("16. Hinglish persists to Business DNA", () => {
  const value = "Hum local ग्राहकों se online enquiries badhana chahte hain.";
  assert.equal(validateBusinessDnaPatch({ conversation: { originalVisionText: value } }).conversation.originalVisionText, value);
});

test("17. refresh restores preferred language", async () => {
  const page = await source("app/onboarding/page.tsx");
  assert.match(page, /setLanguage\(data\.dna\?\.conversation\?\.preferredLanguage \?\? "english"\)/);
  assert.match(page, /conversation: \{ preferredLanguage: nextLanguage \}/);
});

test("18. refresh still restores completed answers", async () => {
  const page = await source("app/onboarding/page.tsx");
  assert.match(page, /setDna\(data\.dna \?\? null\)/);
  assert.match(page, /getNextBusinessIntakeQuestion\(content\)/);
});

test("19. voice still cannot confirm Business DNA", async () => {
  const page = await source("app/onboarding/page.tsx");
  assert.doesNotMatch(page, /onTranscript:[\s\S]{0,300}confirmUnderstanding/);
  assert.match(page, /onClick=\{\(\) => void confirmUnderstanding\(\)\}/);
});

test("20. Easy Mode preview never starts a run", async () => {
  const page = await source("app/onboarding/page.tsx");
  assert.match(page, /disabled className=.*Next: Build My Business/);
  assert.doesNotMatch(page, /api\/easy-mode|executeEasyMode|\/easy-mode\?/);
});

test("21. voice intake contains no provider calls", async () => {
  const files = await Promise.all([source("app/onboarding/page.tsx"), source("app/hooks/useBrowserSpeech.ts"), source("app/lib/browser-speech.ts")]);
  assert.doesNotMatch(files.join("\n"), /OPENAI|GEMINI|N8N_|startAiUsage|\/api\/(?:assistant|.*-ai)/i);
});

test("22. AssistantWidget retains voice and hands-free behavior through the shared hook", async () => {
  const assistant = await source("app/components/AssistantWidget.tsx");
  assert.match(assistant, /useBrowserSpeech/);
  assert.match(assistant, /handsFreeRef\.current/);
  assert.match(assistant, /sendMessageRef\.current\(cleanTranscript\)/);
  assert.match(assistant, /speech\.speak\(text/);
  assert.match(assistant, /speech\.startListening\(\)/);
  assert.doesNotMatch(assistant, /new SpeechRecognition|new webkitSpeechRecognition/);
});
