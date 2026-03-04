import { useState } from 'react'
import { useLaunchStore } from '../store/launchStore'
import { Card } from '../components/Card'
import { Badge } from '../components/Badge'
import { ProgressBar } from '../components/ProgressBar'
import { Settings, Target, PenLine, AlertTriangle, Lightbulb, Eye, Lock, CheckCircle } from 'lucide-react'

export function LaunchPool() {
  const {
    currentStep,
    setCurrentStep,
    poolConfig,
    setPoolConfig,
    milestones,
    setMilestones,
    additionalWallets,
    addWallet,
    removeWallet,
    treasuryAddress,
    setTreasuryAddress,
  } = useLaunchStore()

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [newWallet, setNewWallet] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [selectedFeeTier, setSelectedFeeTier] = useState(0.3)

  // Initialize milestones if empty
  if (milestones.length === 0) {
    setMilestones([
      { id: '1', type: 'TVL', threshold: 1000000, unlockPercentage: 25, isComplete: false },
      { id: '2', type: 'VOLUME', threshold: 5000000, unlockPercentage: 50, isComplete: false },
      { id: '3', type: 'USERS', threshold: 5000, unlockPercentage: 25, isComplete: false },
    ])
  }

  const handleStep1Submit = () => {
    if (!poolConfig?.projectName || !poolConfig?.tokenAddress) {
      setFormErrors({ general: 'Please fill in all required fields' })
      return
    }
    setCurrentStep(2)
    setFormErrors({})
  }

  const totalUnlock = milestones.reduce((sum, m) => sum + m.unlockPercentage, 0)
  const canProceedStep2 = totalUnlock === 100

  const steps = [
    { num: 1, label: 'Pool Config', icon: Settings },
    { num: 2, label: 'Milestones', icon: Target },
    { num: 3, label: 'Review & Sign', icon: PenLine },
  ]

  const renderStep1 = () => (
    <div className="animate-fade-up opacity-0 space-y-6">
      <Card className="!p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
            <Settings className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Pool Configuration</h2>
            <p className="text-white/30 text-sm">Set up your Uniswap v4 pool basics</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Project Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Project Name</label>
            <input
              className="input-glow w-full"
              placeholder="e.g., Nova Protocol"
              value={poolConfig?.projectName || ''}
              onChange={(e) => setPoolConfig({ ...poolConfig, projectName: e.target.value } as any)}
            />
            <p className="text-white/20 text-xs mt-1.5">Shows on investor dashboards and activity feeds</p>
          </div>

          {/* Token Address */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Token Address (Unichain Sepolia)</label>
            <input
              className="input-glow w-full font-mono"
              placeholder="0x..."
              value={poolConfig?.tokenAddress || ''}
              onChange={(e) => setPoolConfig({ ...poolConfig, tokenAddress: e.target.value } as any)}
            />
            {poolConfig?.tokenAddress && poolConfig.tokenAddress.length > 10 && (
              <div className="mt-3 p-3 rounded-xl bg-brand/5 border border-brand/20 flex items-center gap-3">
                <span className="text-brand text-sm">✓</span>
                <div className="text-sm">
                  <span className="text-white font-semibold">NOVA</span>
                  <span className="text-white/30 mx-2">•</span>
                  <span className="text-white/40">Nova Protocol Token</span>
                  <span className="text-white/30 mx-2">•</span>
                  <span className="text-white/40 font-mono">Supply: 100M</span>
                </div>
              </div>
            )}
          </div>

          {/* Pair Token */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Pair Token</label>
            <div className="grid grid-cols-3 gap-3">
              {['USDC', 'WETH', 'Custom'].map((token) => (
                <button
                  key={token}
                  className={`p-3 rounded-xl border text-sm font-semibold transition-all duration-300 ${
                    poolConfig?.pairToken === token
                      ? 'border-brand/40 bg-brand/10 text-brand'
                      : 'border-white/5 bg-white/[0.02] text-white/40 hover:border-white/10 hover:text-white/60'
                  }`}
                  onClick={() => setPoolConfig({ ...poolConfig, pairToken: token } as any)}
                >
                  {token}
                </button>
              ))}
            </div>
          </div>

          {/* Fee Tier */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Fee Tier</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 0.05, label: '0.05%', desc: 'Stablecoin pairs', recommended: false },
                { value: 0.3, label: '0.3%', desc: 'Standard launches', recommended: true },
                { value: 1.0, label: '1%', desc: 'High volatility', recommended: false },
              ].map((tier) => (
                <button
                  key={tier.value}
                  className={`p-4 rounded-xl border text-left transition-all duration-300 relative ${
                    selectedFeeTier === tier.value
                      ? 'border-brand/40 bg-brand/10'
                      : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                  }`}
                  onClick={() => setSelectedFeeTier(tier.value)}
                >
                  {tier.recommended && (
                    <span className="absolute -top-2 right-3 chip chip-green !text-[10px] !py-0">RECOMMENDED</span>
                  )}
                  <div className={`font-bold text-lg ${selectedFeeTier === tier.value ? 'text-brand' : 'text-white'}`}>
                    {tier.label}
                  </div>
                  <div className="text-white/30 text-xs mt-1">{tier.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Initial Liquidity */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Initial Liquidity</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <input className="input-glow w-full font-mono" placeholder="Token amount" />
                <p className="text-white/20 text-xs mt-1 font-mono">≈ $125,000</p>
              </div>
              <div>
                <input className="input-glow w-full font-mono" placeholder="USDC amount" />
                <p className="text-white/20 text-xs mt-1 font-mono">≈ $125,000</p>
              </div>
            </div>
            <div className="mt-3 p-3 rounded-xl bg-brand/5 border border-brand/20 text-center">
              <span className="text-white/30 text-sm">Total Liquidity Value: </span>
              <span className="text-brand font-bold font-mono">$250,000</span>
            </div>
          </div>

          {/* Warning */}
          <div className="p-5 rounded-xl bg-red-500/5 border border-red-500/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
            <div className="flex items-start gap-3 ml-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div>
                <p className="text-red-300 font-semibold text-sm mb-1">Critical — Read Before Proceeding</p>
                <p className="text-red-200/60 text-sm leading-relaxed">
                  Once you add liquidity, these tokens go into Proven's vault. You <strong className="text-red-300">cannot withdraw</strong> them until your milestones are met.
                </p>
              </div>
            </div>
          </div>

          {formErrors.general && (
            <p className="text-red-400 text-sm font-mono">{formErrors.general}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/5">
          <button className="btn-primary px-6 py-2.5" onClick={handleStep1Submit}>
            Next: Milestones →
          </button>
        </div>
      </Card>
    </div>
  )

  const renderStep2 = () => (
    <div className="animate-fade-up opacity-0 space-y-6">
      <Card className="!p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
            <Target className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Milestone Builder</h2>
            <p className="text-white/30 text-sm">Define on-chain conditions that unlock your liquidity</p>
          </div>
        </div>

        {/* Unlock Distribution Bar */}
        <div className="p-5 rounded-xl bg-void-50 border border-white/5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/40">Unlock Distribution</span>
            <span className={`font-mono text-sm font-bold ${totalUnlock === 100 ? 'text-brand' : 'text-neon-orange'}`}>
              {totalUnlock === 100 ? '✓ ' : ''}{totalUnlock}%
            </span>
          </div>
          <div className="h-4 bg-white/5 rounded-full overflow-hidden flex">
            {milestones.map((m, i) => (
              <div
                key={i}
                style={{ width: `${m.unlockPercentage}%` }}
                className={`transition-all duration-500 ${
                  i === 0 ? 'bg-brand shadow-[0_0_8px_rgba(0,230,118,0.4)]' :
                  i === 1 ? 'bg-brand-dark shadow-[0_0_8px_rgba(0,200,83,0.4)]' :
                  'bg-brand-light shadow-[0_0_8px_rgba(105,240,174,0.4)]'
                }`}
              />
            ))}
            {totalUnlock < 100 && (
              <div style={{ width: `${100 - totalUnlock}%` }} className="bg-white/5" />
            )}
          </div>
          {totalUnlock !== 100 && (
            <p className="text-neon-orange/70 text-xs mt-2 font-mono">Must equal exactly 100% to proceed</p>
          )}
        </div>

        {/* Milestone Cards */}
        <div className="space-y-4 mb-8">
          {milestones.map((m, i) => {
            const colors = ['neon-cyan', 'neon-purple', 'neon-green']
            const bgColors = ['bg-neon-cyan', 'bg-neon-purple', 'bg-neon-green']
            return (
              <div key={i} className="p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-2 h-2 rounded-full ${bgColors[i]}`} />
                  <span className="text-white font-bold text-sm">Milestone {i + 1}</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-white/30 mb-1.5">Condition</label>
                    <select
                      className="input-glow w-full !py-2.5 !text-sm"
                      value={m.type}
                      onChange={(e) => {
                        const updated = [...milestones]
                        updated[i] = { ...m, type: e.target.value as any }
                        setMilestones(updated)
                      }}
                    >
                      <option value="TVL">TVL</option>
                      <option value="VOLUME">Trading Volume</option>
                      <option value="USERS">Unique Users</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/30 mb-1.5">Threshold</label>
                    <input
                      className="input-glow w-full !py-2.5 !text-sm font-mono"
                      placeholder={m.type === 'USERS' ? '5,000' : '$1,000,000'}
                      value={m.threshold.toLocaleString()}
                      onChange={(e) => {
                        const updated = [...milestones]
                        updated[i] = { ...m, threshold: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 }
                        setMilestones(updated)
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/30 mb-1.5">Unlock %</label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={m.unlockPercentage}
                      onChange={(e) => {
                        const updated = [...milestones]
                        updated[i] = { ...m, unlockPercentage: parseInt(e.target.value) }
                        setMilestones(updated)
                      }}
                      className="w-full accent-cyan-400 mt-2"
                    />
                    <div className="flex justify-between text-xs mt-1">
                      <span className={`font-mono font-bold text-${colors[i]}`}>{m.unlockPercentage}%</span>
                      <span className="text-white/20 font-mono">${((m.unlockPercentage / 100) * 250000).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                {i === 0 && (
                  <p className="text-white/20 text-xs mt-3 font-mono flex items-center gap-1.5"><Lightbulb className="w-3 h-3 text-brand/40 flex-shrink-0" /> Current Unichain avg pool TVL is $2.1M</p>
                )}
                {i === 1 && (
                  <p className="text-white/20 text-xs mt-3 font-mono flex items-center gap-1.5"><Lightbulb className="w-3 h-3 text-brand/40 flex-shrink-0" /> Top 10% of new launches reach $5M volume in 90 days</p>
                )}
              </div>
            )
          })}
        </div>

        {/* Investor Preview */}
        <div className="p-5 rounded-xl bg-brand/5 border border-brand/10">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-3.5 h-3.5 text-brand/60" />
            <span className="text-xs font-semibold uppercase tracking-wider text-brand/60">Investor Preview</span>
          </div>
          <div className="space-y-3">
            {milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full border-2 border-white/20" />
                <span className="text-white/50 text-sm">
                  {m.type === 'TVL' ? 'TVL' : m.type === 'VOLUME' ? 'Volume' : 'Users'} reaches {m.type === 'USERS' ? m.threshold.toLocaleString() : `$${m.threshold.toLocaleString()}`}
                </span>
                <span className="text-white/20 text-sm ml-auto font-mono">→ {m.unlockPercentage}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between gap-3 mt-8 pt-6 border-t border-white/5">
          <button className="btn-secondary px-6 py-2.5" onClick={() => setCurrentStep(1)}>← Back</button>
          <button className="btn-primary px-6 py-2.5" onClick={() => setCurrentStep(3)} disabled={!canProceedStep2}>
            Next: Review →
          </button>
        </div>
      </Card>
    </div>
  )

  const renderStep3 = () => (
    <div className="animate-fade-up opacity-0 space-y-6">
      <Card className="!p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
            <PenLine className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Review & Confirm</h2>
            <p className="text-white/30 text-sm">Final review before deploying on-chain</p>
          </div>
        </div>

        {/* Monitored Wallets */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-white mb-2">Monitored Wallets</h3>
          <p className="text-white/30 text-xs mb-4">
            Deployer address is automatically monitored. Add team or advisor wallets for additional protection.
          </p>
          <div className="flex gap-2 mb-3">
            <input
              className="input-glow flex-1 font-mono !text-sm"
              placeholder="0x..."
              value={newWallet}
              onChange={(e) => setNewWallet(e.target.value)}
            />
            <button className="btn-primary py-2 px-4 text-xs" onClick={() => { if (newWallet) { addWallet(newWallet); setNewWallet('') } }}>
              ADD
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="chip chip-green">
              <span className="live-dot !w-[5px] !h-[5px]" /> deployer (auto)
            </span>
            {additionalWallets.map((w) => (
              <span key={w} className="chip chip-cyan group cursor-pointer">
                {w.slice(0, 8)}...
                <button onClick={() => removeWallet(w)} className="text-neon-cyan/50 hover:text-neon-cyan ml-1">×</button>
              </span>
            ))}
          </div>
        </div>

        {/* Treasury */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-white mb-2">Treasury Contract <span className="text-white/30">(optional)</span></h3>
          <input
            className="input-glow w-full font-mono !text-sm"
            placeholder="0x..."
            value={treasuryAddress}
            onChange={(e) => setTreasuryAddress(e.target.value)}
          />
          <p className="text-white/20 text-xs mt-1.5">Enables Signal 5: treasury drain monitoring</p>
        </div>

        {/* Summary */}
        <div className="p-6 rounded-xl bg-void-50 border border-white/5 mb-8 font-mono text-sm space-y-2.5">
          <h4 className="text-white font-bold !font-sans text-base mb-4">Transaction Summary</h4>
          <div className="flex justify-between"><span className="text-white/30">Pool</span><span className="text-white">$NOVA / USDC · 0.3% fee</span></div>
          <div className="flex justify-between"><span className="text-white/30">Initial Liquidity</span><span className="text-brand font-bold">$250,000</span></div>
          <div className="neon-line my-3 opacity-20" />
          {milestones.map((m, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-white/30">Milestone {i + 1}</span>
              <span className="text-white/60">
                {m.type} {m.type === 'USERS' ? m.threshold.toLocaleString() : `$${m.threshold.toLocaleString()}`} → <span className="text-white">{m.unlockPercentage}%</span>
              </span>
            </div>
          ))}
          <div className="neon-line my-3 opacity-20" />
          <div className="flex justify-between"><span className="text-white/30">Wallets</span><span className="text-white/60">deployer + {additionalWallets.length}</span></div>
          <div className="flex justify-between"><span className="text-white/30">Rug Thresholds</span><span className="text-white/60">Standard defaults</span></div>
          <div className="flex justify-between"><span className="text-white/30">Lock Extension</span><span className="text-white/60">30 days on trigger</span></div>
        </div>

        {/* Transactions */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-brand/5 border border-brand/10">
            <Badge variant="info" className="mb-2">TX 1</Badge>
            <p className="text-white text-sm font-semibold">registerVestingPosition()</p>
            <p className="text-white/30 text-xs mt-1">Register milestones & wallets</p>
            <p className="text-white/20 text-xs font-mono mt-2">~45,000 gas</p>
          </div>
          <div className="p-4 rounded-xl bg-brand/5 border border-brand/10">
            <Badge variant="purple" className="mb-2">TX 2</Badge>
            <p className="text-white text-sm font-semibold">addLiquidity()</p>
            <p className="text-white/30 text-xs mt-1">Lock LP tokens in vault</p>
            <p className="text-white/20 text-xs font-mono mt-2">~120,000 gas</p>
          </div>
        </div>

        {/* Checkbox */}
        <label className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:border-white/10 transition">
          <input
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
            className="mt-1 accent-cyan-400"
          />
          <span className="text-sm text-white/50">
            I understand my LP tokens will be held in Proven's vault and can <strong className="text-white/70">only be released</strong> by meeting the milestones above.
          </span>
        </label>

        <div className="flex justify-between gap-3 mt-8 pt-6 border-t border-white/5">
          <button className="btn-secondary px-6 py-2.5" onClick={() => setCurrentStep(2)}>← Back</button>
          <button className={`btn-primary px-8 py-2.5 ${!understood ? 'opacity-40 cursor-not-allowed' : ''}`} disabled={!understood}>
            <span className="inline-flex items-center gap-2"><Lock className="w-4 h-4" /> Sign with MetaMask</span>
          </button>
        </div>
      </Card>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="text-center mb-10 animate-fade-up opacity-0">
        <Badge variant="info" pulse className="mb-4">TEAM FLOW</Badge>
        <h1 className="text-3xl md:text-4xl font-black text-white mb-2">Launch Your Pool</h1>
        <p className="text-white/30">Deploy performance-vested liquidity on Uniswap v4</p>
      </div>

      {/* Step Progress */}
      <div className="mb-12 animate-fade-up opacity-0 delay-100">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          {steps.map((step, i) => (
            <div key={step.num} className="flex items-center">
              <div className="flex flex-col items-center">
                <button
                  onClick={() => step.num < currentStep && setCurrentStep(step.num as 1 | 2 | 3)}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm transition-all duration-500 ${
                    step.num === currentStep
                      ? 'bg-brand/20 border-2 border-brand text-brand shadow-neon-green'
                      : step.num < currentStep
                      ? 'bg-brand/20 border-2 border-brand text-brand'
                      : 'bg-white/5 border-2 border-white/10 text-white/20'
                  }`}
                >
                  {step.num < currentStep ? <CheckCircle className="w-4 h-4" /> : <step.icon className="w-5 h-5" />}
                </button>
                <span className={`text-xs mt-2 font-semibold ${
                  step.num <= currentStep ? 'text-white/60' : 'text-white/20'
                }`}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-20 h-0.5 mx-4 mb-6 rounded transition-all duration-500 ${
                  step.num < currentStep ? 'bg-brand shadow-[0_0_6px_rgba(0,230,118,0.4)]' : 'bg-white/10'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Steps */}
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
    </div>
  )
}
