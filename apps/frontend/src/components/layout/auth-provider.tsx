'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';

const PUBLIC_ROUTES = ['/login', '/'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const isPublic = PUBLIC_ROUTES.includes(pathname);
    if (!isAuthenticated && !isPublic) {
      router.replace('/login');
    }
    if (isAuthenticated && pathname === '/login') {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, pathname, router]);

  return <>{children}</>;
}
