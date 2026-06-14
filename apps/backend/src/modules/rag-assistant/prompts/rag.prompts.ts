export interface RagMessagePair {
  system: string;
  user: string;
}

export interface CitationInput {
  source: string;
  itemTitle: string;
  chunkText: string;
}

export function buildRagPrompt(
  query: string,
  context: string,
  citations: CitationInput[],
  userRole: string,
): RagMessagePair {
  const citationList = citations
    .map((c, i) => `[${i + 1}] ${c.itemTitle} (${c.source}): "${c.chunkText}"`)
    .join('\n');

  return {
    system: `You are a legislative intelligence assistant for a government platform.
Answer questions based ONLY on the provided legislative documents and context.
If the answer is not in the documents, clearly say so — do not invent information.
Always reference specific documents by their citation number [1], [2], etc.
Tailor your response to the user's role: ${userRole}.
IMPORTANT: This is AI-assisted analysis, not legal advice. Always include this disclaimer at the end of your response.`,
    user: `Available Legislative Documents:
${citationList || 'No documents available in the current context.'}

Context:
${context}

Question: ${query}

Please answer based on the documents above. If citing a document, use [1], [2], etc.`,
  };
}
