export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="text-center">
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-primary-navy">
          <span className="text-2xl font-bold text-primary-gold">Q</span>
        </div>
        <h1 className="text-4xl font-bold text-primary-navy">Qanunora</h1>
        <p className="mt-2 text-lg text-slate-navy">
          Government Legislative Intelligence Platform
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          Setting up... Platform launching soon.
        </p>
      </div>
    </main>
  );
}
