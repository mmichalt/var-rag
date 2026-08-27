import { Prisma } from '@var-rag/database';
import { sha256Hex } from '../hashes.js';
import { EXPECTED_LAW_NUMBERS } from '../versions.js';
import { assertFamilyApproved, AcquisitionError } from './rights.js';
import { extractPdf } from '../extraction/extract.js';
import { writeAudit } from '../corpus/audit.js';
import type { Db } from '../db.js';

export type IngestInput = {
  familyName: string;
  bytes: Uint8Array;
  canonicalUrl: string;
  title: string;
  edition: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  publishedDate?: Date | null;
  mediaType?: string;
};

export async function ingestDocument(db: Db, input: IngestInput) {
  const family = await db.sourceFamily.findUnique({
    where: { name: input.familyName },
  });
  if (!family) {
    throw new AcquisitionError(
      'UNKNOWN_FAMILY',
      `Source family '${input.familyName}' is not registered`,
    );
  }
  assertFamilyApproved(family);

  const contentSha256 = sha256Hex(input.bytes);
  const extracted = await extractPdf(input.bytes, EXPECTED_LAW_NUMBERS);
  const normalizedTextSha256 = sha256Hex(extracted.extractedText);

  const previous = await db.sourceDocument.findFirst({
    where: { familyId: family.id, canonicalUrl: input.canonicalUrl },
    orderBy: { version: 'desc' },
  });

  const nearDuplicate = await db.sourceDocument.findFirst({
    where: {
      familyId: family.id,
      normalizedTextSha256,
      canonicalUrl: { not: input.canonicalUrl },
    },
  });

  try {
    const document = await db.sourceDocument.create({
      data: {
        familyId: family.id,
        canonicalUrl: input.canonicalUrl,
        title: input.title,
        edition: input.edition,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        publishedDate: input.publishedDate ?? input.effectiveFrom,
        retrievedAt: new Date(),
        mediaType: input.mediaType ?? 'application/pdf',
        contentSha256,
        normalizedTextSha256,
        duplicateFlagStatus: nearDuplicate ? 'LIKELY_DUPLICATE' : 'NONE',
        rawContent: Buffer.from(input.bytes),
        extractedText: extracted.extractedText,
        extractionReport: extracted.report as object,
        extractionGatePassed: extracted.gatePassed,
        status: 'STAGED',
        version: (previous?.version ?? 0) + 1,
        supersedesId: previous?.id,
      },
    });

    await db.sourceFamily.update({
      where: { id: family.id },
      data: { lastIngestedAt: new Date() },
    });

    await writeAudit(db, {
      action: 'ingest',
      targetType: 'SourceDocument',
      targetId: document.id,
      after: {
        version: document.version,
        contentSha256,
        supersedesId: previous?.id ?? null,
      },
    });

    return {
      document,
      pages: extracted.pages,
      report: extracted.report,
      gatePassed: extracted.gatePassed,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new AcquisitionError(
        'EXACT_DUPLICATE',
        `Exact duplicate contentSha256 ${contentSha256} already exists in family '${family.name}'`,
      );
    }
    throw error;
  }
}
