import { Button } from "@repo/ui/components/button";
import { ThemeToggle } from "@repo/ui/components/theme";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-6 sm:px-10 sm:py-8">
      <header className="border-border flex items-center justify-between gap-4 border-b pb-5">
        <p className="text-sm font-semibold tracking-tight">
          Agent-ready full-stack on Azure starter
        </p>
        <ThemeToggle />
      </header>

      <section className="flex flex-1 flex-col justify-center py-16 sm:py-24">
        <div className="max-w-3xl">
          <p className="border-border bg-surface text-surface-foreground mb-5 inline-flex rounded-full border px-3 py-1 text-sm font-medium">
            Runtime foundation ready
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Ready for a product specification.
          </h1>
          <p className="text-muted-foreground mt-6 max-w-2xl text-base leading-7 text-pretty sm:text-lg">
            Typed runtime boundaries, accessible interface primitives, and health surfaces are in
            place. No product behavior has been defined.
          </p>

          <div className="mt-8 flex flex-wrap gap-3" aria-label="Shared primitive examples">
            <Button asChild>
              <a href="#foundation-details">Foundation details</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/health/live">Liveness endpoint</a>
            </Button>
          </div>
        </div>
      </section>

      <section
        id="foundation-details"
        className="border-border flex flex-col gap-5 border-y py-8 sm:flex-row sm:items-start sm:justify-between"
        aria-labelledby="foundation-heading"
      >
        <div className="max-w-xl">
          <h2 id="foundation-heading" className="text-lg font-semibold">
            Neutral by design
          </h2>
          <p className="text-muted-foreground mt-2 leading-7 text-pretty">
            Shared components consume semantic light and dark tokens, preserve visible focus, and
            respect reduced-motion preferences.
          </p>
        </div>
        <p className="text-muted-foreground max-w-sm text-sm leading-6">
          Product navigation, domain components, roles, permissions, and application data remain
          intentionally absent.
        </p>
      </section>

      <footer className="text-muted-foreground pt-6 text-sm">
        Foundation shell · no product state
      </footer>
    </main>
  );
}
