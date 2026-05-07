import { create } from "zustand";
import type {
  Session,
  Run,
  Message,
  ToolCall,
  ApprovalRequest,
  AgentStep,
  FileDiff,
} from "@/types";

interface ConsoleState {
  // Current selections
  selectedProjectId: string | null;
  selectedSessionId: string | null;
  selectedRunId: string | null;
  selectedToolCallId: string | null;
  selectedApprovalId: string | null;

  // Data
  sessions: Session[];
  currentRun: Run | null;
  messages: Message[];
  toolCalls: ToolCall[];
  approvals: ApprovalRequest[];
  steps: AgentStep[];
  fileDiffs: FileDiff[];

  // UI State
  isStreaming: boolean;
  streamContent: string;
  isConnected: boolean;

  // Actions
  setSelectedProject: (projectId: string | null) => void;
  setSelectedSession: (sessionId: string | null) => void;
  setSelectedRun: (runId: string | null) => void;
  setSelectedToolCall: (toolCallId: string | null) => void;
  setSelectedApproval: (approvalId: string | null) => void;

  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  setCurrentRun: (run: Run | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  appendStreamContent: (content: string) => void;
  clearStreamContent: () => void;

  setToolCalls: (toolCalls: ToolCall[]) => void;
  addToolCall: (toolCall: ToolCall) => void;
  updateToolCall: (toolCallId: string, updates: Partial<ToolCall>) => void;

  setApprovals: (approvals: ApprovalRequest[]) => void;
  addApproval: (approval: ApprovalRequest) => void;
  updateApproval: (approvalId: string, updates: Partial<ApprovalRequest>) => void;

  setSteps: (steps: AgentStep[]) => void;
  addStep: (step: AgentStep) => void;

  setFileDiffs: (fileDiffs: FileDiff[]) => void;
  addFileDiff: (fileDiff: FileDiff) => void;

  setIsStreaming: (isStreaming: boolean) => void;
  setIsConnected: (isConnected: boolean) => void;

  reset: () => void;
}

const initialState = {
  selectedProjectId: null,
  selectedSessionId: null,
  selectedRunId: null,
  selectedToolCallId: null,
  selectedApprovalId: null,
  sessions: [],
  currentRun: null,
  messages: [],
  toolCalls: [],
  approvals: [],
  steps: [],
  fileDiffs: [],
  isStreaming: false,
  streamContent: "",
  isConnected: false,
};

export const useConsoleStore = create<ConsoleState>((set) => ({
  ...initialState,

  setSelectedProject: (projectId) => set({ selectedProjectId: projectId }),
  setSelectedSession: (sessionId) => set({ selectedSessionId: sessionId }),
  setSelectedRun: (runId) => set({ selectedRunId: runId }),
  setSelectedToolCall: (toolCallId) => set({ selectedToolCallId: toolCallId }),
  setSelectedApproval: (approvalId) => set({ selectedApprovalId: approvalId }),

  setSessions: (sessions) => set({ sessions }),
  addSession: (session) =>
    set((state) => ({ sessions: [session, ...state.sessions] })),
  setCurrentRun: (run) => set({ currentRun: run }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  appendStreamContent: (content) =>
    set((state) => ({ streamContent: state.streamContent + content })),
  clearStreamContent: () => set({ streamContent: "" }),

  setToolCalls: (toolCalls) => set({ toolCalls }),
  addToolCall: (toolCall) =>
    set((state) => ({ toolCalls: [...state.toolCalls, toolCall] })),
  updateToolCall: (toolCallId, updates) =>
    set((state) => ({
      toolCalls: state.toolCalls.map((tc) =>
        tc.id === toolCallId ? { ...tc, ...updates } : tc
      ),
    })),

  setApprovals: (approvals) => set({ approvals }),
  addApproval: (approval) =>
    set((state) => ({ approvals: [...state.approvals, approval] })),
  updateApproval: (approvalId, updates) =>
    set((state) => ({
      approvals: state.approvals.map((a) =>
        a.id === approvalId ? { ...a, ...updates } : a
      ),
    })),

  setSteps: (steps) => set({ steps }),
  addStep: (step) =>
    set((state) => ({ steps: [...state.steps, step] })),

  setFileDiffs: (fileDiffs) => set({ fileDiffs }),
  addFileDiff: (fileDiff) =>
    set((state) => ({ fileDiffs: [...state.fileDiffs, fileDiff] })),

  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setIsConnected: (isConnected) => set({ isConnected }),

  reset: () => set(initialState),
}));
