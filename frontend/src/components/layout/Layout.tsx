import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useDevice } from '../../context/DeviceContext';
import { FlaskConical, AlertTriangle, RefreshCw, SunMedium } from 'lucide-react';

export const Layout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isDemoMode, isStale, lastCommunicationTime, demoAmbientLight, setDemoAmbientLight } = useDevice();

  return (
    <div className="flex min-h-screen bg-background font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />

        {/* Demo Mode Top Banner */}
        {isDemoMode && (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-800 dark:text-amber-300">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  <strong>DEMO DATA — NOT CONNECTED TO HARDWARE.</strong> Simulated readings & automatic LED logic are running in-browser.
                </span>
              </div>
              {/* Interactive Demo Ambient Light Quick Slider */}
              <div className="flex items-center space-x-2 bg-card/80 px-2.5 py-1 rounded-md border border-amber-500/20 shadow-xs">
                <SunMedium className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">Simulate Ambient ADC:</span>
                <input
                  type="range"
                  min="300"
                  max="3800"
                  step="50"
                  value={demoAmbientLight}
                  onChange={(e) => setDemoAmbientLight(Number(e.target.value))}
                  className="h-1.5 w-24 cursor-pointer accent-amber-500"
                />
                <span className="font-mono text-[11px] font-bold text-foreground w-10 text-right">
                  {demoAmbientLight}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Stale / Offline Warning Banner for Live Hardware */}
        {!isDemoMode && isStale && (
          <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs font-medium text-destructive">
            <div className="mx-auto flex max-w-7xl items-center space-x-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <strong>DEVICE OFFLINE:</strong> The ESP32 has not communicated recently (last seen: {lastCommunicationTime ? new Date(lastCommunicationTime).toLocaleTimeString() : 'Never'}). Sensor readings below are cached and stale. Remote controls are suspended until reconnection.
              </span>
            </div>
          </div>
        )}

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
