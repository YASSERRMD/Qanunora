'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

const FEEDBACK_CATEGORIES = [
  'GENERAL',
  'LEGAL_CONCERN',
  'ECONOMIC_IMPACT',
  'SOCIAL_IMPACT',
  'TECHNICAL',
  'SUPPORT',
  'OPPOSITION',
  'SUGGESTION',
];

interface Consultation {
  id: string;
  title: string;
  description?: string;
  openDate?: string;
  closeDate?: string;
  legislativeItem: { referenceNumber: string; title: string; description?: string };
  _count: { feedback: number };
}

interface FeedbackForm {
  submittedByName: string;
  submittedByEmail: string;
  content: string;
  category: string;
}

export default function ConsultationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FeedbackForm>({
    submittedByName: '',
    submittedByEmail: '',
    content: '',
    category: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get<Consultation>(`${API_BASE}/public/consultations/${id}`)
      .then((res) => setConsultation(res.data))
      .catch(() => setError('This consultation is not available or has closed.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.submittedByName.trim()) {
      setFormError('Your name is required.');
      return;
    }
    if (form.content.trim().length < 10) {
      setFormError('Feedback must be at least 10 characters.');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await axios.post(`${API_BASE}/public/consultations/${id}/feedback`, {
        submittedByName: form.submittedByName,
        submittedByEmail: form.submittedByEmail || undefined,
        content: form.content,
        category: form.category || undefined,
      });
      setSubmitted(true);
    } catch {
      setFormError('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-500" aria-live="polite">Loading...</div>;
  if (error) return (
    <div className="py-20 text-center" role="alert">
      <p className="text-red-600 mb-4">{error}</p>
      <a href="/public/consultations" className="text-[#C9A84C] hover:underline text-sm">&larr; Back to consultations</a>
    </div>
  );
  if (!consultation) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-500">
        <ol className="flex items-center gap-2" role="list">
          <li><a href="/public" className="hover:text-[#C9A84C]">Home</a></li>
          <li aria-hidden="true">/</li>
          <li><a href="/public/consultations" className="hover:text-[#C9A84C]">Consultations</a></li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-700 truncate max-w-48" aria-current="page">{consultation.title}</li>
        </ol>
      </nav>

      <article aria-labelledby="consultation-title">
        {/* Header */}
        <header className="mb-8 rounded-xl bg-[#1B2A4A] p-6 text-white">
          <span className="inline-flex rounded-full bg-green-400/20 px-2 py-0.5 text-xs font-medium text-green-300 mb-3">
            OPEN FOR FEEDBACK
          </span>
          <h1 id="consultation-title" className="text-2xl font-bold">{consultation.title}</h1>
          <p className="mt-1 text-sm text-white/70">
            {consultation.legislativeItem.referenceNumber} — {consultation.legislativeItem.title}
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/60">
            {consultation.openDate && <span>Opened: {new Date(consultation.openDate).toLocaleDateString()}</span>}
            {consultation.closeDate && <span>Closes: {new Date(consultation.closeDate).toLocaleDateString()}</span>}
            <span>{consultation._count.feedback} responses received</span>
          </div>
        </header>

        {consultation.description && (
          <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6" aria-labelledby="desc-heading">
            <h2 id="desc-heading" className="font-semibold text-[#1B2A4A] mb-2">About this Consultation</h2>
            <p className="text-gray-700 leading-relaxed">{consultation.description}</p>
          </section>
        )}

        {/* Feedback Form */}
        <section className="rounded-xl border border-gray-200 bg-white p-6" aria-labelledby="feedback-heading">
          <h2 id="feedback-heading" className="text-xl font-semibold text-[#1B2A4A] mb-5">
            Submit Your Feedback
          </h2>

          {submitted ? (
            <div className="rounded-lg bg-green-50 border border-green-200 p-6 text-center" role="status" aria-live="polite">
              <svg className="mx-auto mb-3 h-10 w-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-semibold text-green-800 text-lg">Thank you for your feedback!</p>
              <p className="text-sm text-green-700 mt-1">
                Your submission has been received and will be reviewed by our team.
              </p>
              <button
                onClick={() => { setSubmitted(false); setForm({ submittedByName: '', submittedByEmail: '', content: '', category: '' }); }}
                className="mt-4 text-sm text-[#C9A84C] hover:underline"
              >
                Submit another response
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate aria-label="Feedback submission form">
              {formError && (
                <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert" aria-live="assertive">
                  {formError}
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span aria-label="required" className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    autoComplete="name"
                    value={form.submittedByName}
                    onChange={(e) => setForm((f) => ({ ...f, submittedByName: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#C9A84C] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
                    placeholder="Your full name"
                    aria-required="true"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address <span className="text-gray-400 text-xs font-normal">(optional)</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={form.submittedByEmail}
                    onChange={(e) => setForm((f) => ({ ...f, submittedByEmail: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#C9A84C] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="mt-5">
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                  Feedback Category
                </label>
                <select
                  id="category"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#C9A84C] focus:outline-none"
                >
                  <option value="">Select a category (optional)</option>
                  {FEEDBACK_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              <div className="mt-5">
                <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
                  Your Feedback <span aria-label="required" className="text-red-500">*</span>
                </label>
                <textarea
                  id="content"
                  required
                  rows={6}
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#C9A84C] focus:outline-none focus:ring-1 focus:ring-[#C9A84C] resize-y"
                  placeholder="Share your thoughts, concerns, or suggestions about this legislation..."
                  aria-required="true"
                  minLength={10}
                  maxLength={5000}
                />
                <p className="mt-1 text-xs text-gray-400">{form.content.length}/5000 characters</p>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  Your feedback will be reviewed before publication.
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#1B2A4A] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#253d6b] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  aria-disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </form>
          )}
        </section>
      </article>
    </div>
  );
}
