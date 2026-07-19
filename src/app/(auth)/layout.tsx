export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-8 text-center">
        <p className="text-sm text-[var(--ink-muted)]">Aplikacja</p>
        <h1 className="text-3xl font-semibold tracking-tight">Nasz Budżet</h1>
      </div>
      {children}
    </div>
  );
}
