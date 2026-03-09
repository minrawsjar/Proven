import { create } from 'zustand';
const initialState = {
    currentStep: 1,
    poolConfig: null,
    milestones: [],
    additionalWallets: [],
    treasuryAddress: '',
};
export const useLaunchStore = create((set) => ({
    ...initialState,
    setCurrentStep: (step) => set({ currentStep: step }),
    setPoolConfig: (config) => set({ poolConfig: config }),
    setMilestones: (milestones) => set({ milestones }),
    addWallet: (wallet) => set((state) => ({
        additionalWallets: [...state.additionalWallets, wallet],
    })),
    removeWallet: (wallet) => set((state) => ({
        additionalWallets: state.additionalWallets.filter((w) => w !== wallet),
    })),
    setTreasuryAddress: (address) => set({ treasuryAddress: address }),
    reset: () => set(initialState),
}));
