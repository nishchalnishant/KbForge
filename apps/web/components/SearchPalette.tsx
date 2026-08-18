"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type SearchEntry = {
  id: string;
  title: string;
  text: string;
  topic: string;
  level: string;
};

export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isK = e.key.toLowerCase() === "k";
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open && !index) {
      fetch("/api/search")
        .then((r) => r.json())
        .then(setIndex)
        .catch(() => setIndex([]));
    }
    if (open) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, index]);

  const results = useMemo(() => {
    if (!index || query.trim().length === 0) return [];
    const q = query.trim().toLowerCase();
    return index
      .filter((e) => e.title.toLowerCase().includes(q) || e.text.toLowerCase().includes(q))
      .slice(0, 8);
  }, [index, query]);

  const go = useCallback(
    (id: string) => {
      setOpen(false);
      router.push(`/node/${id}`);
    },
    [router]
  );

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active].id);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="search-trigger"
        onClick={() => setOpen(true)}
        aria-label="Search"
      >
        <span>Search</span>
        <kbd>⌘K</kbd>
      </button>
    );
  }

  if (!mounted) return null;

  return createPortal(
    <div className="search-overlay" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
      <div className="search-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search concepts…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onInputKeyDown}
        />
        {query.trim().length > 0 && (
          <ul className="search-results">
            {results.length === 0 && <li className="search-empty">No matches</li>}
            {results.map((r, i) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={`search-result${i === active ? " search-result-active" : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r.id)}
                >
                  <span className="search-result-title">{r.title}</span>
                  <span className="search-result-topic">{r.topic}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body
  );
}
