import { create } from 'zustand';

interface Command {
  id: string;
  text: string;
  timestamp: Date;
  result?: string;
  status: 'pending' | 'executing' | 'completed' | 'rejected';
}

interface SystemStatus {
  status: 'active' | 'inactive' | 'processing';
  uptime?: number;
  lastUpdate?: Date;
  workload?: number;
  consciousness?: 'awake' | 'asleep';
  creativity?: number;
  protection?: 'enabled' | 'disabled';
  ethics?: 'strict' | 'moderate' | 'lenient';
  lastPing?: Date;
  insights?: string[];
  violations?: string[];
  threatLevel?: 'low' | 'elevated' | 'high';
  active?: boolean;
}

interface ASIState {
  isConnected: boolean;
  commands: Command[];
  isLoading: boolean;
  error: string | null;
  alba: SystemStatus;
  albi: SystemStatus;
  jona: SystemStatus;
  sandbox: SystemStatus;
  executeCommand: (text: string) => void;
  clearCommands: () => void;
  setConnected: (connected: boolean) => void;
  addMessage: (text: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useASIStore = create<ASIState>((set) => ({
  isConnected: false,
  commands: [],
  isLoading: false,
  error: null,
  alba: { status: 'active', workload: 15, lastPing: new Date() },
  albi: { status: 'active', consciousness: 'awake', creativity: 85, insights: ['Neural patterns analyzed', 'EEG data processed'] },
  jona: { status: 'active', protection: 'enabled', ethics: 'strict', violations: [] },
  sandbox: { status: 'active', workload: 5, violations: [], threatLevel: 'low', active: true, lastPing: new Date() },
  
  executeCommand: (text) =>
    set((state) => ({
      commands: [
        ...state.commands,
        {
          id: `${Date.now()}-${Math.random()}`,
          text,
          timestamp: new Date(),
          status: 'completed',
          result: `Executed: ${text}`,
        },
      ],
    })),
  
  clearCommands: () => set({ commands: [] }),
  setConnected: (connected) => set({ isConnected: connected }),
  
  addMessage: (text) =>
    set((state) => ({
      commands: [
        ...state.commands,
        {
          id: `${Date.now()}-${Math.random()}`,
          text,
          timestamp: new Date(),
          status: 'completed',
          result: text,
        },
      ],
    })),
  
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));
