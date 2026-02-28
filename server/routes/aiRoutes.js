import { Router } from "express";
import multer from "multer";
import { requireUser } from "../middleware/authMiddleware.js";
import {
  buildSourceSummary,
  createFlashcards,
  createQuizFromFlashcards,
  extractTextFromUpload,
  parseYouTubeLink,
} from "../services/aiModeService.js";
import { maybeEnrichSource } from "../services/internetKnowledgeService.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 12 },
});

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
    return res.json({
      flashcards,
      enrichmentUsed: enriched.enrichmentUsed,
      enrichmentQuery: enriched.enrichmentQuery,
      enrichmentQueries: enriched.enrichmentQueries || [],
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
    return res.json({ quiz });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to generate quiz." });
  }
});

export default router;
