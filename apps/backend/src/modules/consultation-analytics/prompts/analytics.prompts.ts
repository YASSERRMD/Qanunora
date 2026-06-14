export interface AnalyticsMessagePair {
  system: string;
  user: string;
}

export function buildSentimentPrompt(feedbackContent: string): AnalyticsMessagePair {
  return {
    system: `You are a sentiment analysis specialist for government consultation feedback.
Classify the sentiment of the provided feedback as POSITIVE, NEGATIVE, or NEUTRAL.
Extract a short reason (max 20 words) explaining the classification.
Respond ONLY with valid JSON. No markdown fences, no extra text.
Required JSON structure:
{
  "sentiment": "POSITIVE" | "NEGATIVE" | "NEUTRAL",
  "score": number (0.0-1.0, confidence),
  "reason": "string (max 20 words)"
}`,
    user: `Classify the sentiment of the following consultation feedback:

"${feedbackContent}"

Return the sentiment classification, confidence score, and brief reason.`,
  };
}

export function buildTopicClusteringPrompt(
  feedbackItems: { id: string; content: string }[],
): AnalyticsMessagePair {
  const feedbackText = feedbackItems
    .map((f) => `[${f.id}] ${f.content}`)
    .join('\n\n');

  return {
    system: `You are a topic analysis specialist for government consultation feedback.
Group the provided feedback items into meaningful topic clusters.
Identify 3-8 distinct topic clusters based on common themes.
Respond ONLY with valid JSON. No markdown fences, no extra text.
Required JSON structure:
{
  "clusters": [
    {
      "topicLabel": "string (short descriptive label)",
      "feedbackIds": ["string"],
      "description": "string (1-2 sentences describing the cluster theme)"
    }
  ]
}`,
    user: `Group the following consultation feedback items into topic clusters:

${feedbackText}

Identify common themes and group related feedback. Each feedback item must appear in exactly one cluster.`,
  };
}
