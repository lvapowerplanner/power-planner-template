"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { articleSearchText, docArticles } from "./docsData";

function rankedResults(query: string, limit?: number) {
  const cleanQuery = query.trim().toLowerCase();

  if (!cleanQuery) return docArticles.slice(0, limit ?? 9);

  const terms = cleanQuery.split(/\s+/).filter(Boolean);

  return docArticles
    .map((article) => {
      const text = articleSearchText(article);
      const title = article.title.toLowerCase();
      const tags = article.tags.join(" ").toLowerCase();
      const exactTitle = title.includes(cleanQuery) ? 10 : 0;
      const exactTag = tags.includes(cleanQuery) ? 7 : 0;
      const exactContent = text.includes(cleanQuery) ? 4 : 0;
      const termScore = terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
      const score = exactTitle + exactTag + exactContent + termScore;

      return { article, score };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title))
    .slice(0, limit)
    .map((result) => result.article);
}

export function DocsSearch() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => rankedResults(query, 12), [query]);

  return (
    <section style={styles.searchPanel}>
      <div style={styles.searchHeader}>
        <div>
          <p style={styles.kicker}>Search</p>
          <h2 style={styles.title}>Find guidance quickly</h2>
        </div>
        <span style={styles.count}>{results.length} result{results.length === 1 ? "" : "s"}</span>
      </div>

      <label style={styles.label}>
        <span style={styles.visuallyHidden}>Search documentation</span>
        <input
          style={styles.input}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search phase imbalance, reports, auto sources..."
        />
      </label>

      {query && (
        <button type="button" style={styles.clearButton} onClick={() => setQuery("")}>
          Clear search
        </button>
      )}

      <div style={styles.results}>
        {results.length === 0 ? (
          <p style={styles.muted}>No documentation articles found.</p>
        ) : (
          results.map((article) => (
            <Link key={article.slug} href={`/docs/${article.slug}`} style={styles.resultCard}>
              <span style={styles.category}>{article.category}</span>
              <strong>{article.title}</strong>
              <p style={styles.muted}>{article.description}</p>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

export function DocsCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useMemo(() => rankedResults(query, 8), [query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isSearchShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (!isSearchShortcut) return;

      event.preventDefault();
      setOpen(true);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div style={styles.paletteOverlay} onMouseDown={() => setOpen(false)}>
      <section style={styles.palette} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Search documentation">
        <div style={styles.paletteHeader}>
          <strong>Search documentation</strong>
          <button type="button" style={styles.paletteClose} onClick={() => setOpen(false)}>Esc</button>
        </div>
        <input
          autoFocus
          style={styles.paletteInput}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search articles, warnings, reports, auto sources..."
        />
        <div style={styles.paletteResults}>
          {results.length === 0 ? (
            <p style={styles.muted}>No matching articles.</p>
          ) : (
            results.map((article) => (
              <Link key={article.slug} href={`/docs/${article.slug}`} style={styles.paletteResult} onClick={() => setOpen(false)}>
                <span style={styles.category}>{article.category}</span>
                <strong>{article.title}</strong>
                <span>{article.description}</span>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  searchPanel: {
    border: "1px solid #DCE5EC",
    borderRadius: "28px",
    padding: "24px",
    background: "white",
    boxShadow: "0 18px 60px rgba(17, 24, 39, 0.08)",
  },
  searchHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    marginBottom: "16px",
  },
  kicker: {
    margin: 0,
    color: "#667085",
    fontWeight: 900,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontSize: "12px",
  },
  title: {
    margin: "6px 0 0",
    fontSize: "26px",
    letterSpacing: "-0.04em",
  },
  count: {
    padding: "7px 10px",
    borderRadius: "999px",
    background: "#F2F4F7",
    color: "#667085",
    fontSize: "13px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  label: { display: "block" },
  visuallyHidden: {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
  },
  input: {
    width: "100%",
    padding: "15px 17px",
    border: "1px solid #DCE5EC",
    borderRadius: "16px",
    font: "inherit",
    fontSize: "16px",
    outline: "none",
  },
  clearButton: {
    marginTop: "10px",
    padding: "8px 12px",
    border: "1px solid #DCE5EC",
    borderRadius: "999px",
    background: "#FFFFFF",
    cursor: "pointer",
    fontWeight: 700,
    color: "#344054",
  },
  results: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "12px",
    marginTop: "18px",
  },
  resultCard: {
    display: "block",
    padding: "16px",
    border: "1px solid #E5EAF0",
    borderRadius: "18px",
    color: "#172033",
    textDecoration: "none",
    background: "#F8FAFC",
  },
  category: {
    display: "block",
    marginBottom: "8px",
    color: "#667085",
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  muted: {
    color: "#667085",
    marginBottom: 0,
    lineHeight: 1.5,
  },
  paletteOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "rgba(17, 24, 39, 0.42)",
    padding: "8vh 18px",
  },
  palette: {
    maxWidth: "720px",
    margin: "0 auto",
    background: "white",
    borderRadius: "24px",
    border: "1px solid #E5E7EB",
    boxShadow: "0 28px 90px rgba(17, 24, 39, 0.32)",
    padding: "18px",
  },
  paletteHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  paletteClose: {
    border: "1px solid #D0D5DD",
    borderRadius: "999px",
    background: "#F8FAFC",
    padding: "6px 10px",
    fontWeight: 800,
    color: "#475467",
  },
  paletteInput: {
    width: "100%",
    border: "1px solid #D0D5DD",
    borderRadius: "16px",
    padding: "15px 16px",
    font: "inherit",
    fontSize: "17px",
    outline: "none",
  },
  paletteResults: {
    display: "grid",
    gap: "10px",
    marginTop: "14px",
    maxHeight: "58vh",
    overflow: "auto",
  },
  paletteResult: {
    display: "grid",
    gap: "5px",
    padding: "14px",
    borderRadius: "16px",
    textDecoration: "none",
    color: "#172033",
    border: "1px solid #EEF2F6",
    background: "#FCFCFD",
  },
};
