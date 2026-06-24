"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { docArticles } from "./docsData";

export function DocsSearch() {
  const [query, setQuery] = useState("");
  const cleanQuery = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!cleanQuery) return docArticles.slice(0, 6);

    return docArticles.filter((article) => {
      const content = [
        article.title,
        article.description,
        article.category,
        ...article.sections.flatMap((section) => [
          section.heading,
          ...section.body,
          section.callout?.title ?? "",
          section.callout?.body ?? "",
        ]),
      ]
        .join(" ")
        .toLowerCase();

      return content.includes(cleanQuery);
    });
  }, [cleanQuery]);

  return (
    <section style={styles.searchPanel}>
      <label style={styles.label}>
        Search documentation
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
    borderRadius: "24px",
    padding: "22px",
    background: "white",
    boxShadow: "0 2px 8px rgba(17, 24, 39, 0.04)",
  },
  label: {
    display: "block",
    fontWeight: 700,
    color: "#172033",
  },
  input: {
    width: "100%",
    marginTop: "10px",
    padding: "14px 16px",
    border: "1px solid #DCE5EC",
    borderRadius: "14px",
    font: "inherit",
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
    borderRadius: "16px",
    color: "#172033",
    textDecoration: "none",
    background: "#F8FAFC",
  },
  category: {
    display: "block",
    marginBottom: "8px",
    color: "#667085",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  muted: {
    color: "#667085",
    marginBottom: 0,
  },
};
