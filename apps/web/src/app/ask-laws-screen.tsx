'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type Locator = {
  lawNumber: string | null;
  headingPath: string[];
  pageStart: number;
  pageEnd: number;
  paragraphOrdinal: number;
};

type EvidenceItem = {
  id: string;
  label: string;
  excerpt: string;
  sourceTitle: string;
  canonicalUrl: string;
  edition: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  locator: Locator;
  rank: number;
};

type AskResponse =
  | {
      kind: 'answer';
      answer: {
        answerUnits: Array<{
          text: string;
          type: 'summary' | 'quote';
          citations: string[];
        }>;
        evidence: EvidenceItem[];
        resolvedEdition: string;
        resolutionReason: string;
      };
    }
  | {
      kind: 'clarification';
      clarification: { question: string; reason: string };
    }
  | {
      kind: 'insufficient_evidence';
      insufficientEvidence: { explanation: string; missingEvidence: string[] };
    };

type FilterMode = 'none' | 'edition' | 'season';

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';
}

export function AskLawsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const resultRef = useRef<HTMLElement>(null);
  const headingId = useId();
  const didLoadFromUrl = useRef(false);

  const [query, setQuery] = useState(params.get('q') ?? '');
  const [filterMode, setFilterMode] = useState<FilterMode>(
    params.get('edition')
      ? 'edition'
      : params.get('season')
        ? 'season'
        : 'none',
  );
  const [edition, setEdition] = useState(params.get('edition') ?? '');
  const [season, setSeason] = useState(params.get('season') ?? '');
  const [editions, setEditions] = useState<
    Array<{ edition: string; effectiveFrom: string }>
  >([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(true);

  useEffect(() => {
    void fetch(`${apiBase()}/law-editions`)
      .then((response) => (response.ok ? response.json() : []))
      .then((rows: Array<{ edition: string; effectiveFrom: string }>) =>
        setEditions(rows),
      )
      .catch(() => setEditions([]));
  }, []);

  const submit = useCallback(
    async (
      nextQuery: string,
      nextEdition: string,
      nextSeason: string,
      mode: FilterMode,
    ) => {
      const body: Record<string, string> = { query: nextQuery, mode: 'laws' };
      if (mode === 'edition' && nextEdition) {
        body.edition = nextEdition;
      }
      if (mode === 'season' && nextSeason) {
        body.season = nextSeason;
      }
      const search = new URLSearchParams();
      search.set('q', nextQuery);
      if (mode === 'edition' && nextEdition) {
        search.set('edition', nextEdition);
      }
      if (mode === 'season' && nextSeason) {
        search.set('season', nextSeason);
      }
      router.replace(`${pathname}?${search.toString()}`);
      setPending(true);
      setError(null);
      try {
        const response = await fetch(`${apiBase()}/ask`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          throw new Error(`Ask failed (${response.status})`);
        }
        const payload = (await response.json()) as AskResponse;
        setResult(payload);
        queueMicrotask(() => resultRef.current?.focus());
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Ask failed');
      } finally {
        setPending(false);
      }
    },
    [pathname, router],
  );

  useEffect(() => {
    if (didLoadFromUrl.current) {
      return;
    }
    const initial = params.get('q');
    if (!initial) {
      return;
    }
    didLoadFromUrl.current = true;
    void submit(
      initial,
      params.get('edition') ?? '',
      params.get('season') ?? '',
      params.get('edition')
        ? 'edition'
        : params.get('season')
          ? 'season'
          : 'none',
    );
  }, [params, submit]);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Ask the Laws
        </p>
        <h1 id={headingId} className="text-3xl font-semibold tracking-tight">
          Football VAR Decision Explorer
        </h1>
        <p className="mt-2 max-w-2xl text-slate-700">
          Ask a question about the synthetic law corpus. Answers are cited to
          stored passages, or the system will ask for clarification or abstain.
        </p>
      </header>

      <form
        className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(query, edition, season, filterMode);
        }}
        aria-labelledby={headingId}
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Question</span>
          <textarea
            name="q"
            rows={3}
            required
            minLength={3}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-base"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Time scope</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="filterMode"
              checked={filterMode === 'none'}
              onChange={() => setFilterMode('none')}
            />
            Latest published edition
          </label>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <input
              type="radio"
              name="filterMode"
              checked={filterMode === 'edition'}
              onChange={() => setFilterMode('edition')}
            />
            Edition
            <select
              className="rounded border border-slate-300 px-2 py-1"
              value={edition}
              disabled={filterMode !== 'edition'}
              onChange={(event) => setEdition(event.target.value)}
            >
              <option value="">Select edition</option>
              {editions.map((row) => (
                <option key={row.edition} value={row.edition}>
                  {row.edition}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <input
              type="radio"
              name="filterMode"
              checked={filterMode === 'season'}
              onChange={() => setFilterMode('season')}
            />
            Season
            <input
              className="w-28 rounded border border-slate-300 px-2 py-1"
              placeholder="2025/26"
              value={season}
              disabled={filterMode !== 'season'}
              onChange={(event) => setSeason(event.target.value)}
            />
          </label>
        </fieldset>

        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {pending ? 'Searching…' : 'Ask'}
        </button>
      </form>

      {error ? (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      ) : null}

      <section
        ref={resultRef}
        tabIndex={-1}
        aria-live="polite"
        className="flex flex-col gap-4 outline-none"
      >
        {result?.kind === 'clarification' ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p className="flex items-center gap-2 font-medium">
              <span aria-hidden="true">?</span>
              Clarification needed
            </p>
            <p className="mt-2">{result.clarification.question}</p>
          </div>
        ) : null}

        {result?.kind === 'insufficient_evidence' ? (
          <div className="rounded-lg border border-slate-300 bg-slate-100 p-4">
            <p className="flex items-center gap-2 font-medium">
              <span aria-hidden="true">∅</span>
              Insufficient evidence
            </p>
            <p className="mt-2">{result.insufficientEvidence.explanation}</p>
            {result.insufficientEvidence.missingEvidence.length > 0 ? (
              <ul className="mt-2 list-disc pl-5">
                {result.insufficientEvidence.missingEvidence.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {result?.kind === 'answer' ? (
          <>
            <p className="text-sm text-slate-600">
              Edition {result.answer.resolvedEdition} (
              {result.answer.resolutionReason.replaceAll('_', ' ')})
            </p>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-600">
                <span aria-hidden="true">✦</span>
                System-generated synthesis
              </p>
              <div className="flex flex-col gap-3">
                {result.answer.answerUnits.map((unit, index) => {
                  return (
                    <p
                      key={`${index}-${unit.text.slice(0, 12)}`}
                      className={
                        unit.type === 'quote'
                          ? 'border-l-4 border-slate-400 pl-3 italic'
                          : ''
                      }
                    >
                      {unit.type === 'quote' ? (
                        <span className="sr-only">Quotation: </span>
                      ) : null}
                      {unit.text}{' '}
                      {unit.citations.map((marker) => (
                        <a
                          key={marker}
                          href={`#evidence-${marker}`}
                          className="ml-1 font-medium text-slate-800 underline"
                        >
                          [{marker}]
                        </a>
                      ))}
                    </p>
                  );
                })}
              </div>
            </div>
            <details
              open={evidenceOpen}
              onToggle={(event) =>
                setEvidenceOpen((event.target as HTMLDetailsElement).open)
              }
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <summary className="cursor-pointer font-medium">Evidence</summary>
              <ol className="mt-3 flex flex-col gap-4">
                {result.answer.evidence.map((item, index) => {
                  const marker = `E${index + 1}`;
                  return (
                    <li
                      key={item.id}
                      id={`evidence-${marker}`}
                      className="rounded border border-slate-200 p-3"
                    >
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span aria-hidden="true">§</span>
                        {item.label} [{marker}]
                      </p>
                      <p className="mt-2 text-sm">{item.excerpt}</p>
                      <p className="mt-2 text-xs text-slate-600">
                        {item.sourceTitle} · {item.edition} · pages{' '}
                        {item.locator.pageStart}–{item.locator.pageEnd}
                        {item.locator.lawNumber
                          ? ` · Law ${item.locator.lawNumber}`
                          : ''}
                      </p>
                      <a
                        className="mt-1 inline-block text-sm underline"
                        href={item.canonicalUrl}
                      >
                        Canonical source
                      </a>
                    </li>
                  );
                })}
              </ol>
            </details>
          </>
        ) : null}
      </section>
    </div>
  );
}
