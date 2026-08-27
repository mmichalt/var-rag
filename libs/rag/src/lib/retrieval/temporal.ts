export type PublishedEdition = {
  edition: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

export type TemporalRequest = {
  edition?: string;
  asOfDate?: string;
  season?: string;
};

export type TemporalOk = {
  ok: true;
  edition: string;
  reason:
    | 'explicit_edition'
    | 'as_of_date'
    | 'season_mapping'
    | 'latest_published';
};

export type TemporalClarification = {
  ok: false;
  question: string;
  reason: 'ambiguous_edition';
};

export type TemporalResult = TemporalOk | TemporalClarification;

const SEASON = /^(\d{4})\/(\d{2})$/;

export function seasonRange(season: string): { from: Date; to: Date } | null {
  const match = SEASON.exec(season);
  if (!match) {
    return null;
  }
  const startYear = Number.parseInt(match[1], 10);
  const suffix = Number.parseInt(match[2], 10);
  if (suffix !== (startYear + 1) % 100) {
    return null;
  }
  return {
    from: new Date(Date.UTC(startYear, 6, 1)),
    to: new Date(Date.UTC(startYear + 1, 5, 30, 23, 59, 59, 999)),
  };
}

function uniqueEditions(records: PublishedEdition[]): string[] {
  return [...new Set(records.map((record) => record.edition))].sort();
}

function overlapping(
  records: PublishedEdition[],
  from: Date,
  to: Date,
): PublishedEdition[] {
  return records.filter((record) => {
    const start = record.effectiveFrom.getTime();
    const end = (record.effectiveTo ?? to).getTime();
    return start <= to.getTime() && end >= from.getTime();
  });
}

export function resolveEdition(
  request: TemporalRequest,
  published: PublishedEdition[],
): TemporalResult {
  const specified = [
    request.edition ? 'edition' : null,
    request.asOfDate ? 'asOfDate' : null,
    request.season ? 'season' : null,
  ].filter(Boolean);
  if (specified.length > 1) {
    return {
      ok: false,
      reason: 'ambiguous_edition',
      question:
        'Specify only one of edition, as-of date, or season — they are mutually exclusive.',
    };
  }
  if (published.length === 0) {
    return {
      ok: false,
      reason: 'ambiguous_edition',
      question: 'No published law editions are available.',
    };
  }

  if (request.edition) {
    const match = published.filter((row) => row.edition === request.edition);
    if (match.length === 0) {
      return {
        ok: false,
        reason: 'ambiguous_edition',
        question: `Edition ${request.edition} is not a published law edition. Published editions: ${uniqueEditions(published).join(', ')}.`,
      };
    }
    return {
      ok: true,
      edition: request.edition,
      reason: 'explicit_edition',
    };
  }

  if (request.asOfDate) {
    const date = new Date(`${request.asOfDate}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      return {
        ok: false,
        reason: 'ambiguous_edition',
        question: `asOfDate '${request.asOfDate}' is not a valid date.`,
      };
    }
    const earliest = published.reduce((min, row) =>
      row.effectiveFrom < min.effectiveFrom ? row : min,
    );
    if (date < earliest.effectiveFrom) {
      return {
        ok: false,
        reason: 'ambiguous_edition',
        question: `No law edition is effective on ${request.asOfDate}. The earliest effective date is ${earliest.effectiveFrom.toISOString().slice(0, 10)}.`,
      };
    }
    const covering = published.filter((row) => {
      const from = row.effectiveFrom.getTime();
      const to = row.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
      return from <= date.getTime() && date.getTime() <= to;
    });
    const editions = uniqueEditions(covering);
    if (editions.length !== 1) {
      return {
        ok: false,
        reason: 'ambiguous_edition',
        question: `More than one law edition is effective on ${request.asOfDate}. Specify an edition explicitly.`,
      };
    }
    return { ok: true, edition: editions[0], reason: 'as_of_date' };
  }

  if (request.season) {
    const range = seasonRange(request.season);
    if (!range) {
      return {
        ok: false,
        reason: 'ambiguous_edition',
        question: `Season '${request.season}' is not a valid YYYY/YY season.`,
      };
    }
    const byName = published.filter((row) => row.edition === request.season);
    const named = uniqueEditions(byName);
    if (named.length === 1) {
      return { ok: true, edition: named[0], reason: 'season_mapping' };
    }
    const covered = uniqueEditions(
      overlapping(published, range.from, range.to),
    );
    if (covered.length === 1) {
      return { ok: true, edition: covered[0], reason: 'season_mapping' };
    }
    return {
      ok: false,
      reason: 'ambiguous_edition',
      question: `Season ${request.season} maps to ${covered.length || named.length} editions. Specify the edition explicitly.`,
    };
  }

  const latest = [...published].sort(
    (a, b) =>
      b.effectiveFrom.getTime() - a.effectiveFrom.getTime() ||
      b.edition.localeCompare(a.edition),
  )[0];
  return {
    ok: true,
    edition: latest.edition,
    reason: 'latest_published',
  };
}
