import { QueryProvider } from "@/lib/providers";

export default function Home() {
  return (
    <QueryProvider>
      <main className="flex h-screen">
        <div className="flex-1 flex flex-col items-center justify-center bg-muted/30">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">Agent Console</h1>
            <p className="text-muted-foreground text-lg max-w-md">
              A control console and workbench for AI agents. Make agent execution
              visible, controllable, auditable, and recoverable.
            </p>
            <div className="flex gap-4 justify-center pt-4">
              <a
                href="/console"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
              >
                Open Console
              </a>
              <a
                href="/docs"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
              >
                View Docs
              </a>
            </div>
          </div>
        </div>
      </main>
    </QueryProvider>
  );
}
