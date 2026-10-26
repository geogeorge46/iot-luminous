import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  History,
  Sliders,
  Settings,
  Lightbulb,
  Cpu,
  Radio,
  EyeOff,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDevice } from '../../context/DeviceContext';

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onClose }) => {
  const { device } = useDevice();

  const navItems = [
    { name: 'Overview', path: '/', icon: LayoutDashboard },
    { name: 'Live Monitoring', path: '/monitoring', icon: Activity },
    { name: 'Sensor History', path: '/history', icon: History },
    { name: 'Lighting Controls', path: '/controls', icon: Sliders },
    { name: 'Device Settings', path: '/settings', icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-4">
      <div className="space-y-6">
        {/* Brand / Logo Area */}
        <div className="flex items-center space-x-3 px-2 py-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-foreground">
              Smart IoT Lighting
            </h1>
            <p className="text-xs text-muted-foreground">ESP32 + Supabase</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center space-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Phase 2 Architecture Notice Card */}
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/40 p-3.5 text-xs text-muted-foreground">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center space-x-1.5 font-medium text-foreground">
              <Radio className="h-3.5 w-3.5 text-primary" />
              <span>PIR Motion Sensor</span>
            </div>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              Phase 2
            </span>
          </div>
          <p className="leading-relaxed">
            Hardware pin GPIO 19 is reserved. Motion-triggered adaptive overrides will become active in Phase 2.
          </p>
        </div>
      </div>

      {/* Hardware Node Specs */}
      <div className="rounded-xl border border-border bg-card p-3 text-xs shadow-sm">
        <div className="flex items-center space-x-2 text-foreground font-medium mb-1.5">
          <Cpu className="h-4 w-4 text-primary" />
          <span>ESP32 Node Target</span>
        </div>
        <div className="space-y-1 text-muted-foreground">
          <div className="flex justify-between">
            <span>Sensor Pin:</span>
            <span className="font-mono text-foreground font-medium">GPIO 34 (LDR)</span>
          </div>
          <div className="flex justify-between">
            <span>Actuator Pin:</span>
            <span className="font-mono text-foreground font-medium">GPIO 23 (LED)</span>
          </div>
          <div className="flex justify-between">
            <span>FW Version:</span>
            <span className="font-mono text-foreground">{device?.firmware_version || '1.0.0'}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-border lg:bg-card">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-card border-r border-border shadow-xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
