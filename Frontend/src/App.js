import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WagmiConfig } from 'wagmi';
import { wagmiConfig } from './config/wagmi';
import { Navbar } from './components/Navbar';
import { ParticleField, GridBackground } from './components/ParticleField';
import { SplashScreen } from './components/SplashScreen';
import { Home } from './pages/Home';
import { LaunchPool } from './pages/LaunchPool';
import { InvestorDashboard } from './pages/InvestorDashboard';
import { RSCActivityMonitor } from './pages/RSCActivityMonitor';
function App() {
    const [showSplash, setShowSplash] = useState(true);
    const handleSplashComplete = useCallback(() => {
        setShowSplash(false);
    }, []);
    if (showSplash) {
        return _jsx(SplashScreen, { onComplete: handleSplashComplete });
    }
    return (_jsx(WagmiConfig, { config: wagmiConfig, children: _jsx(Router, { children: _jsxs("div", { className: "min-h-screen bg-void relative", children: [_jsx(ParticleField, {}), _jsx(GridBackground, {}), _jsx(Navbar, {}), _jsx("main", { className: "relative z-10 pt-16", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Home, {}) }), _jsx(Route, { path: "/launch", element: _jsx(LaunchPool, {}) }), _jsx(Route, { path: "/verify", element: _jsx(InvestorDashboard, {}) }), _jsx(Route, { path: "/verify/:address", element: _jsx(InvestorDashboard, {}) }), _jsx(Route, { path: "/monitor", element: _jsx(RSCActivityMonitor, {}) })] }) })] }) }) }));
}
export default App;
