'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface Committee {
  id: string;
  name: string;
  nameAr?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  _count: { members: number; reviews: number };
}

export default function CommitteesPage() {
  const router = useRouter();

  const { data: committees, isLoading } = useQuery({
    queryKey: ['committees'],
    queryFn: async () => {
      const res = await apiClient.get<Committee[]>('/committees');
      return res.data;
    },
  });

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-navy">Committees</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage legislative review committees and their members
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground">Loading committees...</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {committees?.map((committee) => (
              <div
                key={committee.id}
                onClick={() => router.push(`/committees/${committee.id}`)}
                className="rounded-xl border border-border bg-white p-5 shadow-sm cursor-pointer hover:border-primary-gold hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-primary-navy truncate">{committee.name}</h2>
                    {committee.nameAr && (
                      <p className="text-xs text-muted-foreground text-right mt-0.5" dir="rtl">
                        {committee.nameAr}
                      </p>
                    )}
                  </div>
                  <span
                    className={`ml-2 shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      committee.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {committee.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {committee.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {committee.description}
                  </p>
                )}

                <div className="flex gap-4 pt-3 border-t border-border">
                  <div className="text-center">
                    <p className="text-lg font-bold text-primary-navy">{committee._count.members}</p>
                    <p className="text-xs text-muted-foreground">Members</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-primary-navy">{committee._count.reviews}</p>
                    <p className="text-xs text-muted-foreground">Reviews</p>
                  </div>
                </div>
              </div>
            ))}

            {!committees?.length && (
              <div className="col-span-3 py-16 text-center text-muted-foreground">
                No committees found
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
