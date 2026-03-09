import { create } from 'zustand';
const initialStats = {
    totalReactCalls: 0,
    totalCallbacksDispatched: 0,
    totalMilestonesUnlocked: 0,
    totalLockExtensionsApplied: 0,
};
const initialState = {
    incomingEvents: [],
    rscResponses: [],
    stats: initialStats,
    selectedProject: null,
    selectedSignal: null,
    selectedAction: null,
};
export const useRSCMonitorStore = create((set) => ({
    ...initialState,
    addIncomingEvent: (event) => set((state) => ({
        incomingEvents: [event, ...state.incomingEvents].slice(0, 50),
    })),
    addRSCResponse: (response) => set((state) => ({
        rscResponses: [response, ...state.rscResponses].slice(0, 50),
    })),
    setIncomingEvents: (events) => set({ incomingEvents: events }),
    setRSCResponses: (responses) => set({ rscResponses: responses }),
    setStats: (stats) => set({ stats }),
    setSelectedProject: (address) => set({ selectedProject: address }),
    setSelectedSignal: (signalId) => set({ selectedSignal: signalId }),
    setSelectedAction: (action) => set({ selectedAction: action }),
    clear: () => set(initialState),
}));
