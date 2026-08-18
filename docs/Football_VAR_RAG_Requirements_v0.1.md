# Software Requirements Specification

## Football VAR Decision Explorer (Football RAG)

| Field | Value |
| --- | --- |
| Document | Functional and nonfunctional requirements |
| Version | 0.1 — Draft for review |
| Date | 18 August 2026 |
| Audience | Product, engineering, data, QA, and project stakeholders |
| MVP scope | One Premier League season; text-based VAR and refereeing evidence |
| Artifact format | Markdown only |

> **Product intent:** Provide a transparent, evidence-first way to ask football law questions, find comparable VAR or refereeing incidents, and compare official decisions without presenting system inference as an official verdict.

## 1. Purpose and scope

This specification defines the MVP functional and nonfunctional requirements for a Football VAR Decision Explorer. The product is a retrieval-augmented generation application: it retrieves approved football laws, protocols, official explanations, and incident records, then produces a cited answer or comparison. The requirements are intentionally technology-agnostic except where operational constraints require containerized, reproducible deployment.

### 1.1 MVP boundary

| Area | Boundary |
| --- | --- |
| Competition scope | One Premier League season selected for implementation; the season remains a configurable deployment choice until confirmed. |
| Incident scope | Penalties, red cards, offside goals, handball, and VAR overturns. |
| Evidence scope | Textual official laws, protocols, explanations, incident reports, and disciplinary decisions from approved sources. |
| Media scope | No ingestion or analysis of match footage in the MVP. Records may store a lawful source link and match minute or timestamp. |
| Decision posture | The system explains and compares evidence; it does not independently declare that an official was wrong. |
| Deliverable format | Project documentation is maintained as Markdown (`.md`) only. |

### 1.2 Goals and success outcomes

| Goal | Success outcome |
| --- | --- |
| Grounded answers | Users receive concise answers tied to identifiable official evidence and the applicable law version. |
| Comparable precedents | Users can find factually similar incidents beyond keyword matching and understand why they are similar. |
| Transparent comparison | Users can compare decision paths, official explanations, laws, and rule-version differences without hidden evidence. |
| Governed corpus | Source provenance, review status, history, and evidence authority are explicit and auditable. |

## 2. Users, roles, and operating assumptions

| Role | Responsibilities |
| --- | --- |
| General user | Asks questions, filters incidents, inspects evidence, finds similar decisions, compares incidents, and submits feedback. |
| Reviewer | Validates extracted text and metadata, links laws, resolves duplicates, and approves or rejects records. |
| Administrator | Configures source families, permissions, controlled vocabularies, corpus jobs, and retirement or rebuild actions. |
| Operator | Monitors service health, capacity, ingestion jobs, backups, and incidents. This may be the same person as the administrator in the MVP. |

### 2.1 Assumptions

The initial corpus will be assembled only from sources whose use is approved. Official coverage will be incomplete and uneven, so missing explanations are a normal data state. The system will retain historical rule editions because law wording and interpretation can change between seasons. English is the MVP language. Public access versus authenticated end-user access is a deployment decision; privileged corpus workflows always require authentication.

## 3. Requirement conventions

| Term | Meaning |
| --- | --- |
| Shall | Mandatory, testable product behavior or quality constraint. |
| M — Must | Required for MVP acceptance. |
| S — Should | Important for the MVP; may be deferred only by an explicit product decision. |
| C — Could | Useful enhancement that does not block MVP acceptance. |
| Verification | Minimum observable evidence for acceptance; detailed test cases are created during test planning. |

## 4. Functional requirements

> **MVP rule:** A functional requirement is accepted only when its verification criterion passes against the approved corpus, configured deployment, and role permissions.

### 4.1 Corpus acquisition and governance

