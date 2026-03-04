import { useState, useRef, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useNetwork } from 'wagmi'
import { Wallet, Copy, ExternalLink, LogOut } from 'lucide-react'

export function ConnectWallet() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isLoading, pendingConnector } = useConnect()
  const { disconnect } = useDisconnect()
  const { chain } = useNetwork()

  const [showDropdown, setShowDropdown] = useState(false)
  const [showConnectors, setShowConnectors] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
        setShowConnectors(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`

  if (!isConnected) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          className="px-5 py-2 rounded-lg bg-brand text-void-deep text-sm font-semibold hover:bg-brand-light transition-all duration-200 shadow-neon-green hover:shadow-neon-green-lg"
          onClick={() => setShowConnectors(!showConnectors)}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="60" strokeDashoffset="20" />
              </svg>
              Connecting...
            </span>
          ) : (
            'Connect Wallet'
          )}
        </button>

        {showConnectors && (
          <div className="absolute top-full right-0 mt-2 w-64 rounded-xl border border-surface-border bg-surface p-3 space-y-1.5 z-50 shadow-xl">
            <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest px-2 py-1">
              Select Wallet
            </p>
            {connectors
              .filter((c) => c.ready)
              .map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => {
                    connect({ connector })
                    setShowConnectors(false)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all duration-200"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4 text-brand" />
                  </div>
                  <div>
                    <div className="font-semibold">{connector.name}</div>
                    {isLoading && pendingConnector?.id === connector.id && (
                      <div className="text-brand text-xs">Connecting...</div>
                    )}
                  </div>
                </button>
              ))}
            <div className="border-t border-white/5 mt-2 pt-2 px-2">
              <p className="text-white/20 text-[10px]">
                Connecting to Unichain Sepolia
              </p>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-brand/20 bg-brand/5 hover:bg-brand/10 transition-all duration-300"
      >
        <div className="relative">
          <div className="w-2 h-2 rounded-full bg-brand" />
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-brand animate-ping opacity-40" />
        </div>

        <span className="text-[10px] font-mono font-bold text-brand/60 uppercase">
          {chain?.name?.slice(0, 5) || 'NET'}
        </span>

        <span className="text-xs font-mono text-white/80">
          {formatAddress(address!)}
        </span>

        <svg
          className={`w-3 h-3 text-white/30 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {showDropdown && (
        <div className="absolute top-full right-0 mt-2 w-72 rounded-xl border border-surface-border bg-surface p-4 z-50 shadow-xl">
          <div className="mb-3 pb-3 border-b border-white/5">
            <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-2">Connected</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand/20 border border-brand/30 flex items-center justify-center">
                <span className="text-brand text-xs font-bold">{address?.slice(2, 4).toUpperCase()}</span>
              </div>
              <div>
                <p className="text-white font-mono text-sm">{formatAddress(address!)}</p>
                <p className="text-white/20 text-xs">{chain?.name || 'Unknown Chain'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => {
                navigator.clipboard.writeText(address!)
                setShowDropdown(false)
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-all"
            >
              <Copy className="w-4 h-4" /> Copy Address
            </button>

            <a
              href={`${chain?.blockExplorers?.default?.url || 'https://sepolia.uniscan.xyz'}/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-all"
              onClick={() => setShowDropdown(false)}
            >
              <ExternalLink className="w-4 h-4" /> View on Explorer
            </a>

            <button
              onClick={() => {
                disconnect()
                setShowDropdown(false)
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-all"
            >
              <LogOut className="w-4 h-4" /> Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
