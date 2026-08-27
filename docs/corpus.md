# Corpus registry and usage basis

Development and acceptance corpus for the Ask the Laws vertical slice. Production IFAB ingestion is blocked until a usage basis is approved.

## Source families

| Name                | Owner                          | Authority | Rights status  | Usage basis                                                                                         | Display policy                                      | Max excerpt |
| ------------------- | ------------------------------ | --------- | -------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------- |
| `synthetic-lawbook` | Football VAR Decision Explorer | official  | `APPROVED`     | Self-owned original text written for this repository. Not derived from IFAB or other third parties. | Short excerpts with a link to the canonical fixture | 400 chars   |
| `ifab`              | The IFAB                       | official  | `NOT_ASSESSED` | See [IFAB terms finding](#ifab-terms-finding). Acquisition must refuse this family.                 | Not displayable until assessed                      | 400 chars   |

Last ingestion is recorded on `SourceFamily.lastIngestedAt` when a document is acquired.

## IFAB terms finding

The IFAB Laws of the Game and related material are third-party copyright works. No licence, excerpting permission, or other usage basis has been recorded for this repository.

**Finding:** rights status remains `NOT_ASSESSED`. The rights gate (`SourceFamily.rightsStatus = APPROVED`) therefore refuses IFAB acquisition. Not committing a PDF does not authorise reproducing IFAB text into documents, chunks, or embeddings.

Do not ingest, commit, or redistribute IFAB PDFs or other third-party law documents in this repository.

## Synthetic editions

Two self-owned editions exist as local fixtures:

| File                                 | Edition | Effective from | Effective to | Deliberate difference                                   |
| ------------------------------------ | ------- | -------------- | ------------ | ------------------------------------------------------- |
| `data/synthetic-lawbook-2025-26.pdf` | 2025/26 | 2025-07-01     | 2026-06-30   | Baseline wording                                        |
| `data/synthetic-lawbook-2026-27.pdf` | 2026/27 | 2026-07-01     | —            | Law 12 handball wording is reworded relative to 2025/26 |

Regenerate the PDFs with `node data/generate-synthetic-pdfs.mjs`. Source paragraphs live in `data/synthetic-lawbook.json`.

## Retention and logging

Query logs (`AnswerLog`) retain the submitted query text, retrieval identifiers, and model versions. They do not store IP addresses or user agents. Rows older than `QUERY_LOG_RETENTION_DAYS` (default 30) are deleted by the worker prune job.

Application logs omit source-document content by default.
