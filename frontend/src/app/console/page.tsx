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

export default function ConsolePage() {
  const { isConnected, setIsConnected } = useConsoleStore();

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
      <main className="flex flex-col h-screen bg-background">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b bg-card">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">Agent Console</h1>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-xs text-muted-foreground">
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">v0.1.0</span>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Session Sidebar */}
          <aside className="w-64 border-r bg-card overflow-hidden flex flex-col">
            <SessionSidebar />
          </aside>

          {/* Center: Conversation */}
          <section className="flex-1 flex flex-col overflow-hidden">
            <ConversationPanel />
          </section>

          {/* Right: Inspector */}
          <aside className="w-80 border-l bg-card overflow-hidden flex flex-col">
            <InspectorPanel />
          </aside>
        </div>

        {/* Bottom: Timeline / Logs */}
        <footer className="h-48 border-t bg-card">
          <Tabs defaultValue="timeline" className="h-full flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0 px-2">
              <TabsTrigger
                value="timeline"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs h-8"
              >
                Timeline
              </TabsTrigger>
              <TabsTrigger
                value="logs"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs h-8"
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
