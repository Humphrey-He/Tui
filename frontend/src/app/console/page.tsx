"use client";

import { useEffect } from "react";
import { QueryProvider } from "@/lib/providers";
import { SessionSidebar } from "@/components/SessionSidebar";
import { ConversationPanel } from "@/components/ConversationPanel";
import { InspectorPanel } from "@/components/InspectorPanel";
import { TimelinePanel } from "@/components/TimelinePanel";
import { LogsPanel } from "@/components/LogsPanel";
import { useConsoleStore } from "@/stores/consoleStore";
import { controlSocketService } from "@/lib/realtime/controlSocket";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Activity, Boxes, CircleDollarSign, Cpu, Radio } from "lucide-react";

export default function ConsolePage() {
  const { currentRun, isConnected, isStreaming, setIsConnected } =
    useConsoleStore();

  useEffect(() => {
    controlSocketService.connect();

    const handleOpen = () => setIsConnected(true);
    const handleClose = () => setIsConnected(false);

    controlSocketService.on("connected", handleOpen);
    controlSocketService.on("disconnected", handleClose);

    return () => {
      controlSocketService.off("connected", handleOpen);
      controlSocketService.off("disconnected", handleClose);
      controlSocketService.disconnect();
    };
  }, [setIsConnected]);

  return (
    <QueryProvider>
      <main className="flex h-screen flex-col bg-background text-foreground">
        <header className="border-b border-white/10 bg-chrome text-chrome-foreground shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <Boxes className="h-4 w-4 text-accent" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-semibold tracking-wide">
                    Agent Console
                  </h1>
                <Badge className="h-5 rounded-full bg-white/10 px-2 text-[10px] font-medium text-white ring-1 ring-white/10 hover:bg-white/10">
                    AI Workbench
                  </Badge>
                </div>
                <p className="text-xs text-white/55">
                  Runtime visibility, tool control, and human approval
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-lg bg-white/[0.08] px-3 py-2 ring-1 ring-white/10 md:flex">
                <Cpu className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs text-white/65">Model</span>
                <span className="text-xs font-medium">
                  {currentRun?.model || "gpt-4o"}
                </span>
              </div>
              <div className="hidden items-center gap-2 rounded-lg bg-white/[0.08] px-3 py-2 ring-1 ring-white/10 lg:flex">
                <Activity className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs text-white/65">Run</span>
                <span className="text-xs font-medium capitalize">
                  {currentRun?.status || "idle"}
                </span>
              </div>
              <div className="hidden items-center gap-2 rounded-lg bg-white/[0.08] px-3 py-2 ring-1 ring-white/10 xl:flex">
                <CircleDollarSign className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs text-white/65">Cost</span>
                <span className="text-xs font-medium">
                  ${currentRun?.estimated_cost?.toFixed(4) || "0.0000"}
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-white/[0.08] px-3 py-2 ring-1 ring-white/10">
                <Radio
                  className={`h-3.5 w-3.5 ${
                    isConnected ? "text-emerald-300" : "text-red-300"
                  } ${isStreaming ? "animate-pulse" : ""}`}
                />
                <span className="text-xs font-medium">
                  {isConnected ? "Live" : "Offline"}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-1 gap-3 overflow-hidden p-3">
          <aside className="ai-panel flex w-72 flex-col overflow-hidden rounded-xl">
            <SessionSidebar />
          </aside>

          <section className="ai-panel flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl">
            <ConversationPanel />
          </section>

          <aside className="ai-panel flex w-[360px] flex-col overflow-hidden rounded-xl">
            <InspectorPanel />
          </aside>
        </div>

        <footer className="mx-3 mb-3 h-52 overflow-hidden rounded-xl ai-panel">
          <Tabs defaultValue="timeline" className="h-full flex flex-col">
            <TabsList className="h-auto w-full justify-start rounded-none border-b bg-muted/40 p-1 px-3">
              <TabsTrigger
                value="timeline"
                className="h-8 rounded-lg px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Timeline
              </TabsTrigger>
              <TabsTrigger
                value="logs"
                className="h-8 rounded-lg px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Logs
              </TabsTrigger>
            </TabsList>
            <TabsContent value="timeline" className="flex-1 overflow-hidden m-0">
              <TimelinePanel />
            </TabsContent>
            <TabsContent value="logs" className="flex-1 overflow-hidden m-0">
              <LogsPanel />
            </TabsContent>
          </Tabs>
        </footer>
      </main>
    </QueryProvider>
  );
}
