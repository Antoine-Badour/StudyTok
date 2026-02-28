import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../lib/apiClient";
import { supabase } from "../lib/supabaseClient";

export default function AIModePage() {
  const navigate = useNavigate();
  const [noteText, setNoteText] = useState("");
  const [userQuestion, setUserQuestion] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [notesFile, setNotesFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [summary, setSummary] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [enrichmentUsed, setEnrichmentUsed] = useState(false);
  const [enrichmentQueries, setEnrichmentQueries] = useState([]);
  const [flashcards, setFlashcards] = useState([]);
  const [quiz, setQuiz] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizSessionId, setQuizSessionId] = useState("");
  const [quizResult, setQuizResult] = useState(null);
  const [pointsNotice, setPointsNotice] = useState("");

  const runWithAuth = async (callback) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Missing active session.");
    return callback(session.access_token);
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError("");
    setSummary("");
    setEnrichmentUsed(false);
    setEnrichmentQueries([]);
    setFlashcards([]);
    setQuiz([]);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizSessionId("");
    setQuizResult(null);
    setPointsNotice("");

    try {
      await runWithAuth(async (token) => {
        const formData = new FormData();
        formData.append("noteText", noteText);
        formData.append("userQuestion", userQuestion);
        formData.append("youtubeLink", youtubeLink);
        if (notesFile) formData.append("notesFile", notesFile);

        const response = await apiClient.post("/ai/analyze-source", formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });

        setSummary(response.data?.summary || "");
        setSourceText(response.data?.sourceText || "");
        setKeywords(response.data?.relatedKeywords || []);
        setEnrichmentUsed(Boolean(response.data?.enrichmentUsed));
        setEnrichmentQueries(Array.isArray(response.data?.enrichmentQueries) ? response.data.enrichmentQueries : []);
      });
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || "Could not process source.");
    } finally {
      setLoading(false);
    }
  };

  const handleFlashcards = async () => {
    const text = (sourceText || noteText).trim();
    if (!text) return;
    const rawValue = window.prompt("How many flashcards do you want? Enter a number from 15 to 100.", "20");
    if (rawValue === null) return;
    const maxCards = Number(rawValue);
    if (!Number.isInteger(maxCards) || maxCards < 15 || maxCards > 100) {
      setError("Please enter a whole number between 15 and 100.");
      return;
    }

    setLoading(true);
    setError("");
    setQuiz([]);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizSessionId("");
    setQuizResult(null);
    try {
      await runWithAuth(async (token) => {
        const response = await apiClient.post(
          "/ai/flashcards",
          { sourceText: text, userQuestion, maxCards },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setFlashcards(response.data?.flashcards || []);
        if (typeof response.data?.pointsAwarded === "number") {
          setPointsNotice(`+${response.data.pointsAwarded} points for generating flashcards.`);
        }
        if (Array.isArray(response.data?.enrichmentQueries) && response.data.enrichmentQueries.length) {
          setEnrichmentQueries(response.data.enrichmentQueries);
        }
        if (typeof response.data?.enrichmentUsed === "boolean") {
          setEnrichmentUsed(response.data.enrichmentUsed);
        }
      });
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || "Failed to create flashcards.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuiz = async () => {
    if (!flashcards.length) return;
    setLoading(true);
    setError("");
    try {
      await runWithAuth(async (token) => {
        const response = await apiClient.post(
          "/ai/quiz",
          { flashcards },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setQuizSessionId(response.data?.quizSessionId || "");
        setQuiz(response.data?.quiz || []);
        setQuizAnswers({});
        setQuizSubmitted(false);
        setQuizResult(null);
      });
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || "Failed to create quiz.");
    } finally {
      setLoading(false);
    }
  };

  const searchText = useMemo(() => keywords.slice(0, 1)[0] || "", [keywords]);
  const hasGenerationText = Boolean((sourceText || noteText).trim());
  const quizScore = useMemo(() => {
    return quizResult?.score ?? 0;
  }, [quizResult]);

  const handleSelectAnswer = (questionId, answerIndex) => {
    if (quizSubmitted) return;
    setQuizAnswers((prev) => ({ ...prev, [questionId]: answerIndex }));
  };

  const handleSubmitQuiz = () => {
    if (!quiz.length) return;
    if (!quizSessionId) {
      setError("Quiz session expired. Generate a new quiz.");
      return;
    }
    const answeredCount = Object.keys(quizAnswers).length;
    if (answeredCount < quiz.length) {
      setError("Answer all quiz questions before submitting.");
      return;
    }
    setLoading(true);
    setError("");
    runWithAuth(async (token) => {
      const response = await apiClient.post(
        "/ai/quiz/submit",
        { quizSessionId, answers: quizAnswers },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const gradedQuiz = response.data?.gradedQuiz || [];
      setQuiz(gradedQuiz);
      const syncedAnswers = {};
      gradedQuiz.forEach((item) => {
        if (Number.isInteger(item.selectedIndex)) syncedAnswers[item.id] = item.selectedIndex;
      });
      setQuizAnswers(syncedAnswers);
      setQuizSubmitted(true);
      setQuizResult({
        score: response.data?.score || 0,
        total: response.data?.total || gradedQuiz.length,
        pointsAwarded: response.data?.pointsAwarded || 0,
      });
      setPointsNotice(`+${response.data?.pointsAwarded || 0} points from quiz score.`);
    })
      .catch((requestError) => {
        setError(requestError?.response?.data?.error || requestError.message || "Failed to submit quiz.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <section className="mx-auto mb-24 max-w-5xl space-y-4 p-4">
      <div className="app-surface rounded-2xl p-5">
        <h1 className="text-2xl font-semibold text-white">AI Mode</h1>
        <p className="mt-1 text-sm text-white/70">
          Add notes text, upload notes/PDF, or paste a YouTube link. AI agent auto-researches the web server-side.
        </p>
        <p className="mt-2 text-xs text-white/60">
          Internet research:{" "}
          <span style={{ color: enrichmentUsed ? "var(--app-accent)" : "inherit" }}>
            {enrichmentUsed ? "Used" : "Standby"}
          </span>
        </p>
        {enrichmentQueries.length ? (
          <p className="mt-1 text-xs text-white/55">Queries: {enrichmentQueries.join(" | ")}</p>
        ) : null}
      </div>

      <div className="app-surface rounded-2xl p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <textarea
            rows={7}
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Paste notes text here..."
            className="app-input rounded-lg p-3"
          />
          <div className="space-y-3">
            <input
              type="text"
              value={userQuestion}
              onChange={(event) => setUserQuestion(event.target.value)}
              placeholder="Ask AI anything about this topic..."
              className="app-input w-full rounded-lg p-3"
            />
            <input
              type="url"
              value={youtubeLink}
              onChange={(event) => setYoutubeLink(event.target.value)}
              placeholder="YouTube link only"
              className="app-input w-full rounded-lg p-3"
            />
            <input
              type="file"
              accept=".txt,.md,.pdf"
              onChange={(event) => setNotesFile(event.target.files?.[0] || null)}
              className="app-input w-full rounded-lg p-3 text-white/85 file:mr-3 file:rounded file:border-0 file:px-3 file:py-1 file:text-white"
            />
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={loading}
              className="app-button-primary w-full rounded-lg p-3 text-sm font-medium disabled:opacity-60"
            >
              {loading ? "Processing..." : "Process Source"}
            </button>
          </div>
        </div>
        {error ? <p className="mt-2 text-sm text-rose-400">{error}</p> : null}
        {pointsNotice ? (
          <p className="mt-2 text-sm" style={{ color: "var(--app-accent)" }}>
            {pointsNotice}
          </p>
        ) : null}
      </div>

      <div className="app-surface rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-white">Study Actions</h2>
        <p className="mt-1 text-sm text-white/70">
          Process source first, then generate flashcards and quiz.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => searchText && navigate(`/?q=${encodeURIComponent(searchText)}`)}
            disabled={!searchText}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/90 disabled:opacity-40"
          >
            Search Related Posts
          </button>
          <button
            type="button"
            onClick={handleFlashcards}
            disabled={loading || !hasGenerationText}
            className="app-button-primary rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Make Flashcards
          </button>
          <button
            type="button"
            onClick={handleQuiz}
            disabled={loading || !flashcards.length}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/90 disabled:opacity-40"
          >
            Make Quiz
          </button>
        </div>
      </div>

      {summary ? (
        <div className="app-surface rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-white">AI Summary</h2>
          <p className="mt-2 text-sm text-white/85">{summary}</p>
          {keywords.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {keywords.map((word) => (
                <span key={word} className="rounded-full border border-white/15 px-2 py-1 text-xs text-white/85">
                  {word}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {flashcards.length ? (
        <div className="app-surface rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Flashcards</h2>
            <p className="text-xs text-white/60">Quiz available once cards are generated</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {flashcards.map((card) => (
              <article key={card.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-wide text-white/60">{card.front}</p>
                <p className="mt-1 text-sm text-white/90">{card.back}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {quiz.length ? (
        <div className="app-surface rounded-2xl p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-white">Quiz</h2>
            {!quizSubmitted ? (
              <button
                type="button"
                onClick={handleSubmitQuiz}
                className="app-button-primary rounded-lg px-3 py-2 text-sm font-medium"
              >
                Submit Quiz
              </button>
            ) : (
              <p className="text-sm text-white/85">
                Score:{" "}
                <span style={{ color: "var(--app-accent)" }}>
                  {quizScore}/{quizResult?.total || quiz.length}
                </span>
              </p>
            )}
          </div>
          <div className="space-y-3">
            {quiz.map((item, idx) => (
              <article key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-sm font-medium text-white">
                  {idx + 1}. {item.question}
                </p>
                <ul className="mt-2 space-y-2 text-sm text-white/85">
                  {item.choices.map((choice, choiceIndex) => (
                    <li key={`${item.id}_${choiceIndex}`}>
                      <button
                        type="button"
                        onClick={() => handleSelectAnswer(item.id, choiceIndex)}
                        disabled={quizSubmitted}
                        className="w-full rounded-lg border border-white/10 px-3 py-2 text-left transition hover:bg-white/5 disabled:cursor-default"
                        style={
                          quizSubmitted
                            ? choiceIndex === item.answerIndex
                              ? { borderColor: "#22C55E", backgroundColor: "rgba(34,197,94,0.16)" }
                                : quizAnswers[item.id] === choiceIndex
                                ? { borderColor: "#DC2626", backgroundColor: "rgba(220,38,38,0.16)" }
                                : undefined
                            : quizAnswers[item.id] === choiceIndex
                              ? { borderColor: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }
                              : undefined
                        }
                      >
                        {String.fromCharCode(65 + choiceIndex)}. {choice}
                      </button>
                    </li>
                  ))}
                </ul>
                {quizSubmitted ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs" style={{ color: "var(--app-accent)" }}>
                      Correct answer: {String.fromCharCode(65 + item.answerIndex)}
                    </p>
                    <p className="text-xs text-white/85">{item.explanation}</p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {!hasGenerationText ? (
        <div className="app-surface rounded-2xl p-5 text-sm text-white/70">
          Add notes text (or process source) to enable generation.
        </div>
      ) : null}
    </section>
  );
}
