function cleanText(input) {
  return String(input || "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitWords(text) {
  return cleanText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4);
}

function pickPrimaryQuery({ sourceText, userQuestion }) {
  const question = cleanText(userQuestion);
  if (question.length >= 6) return question;

  const words = splitWords(sourceText);
  const unique = [...new Set(words)].slice(0, 6);
  return unique.join(" ");
}

function buildQueryCandidates({ sourceText, userQuestion }) {
  const primary = pickPrimaryQuery({ sourceText, userQuestion });
  const words = splitWords(sourceText);
  const questionWords = splitWords(userQuestion);

  const candidates = [
    primary,
    questionWords.slice(0, 6).join(" "),
    words.slice(0, 6).join(" "),
    words.slice(2, 8).join(" "),
  ]
    .map((q) => cleanText(q))
    .filter(Boolean);

  return [...new Set(candidates)].slice(0, 3);
}

async function safeJsonFetch(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchDuckDuckGoSummary(query) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const data = await safeJsonFetch(url);
  if (!data) return "";

  const abstract = cleanText(data.AbstractText);
  if (abstract) return abstract;

  const topic = Array.isArray(data.RelatedTopics)
    ? data.RelatedTopics.find((item) => cleanText(item?.Text))
    : null;
  return cleanText(topic?.Text || "");
}

async function fetchWikipediaSummary(query) {
  const searchUrl = `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(query)}&limit=1`;
  const search = await safeJsonFetch(searchUrl);
  const title = search?.pages?.[0]?.title;
  if (!title) return "";

  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const summary = await safeJsonFetch(summaryUrl);
  return cleanText(summary?.extract || "");
}

export async function buildKnowledgeContext({ sourceText, userQuestion }) {
  const queries = buildQueryCandidates({ sourceText, userQuestion });
  if (!queries.length) return { query: "", snippets: [], queries: [] };

  const snippets = [];
  for (const query of queries) {
    const [duck, wiki] = await Promise.all([fetchDuckDuckGoSummary(query), fetchWikipediaSummary(query)]);
    for (const snippet of [duck, wiki]) {
      const text = cleanText(snippet);
      if (!text) continue;
      if (!snippets.includes(text)) snippets.push(text);
      if (snippets.length >= 6) break;
    }
    if (snippets.length >= 6) break;
  }

  return {
    query: queries[0] || "",
    snippets,
    queries,
  };
}

export async function maybeEnrichSource({ sourceText, userQuestion }) {
  const base = cleanText(sourceText);
  const question = cleanText(userQuestion);

  // Agent mode: always attempt web enrichment first, then gracefully fallback.
  const { query, snippets, queries } = await buildKnowledgeContext({ sourceText: base, userQuestion: question });
  if (!snippets.length) {
    return {
      finalSourceText: cleanText([base, question].filter(Boolean).join(" ")),
      enrichmentUsed: false,
      enrichmentQuery: query,
      enrichmentQueries: queries || [],
    };
  }

  const enrichmentText = snippets.join(" ");
  const finalSourceText = cleanText([base, question, enrichmentText].filter(Boolean).join(" "));

  return {
    finalSourceText,
    enrichmentUsed: true,
    enrichmentQuery: query,
    enrichmentQueries: queries || [],
  };
}
