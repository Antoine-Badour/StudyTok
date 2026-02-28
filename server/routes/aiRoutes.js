import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import { requireUser } from "../middleware/authMiddleware.js";
import {
  buildSourceSummary,
  createFlashcards,
  createQuizFromFlashcards,
  extractTextFromUpload,
  parseYouTubeLink,
} from "../services/aiModeService.js";
import { maybeEnrichSource } from "../services/internetKnowledgeService.js";
import { awardPoints } from "../services/pointsService.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 12 },
});
const temporaryQuizSessions = new Map();

router.post("/analyze-source", requireUser, upload.single("notesFile"), async (req, res) => {
  try {
    const noteText = String(req.body?.noteText || "");
    const userQuestion = String(req.body?.userQuestion || "");
    const youtubeLink = String(req.body?.youtubeLink || "");
    const youtube = youtubeLink ? parseYouTubeLink(youtubeLink) : null;

    if (youtubeLink && !youtube) {
      return res.status(400).json({ error: "Only valid YouTube links are supported." });
    }

    const uploadText = extractTextFromUpload(req.file);
    const summary = buildSourceSummary({ noteText, uploadText, youtube });
    const enriched = await maybeEnrichSource({
      sourceText: summary.combinedText || summary.summary,
      userQuestion,
    });

    return res.json({
      summary: summary.summary,
      relatedKeywords: summary.relatedKeywords,
      sourceText: enriched.finalSourceText,
      youtube,
      enrichmentUsed: enriched.enrichmentUsed,
      enrichmentQuery: enriched.enrichmentQuery,
      enrichmentQueries: enriched.enrichmentQueries || [],
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to process source." });
  }
});

router.post("/flashcards", requireUser, async (req, res) => {
  try {
    const sourceText = String(req.body?.sourceText || "").trim();
    const userQuestion = String(req.body?.userQuestion || "").trim();
    if (!sourceText) return res.status(400).json({ error: "sourceText is required." });
    const requestedCount = Number(req.body?.maxCards);
    const maxCards = Number.isInteger(requestedCount) ? requestedCount : 20;
    if (maxCards < 15 || maxCards > 100) {
      return res.status(400).json({ error: "maxCards must be between 15 and 100." });
    }

    const enriched = await maybeEnrichSource({ sourceText, userQuestion });
    const flashcards = createFlashcards({ sourceText: enriched.finalSourceText, maxCards });
    const points = await awardPoints({
      userId: req.user.id,
      points: 8,
      reason: "flashcards_generated",
      metadata: { card_count: flashcards.length },
    });
    return res.json({
      flashcards,
      enrichmentUsed: enriched.enrichmentUsed,
      enrichmentQuery: enriched.enrichmentQuery,
      enrichmentQueries: enriched.enrichmentQueries || [],
      pointsAwarded: points.awarded,
      totalPoints: points.totalPoints,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to generate flashcards." });
  }
});

router.post("/quiz", requireUser, async (req, res) => {
  try {
    const flashcards = Array.isArray(req.body?.flashcards) ? req.body.flashcards : [];
    if (!flashcards.length) return res.status(400).json({ error: "flashcards are required." });

    const quiz = createQuizFromFlashcards(flashcards, 8);
    const sessionId = crypto.randomUUID();
    temporaryQuizSessions.set(sessionId, {
      userId: req.user.id,
      createdAt: Date.now(),
      quiz,
    });

    const quizForClient = quiz.map((item) => ({
      id: item.id,
      question: item.question,
      choices: item.choices,
    }));

    return res.json({ quizSessionId: sessionId, quiz: quizForClient });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to generate quiz." });
  }
});

router.post("/quiz/submit", requireUser, async (req, res) => {
  try {
    const quizSessionId = String(req.body?.quizSessionId || "").trim();
    const answers = req.body?.answers && typeof req.body.answers === "object" ? req.body.answers : {};
    if (!quizSessionId) return res.status(400).json({ error: "quizSessionId is required." });

    const session = temporaryQuizSessions.get(quizSessionId);
    if (!session || session.userId !== req.user.id) {
      return res.status(400).json({ error: "Quiz session not found or expired." });
    }

    if (Date.now() - session.createdAt > 1000 * 60 * 30) {
      temporaryQuizSessions.delete(quizSessionId);
      return res.status(400).json({ error: "Quiz session expired. Generate a new quiz." });
    }

    const gradedQuiz = session.quiz.map((item) => {
      const selectedIndex = Number(answers[item.id]);
      const selected = Number.isInteger(selectedIndex) ? selectedIndex : null;
      const isCorrect = selected === item.answerIndex;
      return {
        id: item.id,
        question: item.question,
        choices: item.choices,
        answerIndex: item.answerIndex,
        selectedIndex: selected,
        isCorrect,
        explanation: item.explanation,
      };
    });

    const total = gradedQuiz.length;
    const correctCount = gradedQuiz.reduce((sum, item) => sum + (item.isCorrect ? 1 : 0), 0);
    const pointsToAward = correctCount * 3;

    const points = await awardPoints({
      userId: req.user.id,
      points: pointsToAward,
      reason: "quiz_submitted",
      metadata: { quiz_session_id: quizSessionId, total, correct_count: correctCount },
    });

    temporaryQuizSessions.delete(quizSessionId);

    return res.json({
      score: correctCount,
      total,
      gradedQuiz,
      pointsAwarded: points.awarded,
      totalPoints: points.totalPoints,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to submit quiz." });
  }
});

export default router;
