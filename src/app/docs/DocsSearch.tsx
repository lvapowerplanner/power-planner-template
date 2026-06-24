"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { docArticles } from "./docsData";

export function DocsSearch() {
  const [query, setQuery] = useState("");
  const cleanQuery = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!cleanQuery) return docArticles.slice(0, 8);

    return docArticles
      .map((article) => {
        const searchableContent = [
          article.title,
          article.description,
          article.category,
          article.summary,
          ...article.sections.flatMap((section) => [
            section.heading,
            ...section.body,
            ...(section.steps ?? []),
            section.callout?.title ?? "",
            section.callout?.body ?? "",
          ]),
        ].join(" ").toLowerCase();

        const titleMatch = article.title.toLowerCase().includes(cleanQuery) ? 3 : 0;
        const descriptionMatch = article.description.toLowerCase().includes(cleanQuery) ? 2 : 0;
        const contentMatch = searchableContent.includes(cleanQuery) ? 1 : 0;
        const score = titleMatch + descriptionMatch + contentMatch;

        return { article, score };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((result) => result.article);
  }, [cleanQuery]);

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
  label: {
    display: "block",
  },
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
};
