export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_p]:mt-3 [&_li]:mt-1 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
      <h1 className="font-serif text-4xl font-semibold">{title}</h1>
      <p className="text-sm text-muted">Draft — to be reviewed by counsel before launch.</p>
      {children}
    </article>
  );
}
