import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Qanunora Public Portal — Citizens Legislative Access',
  description: 'Access published laws and participate in public consultations.',
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Skip to content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-[#C9A84C] focus:text-white focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="bg-[#1B2A4A] shadow-md" role="banner">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <a href="/public" aria-label="Qanunora Public Portal home" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#C9A84C]">
              <span className="text-lg font-bold text-white" aria-hidden="true">Q</span>
            </div>
            <div>
              <span className="text-xl font-bold text-white tracking-wide">Qanunora</span>
              <span className="ml-2 text-sm text-[#C9A84C] hidden sm:inline">Public Portal</span>
            </div>
          </a>

          <nav aria-label="Public portal navigation" className="flex items-center gap-6">
            <a
              href="/public/bills"
              className="text-sm font-medium text-gray-200 hover:text-[#C9A84C] transition-colors"
            >
              Published Laws
            </a>
            <a
              href="/public/consultations"
              className="text-sm font-medium text-gray-200 hover:text-[#C9A84C] transition-colors"
            >
              Consultations
            </a>
            <a
              href="/login"
              className="rounded-md bg-[#C9A84C] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#b8973b] transition-colors"
            >
              Staff Login
            </a>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1" id="main-content">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#1B2A4A] text-gray-400" role="contentinfo">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-[#C9A84C]">
                <span className="text-xs font-bold text-white">Q</span>
              </div>
              <span className="text-sm font-medium text-gray-300">Qanunora</span>
            </div>
            <p className="text-center text-xs leading-relaxed text-gray-500 max-w-xl">
              <strong className="text-gray-400">Disclaimer:</strong> Information published on this portal is for public
              awareness only and does not constitute legal advice. For official legal interpretations,
              consult the relevant government authority.
            </p>
            <p className="text-xs text-gray-600">
              &copy; {new Date().getFullYear()} Government Legislative Intelligence Platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
