import { useState, useCallback } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { WagmiConfig } from 'wagmi'
import { wagmiConfig } from './config/wagmi'
import { Navbar } from './components/Navbar'
import { ParticleField, GridBackground } from './components/ParticleField'
import { SplashScreen } from './components/SplashScreen'
import { Home } from './pages/Home'
import { LaunchPool } from './pages/LaunchPool'
import { InvestorDashboard } from './pages/InvestorDashboard'
import { RSCActivityMonitor } from './pages/RSCActivityMonitor'

function App() {
  const [showSplash, setShowSplash] = useState(true)

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false)
  }, [])

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />
  }

  return (
    <WagmiConfig config={wagmiConfig}>
      <Router>
        <div className="min-h-screen bg-void relative">
          <ParticleField />
          <GridBackground />
          <Navbar />
          <main className="relative z-10 pt-16">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/launch" element={<LaunchPool />} />
              <Route path="/verify" element={<InvestorDashboard />} />
              <Route path="/verify/:address" element={<InvestorDashboard />} />
              <Route path="/monitor" element={<RSCActivityMonitor />} />
            </Routes>
          </main>
        </div>
      </Router>
    </WagmiConfig>
  )
}

export default App