| ID | Priority | Requirement | Verification / acceptance criterion |
| --- | --- | --- | --- |
| FR-001 | M | The system shall maintain a registry of approved source families, including IFAB laws and VAR protocol material, Premier League official explanations or incident reports, and applicable UEFA or FIFA decisions. | An administrator can view each source family with owner, source URL pattern, authority level, usage status, and last ingestion time. |
| FR-002 | M | The system shall ingest text and metadata from approved web pages or supplied documents without requiring match footage. | A supported source can be ingested into a staging area and its extracted text is available for review. |
| FR-003 | M | The system shall preserve the source document, canonical URL, retrieval time, publication date when available, and content checksum for every ingested item. | Every published chunk can be traced to one immutable source record containing all required provenance fields. |
| FR-004 | M | The system shall detect duplicate or materially identical source items before publication. | Exact duplicates are blocked; likely duplicates are flagged for reviewer resolution. |
| FR-005 | M | The system shall support re-ingestion and identify added, removed, or changed text without silently overwriting the earlier version. | A changed source creates a new version and retains the prior version and change timestamp. |
| FR-006 | M | The system shall place new or materially changed records in a review queue before they become searchable in the public corpus. | Unapproved records are excluded from end-user retrieval; an authorized reviewer can approve or reject them. |
| FR-007 | S | The system shall allow an authorized reviewer to correct normalized metadata while preserving the original extracted values and an audit trail. | Each correction records old value, new value, user, timestamp, and reason. |
| FR-008 | M | The system shall support retiring a source or record from active retrieval without deleting its audit history. | Retired content no longer appears in new answers but remains available to authorized administrators. |

### 4.2 Incident and law knowledge model

| ID | Priority | Requirement | Verification / acceptance criterion |
| --- | --- | --- | --- |
| FR-009 | M | The system shall represent each incident with season, competition, match, match date, minute, teams, involved players when known, incident type, on-field decision, VAR decision, final decision, official explanation, applicable law reference, and source URL. | A record cannot be published until mandatory fields pass schema validation or are explicitly marked unknown with a reason. |
| FR-010 | M | The system shall classify MVP incidents as penalty, red card, offside goal, handball, or VAR overturn, while allowing future controlled vocabulary expansion. | Each published MVP incident has at least one controlled incident type; administrators can add future types without rewriting historical values. |
| FR-011 | M | The system shall store law and protocol content by edition or season and retain historical versions. | Queries scoped to a historical season retrieve the law version effective for that season. |
| FR-012 | M | The system shall link incident records to one or more applicable law or protocol passages. | An incident detail view exposes the linked passages and their edition or effective dates. |
| FR-013 | M | The system shall divide source text into retrievable chunks while retaining document, section, page or heading locator, and incident associations. | Every retrieved chunk displays or can resolve its parent source and local locator. |
| FR-014 | M | The system shall label evidence as Official law, Official decision, Official explanation, or System-generated comparison. | Every evidence item and every answer section displays exactly one evidence label; generated synthesis is never presented as official text. |

### 4.3 Search and retrieval

| ID | Priority | Requirement | Verification / acceptance criterion |
| --- | --- | --- | --- |
| FR-015 | M | The system shall accept natural-language questions about football laws, VAR protocol, and indexed incidents. | A user can submit a free-text query and receive either a grounded answer, a clarification request, or an explicit no-evidence result. |
| FR-016 | M | The system shall support three query modes: Ask the Laws, Find Similar Decisions, and Compare Decisions. | Each mode is selectable in the interface and invokes mode-appropriate retrieval and presentation behavior. |
| FR-017 | S | The system shall infer a likely mode from an unclassified question and allow the user to override it. | For a representative intent test set, the intended mode is suggested; changing the mode does not require retyping the query. |
| FR-018 | M | The system shall support filters for season, competition, team, player, match date range, incident type, final decision, and VAR outcome where data exists. | Selected filters constrain retrieved results and are visible in the response state. |
| FR-019 | M | The system shall combine semantic relevance with metadata filtering and lexical matching when ranking evidence. | Evaluation logs show the ranked evidence set and applied filters for each test query. |
| FR-020 | M | The system shall retrieve and rank multiple evidence passages rather than relying on a single nearest chunk. | The retrieval service returns a configurable top-k set with source identifiers and relevance scores or rank positions. |
| FR-021 | M | The system shall apply the law or protocol version effective for the season or date in the user's query when that context is available. | A cross-season test returns different law editions when effective rules differ. |
| FR-022 | M | The system shall request clarification when a query is materially ambiguous, such as an unidentified match, season, or incident. | The system asks a targeted question instead of fabricating the missing entity. |
| FR-023 | M | The system shall return an explicit insufficient-evidence response when the approved corpus does not support a reliable answer. | No-evidence test queries do not produce unsupported factual conclusions and identify what evidence is missing. |

### 4.4 Grounded answers and decision comparison

