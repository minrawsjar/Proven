import { create } from 'zustand'

export interface RSCEvent {
  id: string
  timestamp: number
  chain: 'UNICHAIN_SEPOLIA'
  blockNumber: number
  eventName: string
  fromAddress: string
  value: string
  txHash: string
}

export interface RSCResponse {
  id: string
  timestamp: number
  signalId: string
  conditionChecked: string
  result: 'TRIGGERED' | 'BELOW_THRESHOLD'
  scoreChange: number
  newCompositeScore: number
  actionTaken: string
  callbackTxHash: string | null
  projectAddress: string
}

export interface RSCMonitorState {
  incomingEvents: RSCEvent[]
  rscResponses: RSCResponse[]
  stats: {
    totalReactCalls: number
    totalCallbacksDispatched: number
    totalMilestonesUnlocked: number
    totalLockExtensionsApplied: number
  }
  selectedProject: string | null
  selectedSignal: string | null
  selectedAction: string | null
  
  addIncomingEvent: (event: RSCEvent) => void
  addRSCResponse: (response: RSCResponse) => void
  setIncomingEvents: (events: RSCEvent[]) => void
  setRSCResponses: (responses: RSCResponse[]) => void
  setStats: (stats: RSCMonitorState['stats']) => void
  setSelectedProject: (address: string | null) => void
  setSelectedSignal: (signalId: string | null) => void
  setSelectedAction: (action: string | null) => void
  clear: () => void
}

const initialStats = {
  totalReactCalls: 0,
  totalCallbacksDispatched: 0,
  totalMilestonesUnlocked: 0,
  totalLockExtensionsApplied: 0,
}

const initialState = {
  incomingEvents: [],
  rscResponses: [],
  stats: initialStats,
  selectedProject: null,
  selectedSignal: null,
  selectedAction: null,
}

export const useRSCMonitorStore = create<RSCMonitorState>((set) => ({
  ...initialState,
  addIncomingEvent: (event) =>
    set((state) => ({
      incomingEvents: [event, ...state.incomingEvents].slice(0, 50),
    })),
  addRSCResponse: (response) =>
    set((state) => ({
      rscResponses: [response, ...state.rscResponses].slice(0, 50),
    })),
  setIncomingEvents: (events) => set({ incomingEvents: events }),
  setRSCResponses: (responses) => set({ rscResponses: responses }),
  setStats: (stats) => set({ stats }),
  setSelectedProject: (address) => set({ selectedProject: address }),
  setSelectedSignal: (signalId) => set({ selectedSignal: signalId }),
  setSelectedAction: (action) => set({ selectedAction: action }),
  clear: () => set(initialState),
}))
