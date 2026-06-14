'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface Member {
  id: string;
  role: string;
  joinedAt: string;
  user: { id: string; firstName: string; lastName: string; email: string };
}

interface Review {
  id: string;
  legislativeItemId: string;
  recommendation?: string;
  notes?: string;
  reviewedAt?: string;
  createdAt: string;
}

interface CommitteeDetail {
  id: string;
  name: string;
  nameAr?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  members: Member[];
  reviews: Review[];
  _count: { members: number; reviews: number };
}

const RECOMMENDATION_COLORS: Record<string, string> = {
  APPROVE: 'bg-green-100 text-green-700',
  REJECT: 'bg-red-100 text-red-700',
  REVISE: 'bg-yellow-100 text-yellow-700',
};

export default function CommitteeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: committee, isLoading } = useQuery({
    queryKey: ['committee', id],
    queryFn: async () => {
      const res = await apiClient.get<CommitteeDetail>(`/committees/${id}`);
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <main className="flex-1 p-8">
        <div className="flex items-center justify-center py-24 text-muted-foreground">Loading...</div>
      </main>
    );
  }

  if (!committee) return null;

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-muted-foreground hover:text-primary-navy"
          >
            Back
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-primary-navy">{committee.name}</h1>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  committee.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {committee.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            {committee.nameAr && (
              <p className="mt-0.5 text-sm text-muted-foreground text-right" dir="rtl">
                {committee.nameAr}
              </p>
            )}
          </div>
        </div>

        {committee.description && (
          <p className="mb-6 text-sm text-muted-foreground bg-white rounded-xl border border-border p-4">
            {committee.description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl border border-border bg-white p-4 text-center">
            <p className="text-2xl font-bold text-primary-navy">{committee._count.members}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Members</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4 text-center">
            <p className="text-2xl font-bold text-primary-navy">{committee._count.reviews}</p>
            <p className="text-xs text-muted-foreground mt-1">Reviews Conducted</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-white shadow-sm">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-primary-navy">Members</h2>
            </div>
            <div className="divide-y divide-border">
              {committee.members.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground text-center">No members yet</p>
              ) : (
                committee.members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-primary-navy">
                        {m.user.firstName} {m.user.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{m.user.email}</p>
                    </div>
                    <span className="text-xs font-medium text-primary-gold border border-primary-gold/40 rounded px-2 py-0.5">
                      {m.role}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white shadow-sm">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-primary-navy">Recent Reviews</h2>
            </div>
            <div className="divide-y divide-border">
              {committee.reviews.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground text-center">No reviews yet</p>
              ) : (
                committee.reviews.map((r) => (
                  <div key={r.id} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-muted-foreground font-mono truncate max-w-[180px]">
                        {r.legislativeItemId}
                      </p>
                      {r.recommendation && (
                        <span
                          className={`text-xs font-medium rounded-full px-2 py-0.5 ${
                            RECOMMENDATION_COLORS[r.recommendation] ?? 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {r.recommendation}
                        </span>
                      )}
                    </div>
                    {r.notes && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{r.notes}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString() : 'Pending'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