| ID | Priority | Requirement | Verification / acceptance criterion |
| --- | --- | --- | --- |
| FR-024 | M | Ask the Laws shall answer with the applicable law or protocol passage, edition or season, and source citation. | Each law answer contains at least one verifiable citation and identifies the governing edition. |
| FR-025 | M | Find Similar Decisions shall return semantically related incidents with a concise explanation of the matching factors. | Results identify shared factors such as incident type, decision path, law reference, or factual description without claiming legal equivalence. |
| FR-026 | M | Compare Decisions shall present two selected incidents side by side, including facts, decision sequence, official explanations, applicable law passages, and relevant rule-version differences. | A comparison displays all available required fields and marks missing official information explicitly. |
| FR-027 | M | The system shall cite each material factual claim to one or more approved evidence items. | A reviewer can follow citations from the answer to the exact source record and locator supporting the claim. |
| FR-028 | M | The system shall distinguish quotations, faithful summaries, and system-generated inferences. | Quoted text is visually marked and source-linked; inferences are labeled as system-generated. |
| FR-029 | M | The system shall not state that a referee or VAR decision was wrong unless an indexed official authority explicitly made that finding. | Policy test prompts produce neutral wording unless an official finding is retrieved and cited. |
| FR-030 | M | The system shall describe disagreement or inconsistency neutrally by contrasting the official facts, explanations, and applicable laws. | Answers use evidence-based comparison language and avoid unsupported verdicts or intent attribution. |
| FR-031 | M | The system shall provide source links and, where recorded, match minute or timestamp references for independent verification. | Each incident answer exposes at least one source link and the available match-time reference. |
| FR-032 | S | The system shall expose the retrieved evidence used to generate an answer. | The user can expand an Evidence section showing labels, excerpts, source, date, and locator. |
| FR-033 | C | The system shall allow a user to copy or export a comparison with its citations in a human-readable format. | A comparison can be exported as Markdown (.md) without losing evidence labels and source links. |

### 4.5 Incident exploration and user experience

| ID | Priority | Requirement | Verification / acceptance criterion |
| --- | --- | --- | --- |
| FR-034 | M | The system shall provide a searchable incident catalogue with sorting and filtering. | A user can browse published incidents and open a detail record from the filtered results. |
| FR-035 | M | The incident detail view shall show normalized metadata, the official explanation, linked law passages, evidence labels, and provenance. | All available record fields are visible and missing values are shown as unknown rather than omitted deceptively. |
| FR-036 | M | The system shall allow a user to select two incident records for comparison. | Selecting two valid records opens Compare Decisions with both identifiers preserved. |
| FR-037 | S | The system shall preserve current query, mode, and filters in a shareable non-sensitive URL or equivalent restorable state. | Opening the saved state reproduces the same query configuration without exposing administrative data. |
| FR-038 | S | The system shall collect explicit user feedback on answer usefulness and citation problems. | A user can rate an answer and optionally flag missing, irrelevant, or incorrect evidence. |

### 4.6 Administration, quality control, and interfaces

| ID | Priority | Requirement | Verification / acceptance criterion |
| --- | --- | --- | --- |
| FR-039 | M | The system shall provide authenticated roles for administrator and reviewer; end-user search may be public or separately authenticated by deployment configuration. | Role tests demonstrate that only permitted users can ingest, approve, correct, retire, or view audit data. |
| FR-040 | M | The system shall provide a review workspace for staged incidents, metadata validation, source preview, linked law passages, and publication decisions. | A reviewer can complete the full approve or reject workflow from one record view. |
| FR-041 | M | The system shall maintain an immutable audit log for ingestion, edits, approvals, retirements, and corpus configuration changes. | Audit entries include actor, action, target, timestamp, and before/after values where applicable. |
| FR-042 | S | The system shall expose corpus health metrics including source failures, records by status, missing mandatory metadata, embedding status, and last successful ingestion. | An administrator dashboard or endpoint reports each required metric. |
| FR-043 | M | The system shall provide a documented application interface for search, incident retrieval, comparison, and administrative workflows. | Contract tests validate request and response schemas for all MVP interfaces. |
| FR-044 | M | The system shall support rebuilding the search index from authoritative stored records without losing source or audit data. | A clean index rebuild reproduces the published corpus record count and passes a retrieval smoke test. |

## 5. Nonfunctional requirements

> **Quality gate:** Release targets apply to the documented MVP workload and a versioned evaluation set. Any target change requires an explicit decision and an updated specification.

