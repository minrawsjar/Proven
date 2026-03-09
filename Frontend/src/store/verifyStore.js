import { create } from 'zustand';
const initialState = {
    selectedAddress: null,
    poolData: null,
    events: [],
    loading: false,
    error: null,
};
export const useVerifyStore = create((set) => ({
    ...initialState,
    setSelectedAddress: (address) => set({ selectedAddress: address }),
    setPoolData: (data) => set({ poolData: data }),
    addEvent: (event) => set((state) => ({
        events: [event, ...state.events].slice(0, 100),
    })),
    setEvents: (events) => set({ events }),
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),
    clear: () => set(initialState),
}));
