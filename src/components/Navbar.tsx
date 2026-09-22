/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ViewMode } from '../types';
import { soundFx } from '../utils/audio';
import { 
  Boxes, 
  Wrench, 
  Tablet, 
  Bot, 
  Volume2, 
  VolumeX, 
  AlertTriangle, 
  Clock, 
  Sparkles,
  Layers,
  Users,
  QrCode
} from 'lucide-react';

interface NavbarProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  activeAlarmsCount: number;
  onToggleTabletModal: () => void;
  onToggleQRScanner: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onSelectView,
  activeAlarmsCount,
  onToggleTabletModal,
  onToggleQRScanner,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [clockStr, setClockStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClockStr(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleSound = () => {
    soundFx.isMuted = !soundFx.isMuted;
    setIsMuted(soundFx.isMuted);
    if (!soundFx.isMuted) {
      soundFx.playClick();
    }
  };

  return (
    <header className="w-full bg-slate-950/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Facility Indicator */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            <Boxes className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-sm sm:text-base font-extrabold text-white tracking-wider">
                WAREHOUSE TWIN
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold">
                PROTOTYPE v2.4
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Automated Hub 07 &bull; Maintenance & Fleet Ops
            </p>
          </div>
        </div>

        {/* View Selection Tabs */}
        <nav className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => {
              soundFx.playClick();
              onSelectView('prototype');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
              currentView === 'prototype'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">2.5D Digital Twin</span>
            <span className="sm:hidden">Twin</span>
          </button>

          <button
            onClick={() => {
              soundFx.playClick();
              onSelectView('maintenance');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
              currentView === 'maintenance'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Maintenance Hub</span>
            <span className="sm:hidden">Maintenance</span>
          </button>

          <button
            onClick={() => {
              soundFx.playClick();
              onSelectView('fleet_amr');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
              currentView === 'fleet_amr'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AMR Fleet</span>
            <span className="sm:hidden">Fleet</span>
          </button>

          <button
            onClick={() => {
              soundFx.playClick();
              onSelectView('labor');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
              currentView === 'labor'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Labor Resources</span>
            <span className="sm:hidden">Labor</span>
          </button>
        </nav>

        {/* Right Tools: Shift Clock, QR Scanner, Tablet Overlay Button, Audio & Alarms */}
        <div className="flex items-center gap-2.5">
          {/* Optical QR Scanner Button */}
          <button
            id="nav-qr-scanner-btn"
            onClick={() => {
              soundFx.playClick();
              onToggleQRScanner();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-950/70 hover:bg-blue-900/80 border border-blue-500/50 text-blue-300 font-mono text-xs font-bold transition-all shadow-[0_0_15px_rgba(59,130,246,0.2)] active:scale-95"
            title="Scan Asset QR Code with Camera"
          >
            <QrCode className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">QR Scan</span>
          </button>

          {/* Handheld Operator Tablet Button */}
          <button
            onClick={() => {
              soundFx.playClick();
              onToggleTabletModal();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-500/50 text-cyan-300 font-mono text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] active:scale-95"
            title="Open Supervisor IoT Telemetry Tablet"
          >
            <Tablet className="w-4 h-4 text-cyan-400" />
            <span className="hidden md:inline">Supervisor Tablet</span>
          </button>

          {/* Audio toggle */}
          <button
            onClick={toggleSound}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            title={isMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          {/* Alarm indicator */}
          {activeAlarmsCount > 0 ? (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 font-mono text-xs font-bold animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>{activeAlarmsCount} ALARM</span>
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>NOMINAL</span>
            </div>
          )}

          {/* Industrial Clock */}
          <div className="hidden xl:flex items-center gap-1.5 font-mono text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-200 font-semibold">{clockStr}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
