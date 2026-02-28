import crypto from "crypto";

function stripHtml(input) {
  return String(input || "").replace(/<[^>]*>/g, " ");
}

function normalizeText(input) {
  return stripHtml(input)
    .replace(/\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text) {
  return normalizeText(text)
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function toKeyConcept(sentence) {
  const value = sentence.replace(/[#*_`~]/g, "").trim();
  if (value.length <= 80) return value;
  return `${value.slice(0, 77)}...`;
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function extractConcepts(text) {
  const stop = new Set([
    "about",
    "after",
    "before",
    "being",
    "because",
    "between",
    "could",
    "every",
    "first",
    "found",
    "from",
    "have",
    "into",
    "many",
    "more",
    "most",
    "other",
    "over",
    "same",
    "some",
    "than",
    "that",
    "their",
    "there",
    "these",
    "this",
    "those",
    "through",
    "under",
    "what",
    "when",
    "where",
    "which",
    "while",
    "with",
    "would",
  ]);

  const words = normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 5 && !stop.has(word));

  const counts = new Map();
  for (const word of words) {
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([word]) => word);
}

function sentenceForConcept(sentences, concept, usedSet) {
  const found = sentences.find((s) => s.toLowerCase().includes(concept) && !usedSet.has(s));
  if (found) {
    usedSet.add(found);
    return found;
  }

  const fallback = sentences.find((s) => !usedSet.has(s)) || sentences[0] || "";
  if (fallback) usedSet.add(fallback);
  return fallback;
}

function buildExplanationBlock(sentence, concept) {
  const base = toKeyConcept(sentence || "");
  const main = concept ? `Concept: ${concept}.` : "Concept summary.";
  const why = `Why it matters: This idea appears in your material and is likely test-relevant.`;
  const example = base ? `Example from notes: ${base}` : "Example: Connect this idea to one real case you studied.";
  return `${main} ${why} ${example}`.trim();
}

export function parseYouTubeLink(link) {
  const value = String(link || "").trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const videoId = url.searchParams.get("v");
      if (!videoId) return null;
      return { videoId, canonicalUrl: `https://www.youtube.com/watch?v=${videoId}` };
    }

    if (host === "youtu.be") {
      const videoId = url.pathname.replace("/", "").trim();
      if (!videoId) return null;
      return { videoId, canonicalUrl: `https://www.youtube.com/watch?v=${videoId}` };
    }
  } catch {
    return null;
  }

  return null;
}

export function extractTextFromUpload(file) {
  if (!file) return "";
  const mime = String(file.mimetype || "").toLowerCase();
  const ext = (file.originalname || "").split(".").pop()?.toLowerCase() || "";

  if (mime.startsWith("text/") || ["txt", "md", "csv", "json"].includes(ext)) {
    return normalizeText(file.buffer.toString("utf8"));
  }

  // Lightweight PDF fallback without external parsers.
  if (mime === "application/pdf" || ext === "pdf") {
    const rough = file.buffer.toString("latin1").replace(/[^\x20-\x7E\n]/g, " ");
    return normalizeText(rough);
  }

  return "";
}

export function buildSourceSummary({ noteText, uploadText, youtube }) {
  const note = normalizeText(noteText);
  const uploaded = normalizeText(uploadText);
  const joined = [note, uploaded].filter(Boolean).join(" ");

  if (!joined && !youtube) {
    throw new Error("Provide notes text, a notes/PDF file, or a valid YouTube link.");
  }

  const sentences = splitSentences(joined);
  const shortSummary = sentences.slice(0, 4).join(" ");
  const keywords = new Set();

  for (const sentence of sentences.slice(0, 20)) {
    const words = sentence
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 5);
    for (const word of words) {
      if (keywords.size < 12) keywords.add(word);
    }
  }

  if (youtube?.videoId) {
    keywords.add("youtube");
    keywords.add("video");
  }

  return {
    summary: shortSummary || (youtube ? `YouTube source detected: ${youtube.canonicalUrl}` : "No clear summary extracted."),
    relatedKeywords: [...keywords].slice(0, 8),
    combinedText: joined,
  };
}

export function createFlashcards({ sourceText, maxCards = 12 }) {
  const sentences = splitSentences(sourceText).filter((line) => line.length > 24);
  const safeSentences = sentences.length ? sentences : splitSentences(`${sourceText}.`);
  const conceptCandidates = extractConcepts(sourceText);
  const total = Math.max(1, Math.floor(maxCards));
  const usedSentences = new Set();

  const cards = Array.from({ length: total }).map((_, index) => {
    const concept = conceptCandidates[index % Math.max(1, conceptCandidates.length)] || `topic ${index + 1}`;
    const sentence = sentenceForConcept(safeSentences, concept, usedSentences);
    const type = index % 4;

    let front = "";
    if (type === 0) front = `Define "${concept}" in simple words.`;
    if (type === 1) front = `Why is "${concept}" important in this topic?`;
    if (type === 2) front = `How does "${concept}" connect to related ideas?`;
    if (type === 3) front = `Give one example that shows "${concept}".`;

    const back = buildExplanationBlock(sentence, concept);
    return {
      id: `fc_${index + 1}`,
      front,
      back,
    };
  });

  return uniqueBy(cards, (card) => card.front.toLowerCase()).slice(0, total);
}

export function createQuizFromFlashcards(flashcards, maxQuestions = 8) {
  const items = (flashcards || []).slice(0, maxQuestions);
  const answerPool = items.map((item) => String(item.back || "").trim()).filter(Boolean);
  const misconceptionPool = [
    "It is only a memorization trick and has no practical use.",
    "It means the opposite of the concept in the notes.",
    "It applies in all cases without exceptions.",
    "It is unrelated to cause-and-effect reasoning.",
    "It only matters for advanced topics, not fundamentals.",
  ];

  return items.map((card, index) => {
    const correct = String(card.back || "").trim() || "Review your notes for this concept.";
    const distractors = [];

    for (const candidate of answerPool) {
      if (candidate !== correct && distractors.length < 2) {
        distractors.push(candidate);
      }
    }

    for (const wrong of misconceptionPool) {
      if (distractors.length >= 3) break;
      distractors.push(wrong);
    }

    const choices = uniqueBy([correct, ...distractors], (v) => v.toLowerCase()).slice(0, 4);
    while (choices.length < 4) {
      choices.push("This statement is not supported by the notes.");
    }

    const answerIndex = (index * 3) % 4;
    const orderedChoices = choices.slice(1);
    orderedChoices.splice(answerIndex, 0, choices[0]);

    return {
      id: `q_${index + 1}`,
      question: `Which answer best explains this flashcard: ${card.front}`,
      choices: orderedChoices,
      answerIndex,
      explanation: `Correct because: ${correct}`,
    };
  });
}

export function createBrainrotStoryboard({ sourceText, maxSeconds = 120 }) {
  const sentences = splitSentences(sourceText).filter((line) => line.length > 10).slice(0, 10);
  const slides = (sentences.length ? sentences : ["Study in short bursts.", "Review your notes daily.", "Test yourself with flashcards."])
    .map((line, index) => ({
      id: `slide_${index + 1}`,
      caption: toKeyConcept(line),
      durationSec: 8,
    }))
    .slice(0, Math.floor(maxSeconds / 8));

  const totalDuration = slides.reduce((sum, item) => sum + item.durationSec, 0);

  return {
    sessionId: crypto.randomUUID(),
    format: {
      style: "brainrot-tiktok",
      maxLengthSec: 120,
      resolution: "1280x720",
      temporary: true,
    },
    totalDurationSec: Math.min(totalDuration, 120),
    slides,
  };
}
