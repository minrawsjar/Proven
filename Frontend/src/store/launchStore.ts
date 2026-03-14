import { create } from 'zustand'

export interface Milestone {
  id: string
  type: 'TVL' | 'VOLUME' | 'USERS'
  threshold: number
  unlockPercentage: number
  isComplete: boolean
}

export interface PoolConfig {
  projectName: string
  tokenAddress: string
  pairToken: 'USDC' | 'WETH' | string
  feeTier: number
  liquidityAmount: {
    token: number
    pair: number
  }
}

export interface LaunchState {
  currentStep: 1 | 2 | 3
  poolConfig: PoolConfig | null
  milestones: Milestone[]
  additionalWallets: string[]
  treasuryAddress: string | null
  
  setCurrentStep: (step: 1 | 2 | 3) => void
  setPoolConfig: (config: PoolConfig) => void
  setMilestones: (milestones: Milestone[]) => void
  addWallet: (wallet: string) => void
  removeWallet: (wallet: string) => void
  setTreasuryAddress: (address: string | null) => void
  reset: () => void
}

const initialState = {
  currentStep: 1 as const,
  poolConfig: null,
  milestones: [],
  additionalWallets: [],
  treasuryAddress: null,
}

export const useLaunchStore = create<LaunchState>((set) => ({
  ...initialState,
  setCurrentStep: (step) => set({ currentStep: step }),
  setPoolConfig: (config) => set({ poolConfig: config }),
  setMilestones: (milestones) => set({ milestones }),
  addWallet: (wallet) =>
    set((state) => ({
      additionalWallets: [...state.additionalWallets, wallet],
    })),
  removeWallet: (wallet) =>
    set((state) => ({
      additionalWallets: state.additionalWallets.filter((w) => w !== wallet),
    })),
  setTreasuryAddress: (address) => set({ treasuryAddress: address }),
  reset: () => set(initialState),
}))