### 5.1 Accuracy, grounding, and quality

| ID | Priority | Requirement | Verification / acceptance criterion |
| --- | --- | --- | --- |
| NFR-001 | M | All material factual claims in generated answers shall be grounded in approved corpus evidence. | Automated citation coverage is 100% for factual answer units in the release evaluation set; any uncovered unit causes the answer to be blocked or qualified. |
| NFR-002 | M | Citation correctness shall meet the agreed release threshold. | At least 95% of sampled citations directly support the adjacent claim, measured on a versioned evaluation set of at least 100 representative questions. |
| NFR-003 | M | Retrieval quality shall meet the agreed release threshold. | For the curated evaluation set, at least one relevant evidence passage appears in the top five results for 90% or more of answerable queries. |
| NFR-004 | M | The system shall be calibrated to abstain when evidence is missing or conflicting. | At least 95% of designated unanswerable test questions return an abstention or clarification rather than an unsupported answer. |
| NFR-005 | M | Generated answers shall be reproducible enough for investigation. | Each answer log records model version, prompt or policy version, corpus version, retrieval configuration, and evidence identifiers. |

### 5.2 Performance and capacity

| ID | Priority | Requirement | Verification / acceptance criterion |
| --- | --- | --- | --- |
| NFR-006 | M | Interactive search shall respond promptly under the MVP load profile. | Retrieval completes within 3 seconds at the 95th percentile and the first complete grounded answer within 10 seconds at the 95th percentile, excluding third-party source ingestion. |
| NFR-007 | M | Incident browsing and detail endpoints shall remain responsive. | Catalogue and detail requests complete within 2 seconds at the 95th percentile under the target concurrent-user test. |
| NFR-008 | S | The MVP shall support at least 10,000 incident records and 250,000 text chunks without architecture replacement. | A representative load test at stated capacity meets response-time and error-rate targets. |
| NFR-009 | S | The system shall tolerate at least 50 concurrent interactive users for the MVP deployment. | A 30-minute load test at 50 concurrent users maintains less than 1% server error rate. |
| NFR-010 | M | Incremental ingestion shall not require a full index rebuild. | One changed source can be processed and published independently while search remains available. |

### 5.3 Availability, resilience, and recovery

| ID | Priority | Requirement | Verification / acceptance criterion |
| --- | --- | --- | --- |
| NFR-011 | S | The production service shall achieve 99.5% monthly availability, excluding announced maintenance. | Availability monitoring reports the target over a full measurement month after launch. |
| NFR-012 | M | Failure of one source ingestion job shall not corrupt published records or stop unrelated ingestion jobs. | Fault-injection tests show isolation, retryability, and preservation of the last published version. |
| NFR-013 | M | The system shall back up authoritative records, configuration, and audit data. | Backups meet a recovery point objective of 24 hours and are tested by restoration at least quarterly. |
| NFR-014 | S | The production recovery time objective shall be four hours for a complete service restoration from backup. | A documented recovery exercise restores the service within four hours. |

### 5.4 Security, privacy, and compliance

| ID | Priority | Requirement | Verification / acceptance criterion |
| --- | --- | --- | --- |
| NFR-015 | M | All network traffic shall use authenticated encryption and stored credentials or secrets shall be held outside source code. | Security scanning finds no committed production secrets; external connections use TLS. |
| NFR-016 | M | Administrative and reviewer actions shall require authentication and least-privilege authorization. | Access-control tests deny every privileged operation to unauthorized roles. |
| NFR-017 | M | The system shall protect against common web and API risks, including injection, cross-site scripting, request forgery, and abusive query rates. | Release security testing covers the current OWASP application and API risk categories relevant to the design, with no unresolved critical or high findings. |
| NFR-018 | M | Logs shall not contain secrets, authentication tokens, or unnecessary personal data. | Automated log inspection and manual sampling find no prohibited data; user query retention follows a documented policy. |
| NFR-019 | M | Source acquisition and display shall respect copyright, licensing, robots directives where applicable, and provider terms. | Every source family has a recorded usage basis and approved display policy before production ingestion. |
| NFR-020 | M | Quoted source text shall be limited to what is necessary for explanation and verification. | Content review confirms excerpts are concise and the interface links users to the authoritative source. |

### 5.5 Usability and accessibility

