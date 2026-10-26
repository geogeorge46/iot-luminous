import React from 'react';
import { useDevice } from '../../context/DeviceContext';
import { useTheme } from '../../context/ThemeContext';
import { formatRelativeTime, formatTime } from '../../lib/utils';
import {
  Sun,
  Moon,
  Wifi,
  WifiOff,
  AlertTriangle,
  FlaskConical,
  Menu,
  Clock,
  Sparkles,
} from 'lucide-react';

interface HeaderProps {
  onMobileMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMobileMenuToggle }) => {
  const { isDemoMode, toggleDemoMode, device, isStale, lastCommunicationTime } = useDevice();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Left: Mobile hamburger + Titles */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onMobileMenuToggle}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <span className="font-bold tracking-tight text-foreground sm:text-lg">
                Adaptive Lighting System
              </span>
              <span className="hidden rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary sm:inline-block">
                v1.0
              </span>
            </div>
            <span className="text-xs text-muted-foreground hidden sm:block">
              {device?.name || 'ESP32 Lighting Controller'} ({device?.device_identifier || 'ESP32-LIGHT-001'})
            </span>
          </div>
        </div>

        {/* Right: Status Indicators + Controls */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Connectivity Status Badge */}
          {isDemoMode ? (
            <div className="flex items-center space-x-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <FlaskConical className="h-3.5 w-3.5" />
              <span className="font-semibold">Demo Mode</span>
            </div>
          ) : isStale ? (
            <div className="flex items-center space-x-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive border border-destructive/20">
              <WifiOff className="h-3.5 w-3.5" />
              <span>Device Offline</span>
            </div>
          ) : device?.is_online ? (
            <div className="flex items-center space-x-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span>Online</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <WifiOff className="h-3.5 w-3.5" />
              <span>Offline</span>
            </div>
          )}

          {/* Last Seen Timestamp */}
          <div className="hidden md:flex items-center space-x-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Updated: {formatRelativeTime(lastCommunicationTime)}</span>
          </div>

          {/* Demo Mode Toggle Switch */}
          <button
            onClick={toggleDemoMode}
            className={`hidden sm:flex items-center space-x-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              isDemoMode
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
                : 'border-border bg-card text-muted-foreground hover:bg-muted'
            }`}
            title="Toggle between hardware Supabase connection and interactive simulated demo"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>{isDemoMode ? 'Exit Demo' : 'Try Demo'}</span>
          </button>

          {/* Dark/Light Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="rounded-lg border border-border bg-card p-2 text-foreground shadow-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-slate-700" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
