"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  SearchX,
  ShieldCheck,
  UserCheck,
  Layers,
} from "lucide-react";
import { ToolCard } from "@/components/shared/ToolCard";
import { cn } from "@/lib/utils";
import {
  ALL_TOOLS,
  POPULAR_TOOLS,
  TOOL_CATEGORIES,
  type SiteTool,
} from "./tools";

const GRID =
  "grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4";

const SEARCH_INDEX = ALL_TOOLS.map((tool) => ({
  tool,
  title: tool.title.toLowerCase(),
  text: `${tool.title} ${tool.description} ${tool.keywords}`.toLowerCase(),
}));

/** Every whitespace-separated term must match; title matches rank first. */
function searchTools(query: string): SiteTool[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return ALL_TOOLS;
  const scored: { tool: SiteTool; score: number }[] = [];
  for (const entry of SEARCH_INDEX) {
    if (!terms.every((t) => entry.text.includes(t))) continue;
    let score = 0;
    for (const t of terms) {
      if (entry.title.startsWith(t)) score += 3;
      else if (entry.title.includes(t)) score += 2;
      else score += 1;
    }
    scored.push({ tool: entry.tool, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.tool);
}

interface ToolExplorerProps {
  /** Server-rendered heading block (h1 + intro) shown above the search box. */
  header: ReactNode;
}

export function ToolExplorer({ header }: ToolExplorerProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  const trimmed = query.trim();
  const searching = trimmed.length > 0;
  const results = useMemo(() => searchTools(trimmed), [trimmed]);

  // "/" focuses the search box (like most docs sites), unless typing elsewhere.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el?.isContentEditable
      )
        return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (query) {
        e.preventDefault();
        setQuery("");
      } else {
        inputRef.current?.blur();
      }
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (searching && results.length > 0) router.push(results[0].href);
  };

  const clear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <>
      {/* Hero */}
      <section
        aria-labelledby="hero-heading"
        className="border-b bg-gradient-to-b from-blue-50/70 to-background"
      >
        <div className="container mx-auto px-4 pb-8 pt-8 text-center sm:pb-12 sm:pt-12">
          {header}

          <form
            role="search"
            aria-label="Find a tool"
            onSubmit={onSubmit}
            className="mx-auto mt-6 max-w-2xl sm:mt-8"
          >
            <label htmlFor="tool-search" className="sr-only">
              Search {ALL_TOOLS.length} tools
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
              />
              <input
                id="tool-search"
                ref={inputRef}
                type="text"
                inputMode="search"
                enterKeyHint="go"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                aria-controls="tool-results"
                placeholder="Search: compress, merge, jpg, word..."
                className="h-12 w-full rounded-xl border border-input bg-background pl-12 pr-12 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:h-14"
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {query ? (
                  <button
                    type="button"
                    onClick={clear}
                    aria-label="Clear search"
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                ) : (
                  <kbd
                    aria-hidden="true"
                    className="mr-2 hidden h-6 min-w-6 items-center justify-center rounded border bg-muted px-1.5 font-sans text-xs font-medium text-muted-foreground md:inline-flex"
                  >
                    /
                  </kbd>
                )}
              </div>
            </div>
          </form>

          {!searching && (
            <>
              {/* Popular tools: the most used actions, one tap away */}
              <div className="mx-auto mt-5 max-w-3xl sm:mt-6">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Popular tools
                </p>
                <ul className="flex flex-wrap justify-center gap-2">
                  {POPULAR_TOOLS.map((tool, i) => (
                    <li
                      key={tool.href}
                      className={i >= 6 ? "max-sm:hidden" : undefined}
                    >
                      <Link
                        href={tool.href}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border bg-background px-3.5 text-sm font-medium shadow-sm transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:bg-accent sm:min-h-[40px]"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-md text-white",
                            tool.color,
                          )}
                        >
                          <tool.icon className="h-3.5 w-3.5" />
                        </span>
                        {tool.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Honest trust statements */}
              <ul className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <li className="inline-flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
                  {ALL_TOOLS.length} tools for PDF, images and documents
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <UserCheck
                    className="h-4 w-4 text-primary"
                    aria-hidden="true"
                  />
                  No sign-up needed
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <ShieldCheck
                    className="h-4 w-4 text-primary"
                    aria-hidden="true"
                  />
                  Files are deleted automatically after 2 minutes
                </li>
              </ul>
            </>
          )}
        </div>
      </section>

      <div className="container mx-auto px-4 py-8 sm:py-10">
        <p role="status" aria-live="polite" className="sr-only">
          {searching
            ? results.length === 0
              ? `No tools match ${trimmed}`
              : `${results.length} ${results.length === 1 ? "tool" : "tools"} found`
            : ""}
        </p>

        {/* Category quick-jump (hidden while searching) */}
        {!searching && (
          <nav aria-label="Tool categories" className="-mt-1 mb-8 sm:mb-10">
            <ul className="flex flex-wrap justify-center gap-2">
              {TOOL_CATEGORIES.map((cat) => (
                <li key={cat.id}>
                  <a
                    href={`#${cat.id}`}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-[40px]"
                  >
                    <cat.icon
                      className={cn("h-4 w-4", cat.textColor)}
                      aria-hidden="true"
                    />
                    {cat.label}
                    <span className="text-muted-foreground">
                      {cat.tools.length}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div id="tool-results">
          {searching ? (
            results.length > 0 ? (
              <section aria-labelledby="results-heading">
                <h2
                  id="results-heading"
                  className="mb-4 text-lg font-semibold sm:text-xl"
                >
                  {results.length} {results.length === 1 ? "tool" : "tools"} for
                  &ldquo;{trimmed}&rdquo;
                </h2>
                <div className={GRID}>
                  {results.map((tool) => (
                    <ToolCard key={tool.href} {...tool} />
                  ))}
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Press Enter to open the first result.
                </p>
              </section>
            ) : (
              <section
                aria-labelledby="empty-heading"
                className="mx-auto max-w-xl rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center"
              >
                <SearchX
                  className="mx-auto mb-3 h-10 w-10 text-muted-foreground"
                  aria-hidden="true"
                />
                <h2 id="empty-heading" className="text-lg font-semibold">
                  No tools match &ldquo;{trimmed}&rdquo;
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try a shorter word, a file type such as &ldquo;jpg&rdquo; or
                  &ldquo;docx&rdquo;, or an action such as &ldquo;merge&rdquo;
                  or &ldquo;compress&rdquo;.
                </p>
                <button
                  type="button"
                  onClick={clear}
                  className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Clear search and show all tools
                </button>
              </section>
            )
          ) : (
            TOOL_CATEGORIES.map((cat) => (
              <section
                key={cat.id}
                id={cat.id}
                aria-labelledby={`${cat.id}-heading`}
                className="mb-10 scroll-mt-20 sm:mb-12"
              >
                <div className="mb-4 flex items-center gap-3 sm:mb-5">
                  <div
                    aria-hidden="true"
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm sm:h-10 sm:w-10",
                      cat.color,
                    )}
                  >
                    <cat.icon className="h-5 w-5" />
                  </div>
                  <h2
                    id={`${cat.id}-heading`}
                    className="text-xl font-semibold sm:text-2xl"
                  >
                    {cat.label}
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {cat.tools.length}
                  </span>
                </div>
                <div className={GRID}>
                  {cat.tools.map((tool) => (
                    <ToolCard key={tool.href} {...tool} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </>
  );
}