| ID | Priority | Requirement | Verification / acceptance criterion |
| --- | --- | --- | --- |
| NFR-021 | S | The primary workflows shall be understandable without knowledge of RAG technology. | In moderated usability testing, at least 80% of target users complete Ask, Similar, and Compare tasks without assistance. |
| NFR-022 | M | The interface shall conform to WCAG 2.2 Level AA for MVP user-facing screens. | Automated and manual accessibility checks find no unresolved critical AA failures in core workflows. |
| NFR-023 | M | Evidence status and uncertainty shall not rely on color alone. | Labels include text or icons with accessible names and remain distinguishable in grayscale and screen-reader output. |
| NFR-024 | S | The service shall support current and previous major versions of Chrome, Edge, Firefox, and Safari at release time. | The core workflow passes the cross-browser regression suite on the defined support matrix. |
| NFR-025 | S | The interface shall be usable at 320 CSS pixels width without loss of core functionality. | Ask, evidence review, incident detail, and comparison remain operable in responsive testing. |

### 5.6 Maintainability, portability, and observability

| ID | Priority | Requirement | Verification / acceptance criterion |
| --- | --- | --- | --- |
| NFR-026 | M | The solution shall separate source acquisition, normalization, indexing, retrieval, generation, policy enforcement, and presentation concerns. | Architecture review confirms independently testable modules with documented interfaces. |
| NFR-027 | M | The deployment shall be reproducible using version-controlled configuration and containerized services. | A clean environment can build and start the documented MVP stack without manual code changes. |
| NFR-028 | M | Models, embedding models, vector index, and generation prompts shall be configurable and versioned. | A configuration change can select an approved alternative without changing domain records, and the active versions appear in answer logs. |
| NFR-029 | M | The system shall provide structured logs, metrics, and traces for ingestion and query pipelines. | Operators can correlate one query or ingestion job across components using a shared request or job identifier. |
| NFR-030 | M | Automated tests shall cover domain rules, metadata validation, access control, retrieval contracts, and citation rendering. | The release pipeline blocks deployment when mandatory tests fail and publishes test results. |
| NFR-031 | S | Operational alerts shall identify sustained query failures, ingestion failures, index lag, and resource exhaustion. | Each alert has a documented threshold, owner, and runbook link and is verified in a staging exercise. |

## 6. Cross-cutting business rules

| ID | Rule |
| --- | --- |
| BR-001 | **Evidence hierarchy:** Official law and official decisions are primary evidence. Official explanations describe the authority's reasoning. System-generated comparison is synthesis and must be labeled accordingly. |
| BR-002 | **Neutrality:** Absence of an overturn, explanation, or disciplinary finding is not evidence that a decision was correct or incorrect. |
| BR-003 | **Temporal validity:** The applicable law version is determined by the incident date or competition season, not simply the newest available wording. |
| BR-004 | **Missing data:** Unknown fields remain explicitly unknown; the system must not infer names, decisions, or official rationales merely to complete a record. |
| BR-005 | **Publication:** Only approved records and chunks participate in end-user retrieval. |
| BR-006 | **Provenance:** Every published answer must retain a resolvable chain from claim to evidence chunk to source record and source location. |

## 7. Explicitly out of scope for MVP

| Area | Exclusion |
| --- | --- |
| Video analysis | Computer vision, frame extraction, automated offside line generation, and ingestion of match footage. |
| Live officiating | Real-time decision support for referees, VAR officials, clubs, broadcasters, or stadium operations. |
| Prediction | Predicting referee behavior, match outcomes, sanctions, or betting-related outcomes. |
| Unverified commentary | Treating press, social media, fan commentary, or model opinion as official evidence. |
| Universal coverage | All competitions, all seasons, or a claim that every controversial decision has an official explanation. |
| Autonomous verdicts | Declaring a referee wrong without a cited official finding. |

## 8. Release acceptance summary

The MVP is ready for release when all Must functional requirements pass, all Must nonfunctional requirements meet their stated thresholds, no unresolved critical or high security issue remains, corpus provenance is complete for published records, and the agreed retrieval and citation evaluation set passes. Should requirements may be deferred only with a documented owner, rationale, and target release.

## 9. Next SDLC deliverables

All deliverables below will be maintained as Markdown:

1. Confirm the target Premier League season and deployment audience.
2. Define use cases and primary user journeys.
3. Produce the system context and data architecture.
4. Derive backlog epics and user stories.
5. Build the requirements traceability matrix and test plan.
