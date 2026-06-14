export interface SummaryMessagePair {
  system: string;
  user: string;
}

export interface LegislativeItemInput {
  title: string;
  type: string;
  description?: string;
  objective?: string;
}

export interface AmendmentInput {
  title: string;
  description: string;
  reason: string;
  articleReference?: string;
}

// ---------------------------------------------------------------------------
// Executive Summary
// ---------------------------------------------------------------------------

export function buildExecutiveSummaryPrompt(item: LegislativeItemInput): SummaryMessagePair {
  return {
    system: `You are a senior legislative analyst for a government ministry. Your task is to produce
concise, authoritative executive summaries of legislative items for decision-makers.
Respond ONLY with valid JSON. No markdown fences, no extra text.
Required JSON structure:
{
  "title": "string",
  "summaryType": "EXECUTIVE",
  "keyPoints": ["string"],
  "summary": "string (150-250 words)",
  "wordCount": number,
  "confidenceScore": number (0.0-1.0),
  "disclaimer": "string",
  "sources": ["string"]
}`,
    user: `Produce an executive summary for the following legislative item:

Title: ${item.title}
Type: ${item.type}
${item.description ? `Description: ${item.description}` : ''}
${item.objective ? `Objective: ${item.objective}` : ''}

Focus on: strategic importance, policy objectives, key stakeholders, and expected outcomes.
The summary must be suitable for senior government officials.`,
  };
}

// ---------------------------------------------------------------------------
// Citizen Summary
// ---------------------------------------------------------------------------

export function buildCitizenSummaryPrompt(item: LegislativeItemInput): SummaryMessagePair {
  return {
    system: `You are a plain-language writer helping citizens understand legislation.
Your summaries use simple, clear language — no legal jargon, no technical terms.
Respond ONLY with valid JSON. No markdown fences, no extra text.
Required JSON structure:
{
  "title": "string",
  "summaryType": "CITIZEN",
  "keyPoints": ["string"],
  "summary": "string (100-200 words, plain language)",
  "wordCount": number,
  "confidenceScore": number (0.0-1.0),
  "disclaimer": "string",
  "sources": ["string"]
}`,
    user: `Explain the following law or policy to an ordinary citizen:

Title: ${item.title}
Type: ${item.type}
${item.description ? `Description: ${item.description}` : ''}
${item.objective ? `Objective: ${item.objective}` : ''}

Write as if explaining to someone with no legal background. Use everyday words.
Focus on: what it means for people's daily lives and what changes it brings.`,
  };
}

// ---------------------------------------------------------------------------
// Legal Officer Summary
// ---------------------------------------------------------------------------

export function buildLegalOfficerSummaryPrompt(item: LegislativeItemInput): SummaryMessagePair {
  return {
    system: `You are a senior legal officer specialising in government legislation and regulatory analysis.
Your summaries provide rigorous legal analysis including constitutional compliance, regulatory impact,
and cross-references to existing statutes.
Respond ONLY with valid JSON. No markdown fences, no extra text.
Required JSON structure:
{
  "title": "string",
  "summaryType": "LEGAL_OFFICER",
  "keyPoints": ["string"],
  "summary": "string (250-400 words, technical legal language)",
  "wordCount": number,
  "confidenceScore": number (0.0-1.0),
  "disclaimer": "string",
  "sources": ["string"]
}`,
    user: `Provide a detailed legal analysis of the following legislative item:

Title: ${item.title}
Type: ${item.type}
${item.description ? `Description: ${item.description}` : ''}
${item.objective ? `Objective: ${item.objective}` : ''}

Include: legislative intent, potential legal ambiguities, enforcement considerations,
and alignment with existing legal frameworks.`,
  };
}

// ---------------------------------------------------------------------------
// Amendment Summary
// ---------------------------------------------------------------------------

export function buildAmendmentSummaryPrompt(amendment: AmendmentInput): SummaryMessagePair {
  return {
    system: `You are a legislative drafter analysing proposed amendments to legislation.
Respond ONLY with valid JSON. No markdown fences, no extra text.
Required JSON structure:
{
  "title": "string",
  "summaryType": "AMENDMENT",
  "keyPoints": ["string"],
  "summary": "string (100-200 words)",
  "wordCount": number,
  "confidenceScore": number (0.0-1.0),
  "disclaimer": "string",
  "sources": ["string"]
}`,
    user: `Summarise the following proposed amendment:

Title: ${amendment.title}
${amendment.articleReference ? `Article/Section: ${amendment.articleReference}` : ''}
Description: ${amendment.description}
Reason for Amendment: ${amendment.reason}

Explain what is being changed, why the change is proposed, and what the practical effect will be.`,
  };
}

// ---------------------------------------------------------------------------
// Bill Summary
// ---------------------------------------------------------------------------

export function buildBillSummaryPrompt(item: LegislativeItemInput): SummaryMessagePair {
  return {
    system: `You are a parliamentary analyst specialising in bills and draft legislation.
Your summaries cover the bill's structure, key provisions, legislative journey, and fiscal impact.
Respond ONLY with valid JSON. No markdown fences, no extra text.
Required JSON structure:
{
  "title": "string",
  "summaryType": "BILL",
  "keyPoints": ["string"],
  "summary": "string (200-350 words)",
  "wordCount": number,
  "confidenceScore": number (0.0-1.0),
  "disclaimer": "string",
  "sources": ["string"]
}`,
    user: `Produce a comprehensive bill summary for:

Title: ${item.title}
Type: ${item.type}
${item.description ? `Description: ${item.description}` : ''}
${item.objective ? `Objective: ${item.objective}` : ''}

Cover: main provisions, affected parties, implementation timeline (if known),
and anticipated legislative impact.`,
  };
}
