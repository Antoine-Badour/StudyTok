const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

function ensureOpenAIConfigured() {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY. Add it to your server .env.");
  }
}

function extractOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && content?.text) {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function parseJsonFromModel(text) {
  const cleaned = String(text || "").trim();
  if (!cleaned) throw new Error("Empty model response.");

  try {
    return JSON.parse(cleaned);
  } catch {
    const fenced = cleaned.match(/```json\s*([\s\S]*?)```/i)?.[1] || cleaned.match(/```([\s\S]*?)```/i)?.[1];
    if (fenced) return JSON.parse(fenced.trim());

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }

    throw new Error("Model did not return valid JSON.");
  }
}

async function callOpenAIJson({ systemPrompt, userPrompt }) {
  ensureOpenAIConfigured();

  const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.4,
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: userPrompt }] },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const outputText = extractOutputText(data);
  return parseJsonFromModel(outputText);
}

export async function generateAiAnalysis({ noteText, uploadText, youtubeUrl }) {
  const systemPrompt =
    "You are an educational assistant. Return strict JSON only. No markdown. JSON keys: summary (string), relatedKeywords (string[] max 8), cleanedSourceText (string).";

  const userPrompt = [
    "Create a concise study summary and keywords.",
    "If source text is weak, still provide a useful concise response.",
    "",
    `YouTube URL: ${youtubeUrl || "none"}`,
    "",
    "Notes text:",
    noteText || "(none)",
    "",
    "Uploaded file extracted text:",
    uploadText || "(none)",
  ].join("\n");

  const result = await callOpenAIJson({ systemPrompt, userPrompt });
  return {
    summary: String(result?.summary || "").trim(),
    relatedKeywords: Array.isArray(result?.relatedKeywords)
      ? result.relatedKeywords.map((v) => String(v).trim()).filter(Boolean).slice(0, 8)
      : [],
    cleanedSourceText: String(result?.cleanedSourceText || "").trim(),
  };
}

export async function generateAiFlashcards(sourceText) {
  const systemPrompt =
    "You generate flashcards from notes. Return strict JSON only with one key: flashcards, an array of objects with keys id, front, back.";
  const userPrompt = [
    "Create 8 to 12 useful flashcards from this source.",
    "Each front is a short prompt/question. Each back is concise and correct.",
    "",
    "Source:",
    sourceText,
  ].join("\n");

  const result = await callOpenAIJson({ systemPrompt, userPrompt });
  const cards = Array.isArray(result?.flashcards) ? result.flashcards : [];
  return cards.slice(0, 12).map((item, index) => ({
    id: String(item?.id || `fc_${index + 1}`),
    front: String(item?.front || `Card ${index + 1}`).trim(),
    back: String(item?.back || "").trim(),
  }));
}

export async function generateAiQuiz(flashcards) {
  const systemPrompt =
    "You generate multiple-choice quizzes from flashcards. Return strict JSON only with key quiz (array). Each question object keys: id, question, choices (4 strings), answerIndex (0-3), explanation.";
  const userPrompt = [
    "Create up to 8 MCQ questions from these flashcards.",
    "Ensure exactly 4 choices each.",
    "",
    JSON.stringify(flashcards),
  ].join("\n");

  const result = await callOpenAIJson({ systemPrompt, userPrompt });
  const quiz = Array.isArray(result?.quiz) ? result.quiz : [];
  return quiz.slice(0, 8).map((item, index) => {
    const choices = Array.isArray(item?.choices) ? item.choices.map((c) => String(c || "").trim()).filter(Boolean) : [];
    const normalizedChoices = choices.slice(0, 4);
    while (normalizedChoices.length < 4) normalizedChoices.push(`Option ${normalizedChoices.length + 1}`);

    const answerIndex = Number.isInteger(item?.answerIndex) ? item.answerIndex : 0;
    return {
      id: String(item?.id || `q_${index + 1}`),
      question: String(item?.question || `Question ${index + 1}`).trim(),
      choices: normalizedChoices,
      answerIndex: Math.min(3, Math.max(0, answerIndex)),
      explanation: String(item?.explanation || "").trim(),
    };
  });
}

export async function generateAiBrainrotStoryboard(sourceText) {
  const systemPrompt =
    "You create a short vertical video storyboard. Return strict JSON only with keys: totalDurationSec (number <=120), slides (array). Each slide: id, caption, durationSec.";
  const userPrompt = [
    "Create an engaging TikTok-style study storyboard.",
    "Max 2 minutes total, target 720p vertical style. Keep captions short.",
    "Return 8-15 slides.",
    "",
    "Source:",
    sourceText,
  ].join("\n");

  const result = await callOpenAIJson({ systemPrompt, userPrompt });
  const slides = Array.isArray(result?.slides) ? result.slides : [];
  const normalizedSlides = slides.slice(0, 15).map((item, index) => {
    const durationSec = Number(item?.durationSec) || 8;
    return {
      id: String(item?.id || `slide_${index + 1}`),
      caption: String(item?.caption || "").trim() || `Study point ${index + 1}`,
      durationSec: Math.min(20, Math.max(3, Math.round(durationSec))),
    };
  });

  const computedDuration = normalizedSlides.reduce((sum, item) => sum + item.durationSec, 0);

  return {
    totalDurationSec: Math.min(120, Math.max(1, Number(result?.totalDurationSec) || computedDuration)),
    slides: normalizedSlides,
  };
}
