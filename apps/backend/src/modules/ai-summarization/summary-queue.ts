/**
 * Summary Queue Integration Point
 *
 * This module defines the queue name and job data shape for async summarization.
 * The actual queue processor wires into BullMQ (already a project dependency).
 *
 * Usage (future worker):
 *   const worker = new Worker(SUMMARY_QUEUE_NAME, async (job) => {
 *     const { itemId, summaryType, provider, requestedById } = job.data as SummaryJobData;
 *     await aiSummarizationService.summarizeLegislativeItem(
 *       itemId, summaryType, provider, requestedById
 *     );
 *   }, { connection: redisConnection });
 */

export const SUMMARY_QUEUE_NAME = 'ai-summarization';

export interface SummaryJobData {
  itemId: string;
  summaryType: 'EXECUTIVE' | 'CITIZEN' | 'LEGAL_OFFICER' | 'AMENDMENT' | 'BILL';
  provider?: string;
  requestedById: string;
}

export const SUMMARY_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000,
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
};
