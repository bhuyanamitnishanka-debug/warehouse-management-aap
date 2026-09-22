/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  AMRUnit, 
  RoboticArmUnit, 
  ConveyorUnit, 
  LoadingDockUnit, 
  WarehouseMetrics 
} from '../types';
import { soundFx } from '../utils/audio';
import { 
  Activity, 
  Battery, 
  TrendingUp, 
  TrendingDown, 
  Truck, 
  Boxes, 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw, 
  Wifi, 
  Cpu, 
  Sliders, 
  X,
  Gauge,
  Bot
} from 'lucide-react';

interface OperatorTabletHUDProps {
  metrics: WarehouseMetrics;
  amrs: AMRUnit[];
  roboticArms: RoboticArmUnit[];
  conveyor: ConveyorUnit;
  docks: LoadingDockUnit[];
  onClose?: () => void;
  isEmbedded?: boolean;
}

export const OperatorTabletHUD: React.FC<OperatorTabletHUDProps> = ({
  metrics,
  amrs,
  roboticArms,
  conveyor,
  docks,
  onClose,
  isEmbedded = false,
}) => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'amr_fleet' | 'diagnostics'>('metrics');
  const [pulseTick, setPulseTick] = useState(0);

  // Dynamic telemetry chart data ticks
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseTick((t) => t + 1);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  // Generate dynamic wave points for live charts
  const generateChartPoints = (seed: number, base: number, variance: number, count: number = 16) => {
    return Array.from({ length: count }, (_, i) => {
      const val = base + Math.sin((pulseTick + i + seed) * 0.6) * variance + Math.cos((pulseTick + i * 2) * 0.4) * (variance * 0.5);
      return Math.max(10, Math.min(90, val));
    });
  };

  const inboundPoints = generateChartPoints(2, 65, 18);
  const outboundPoints = generateChartPoints(5, 72, 14);
  const domesticPoints = generateChartPoints(8, 55, 22);
  const globalPoints = generateChartPoints(11, 80, 12);

  const renderPath = (pts: number[], color: string, fillGradientId: string) => {
    const w = 260;
    const h = 70;
    const step = w / (pts.length - 1);
    const dLine = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - (p / 100) * h}`).join(' ');
    const dArea = `${dLine} L ${w} ${h} L 0 ${h} Z`;

    return (
      <svg className="w-full h-18 overflow-visible" viewBox={`0 0 ${w} ${h}`}>
        <defs>
          <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={dArea} fill={`url(#${fillGradientId})`} />
        <path d={dLine} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        {/* Glowing dot on current head */}
        <circle
          cx={(pts.length - 1) * step}
          cy={h - (pts[pts.length - 1] / 100) * h}
          r="4"
          fill={color}
          className="animate-ping"
        />
        <circle
          cx={(pts.length - 1) * step}
          cy={h - (pts[pts.length - 1] / 100) * h}
          r="3.5"
          fill="#ffffff"
        />
      </svg>
    );
  };

  return (
    <div
      className={`${
        isEmbedded
          ? 'w-full'
          : 'fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-md animate-in fade-in duration-200'
      }`}
    >
      {/* Handheld Rugged Industrial Tablet Bezel */}
      <div className="relative w-full max-w-4xl bg-slate-950 rounded-3xl border-4 border-slate-700 shadow-[0_0_50px_rgba(15,23,42,0.9)] p-3 md:p-5 overflow-hidden">
        {/* Rugged rubber corner bumpers */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-2xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-2xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-2xl pointer-events-none" />

        {/* Tablet Top Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-sm md:text-base font-bold text-slate-100 tracking-wider">
                  TELEMETRY CONTROL TERMINAL v4.8
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
                  <Wifi className="w-3 h-3" /> ONLINE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Field Supervisor: Sarah Chen (ID #OP-9102) &bull; Facility 07
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Tabs */}
            <div className="hidden sm:flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => {
                  setActiveTab('metrics');
                  soundFx.playClick();
                }}
                className={`px-3 py-1 text-xs font-mono rounded-lg transition-all ${
                  activeTab === 'metrics'
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Logistics Telemetry
              </button>
              <button
                onClick={() => {
                  setActiveTab('amr_fleet');
                  soundFx.playClick();
                }}
                className={`px-3 py-1 text-xs font-mono rounded-lg transition-all ${
                  activeTab === 'amr_fleet'
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                AMR Fleet ({amrs.length})
              </button>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Direct replication of User's Image Tablet Metrics */}
        {activeTab === 'metrics' && (
          <div className="space-y-4">
            {/* 4 Core Metrics Grid (As seen in the image) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {/* Inbound Metrics Card */}
              <div className="bg-slate-900/90 rounded-2xl p-3.5 border border-slate-800/80 shadow-inner">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="font-mono text-xs font-bold text-slate-200 tracking-wider">
                      INBOUND METRICS
                    </span>
                  </div>
                  <span className="font-mono text-xs text-cyan-400 font-bold">
                    {metrics.inboundPerHour} pkgs/hr
                  </span>
                </div>
                {renderPath(inboundPoints, '#06b6d4', 'inboundGrad')}
                <div className="flex justify-between items-center mt-2 text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/50">
                  <span>Dock 04 Active Feed</span>
                  <span className="text-emerald-400 font-semibold">+6.4% vs Shift Avg</span>
                </div>
              </div>

              {/* Outbound Metrics Card */}
              <div className="bg-slate-900/90 rounded-2xl p-3.5 border border-slate-800/80 shadow-inner">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="font-mono text-xs font-bold text-slate-200 tracking-wider">
                      OUTBOUND METRICS
                    </span>
                  </div>
                  <span className="font-mono text-xs text-emerald-400 font-bold">
                    {metrics.outboundPerHour} pkgs/hr
                  </span>
                </div>
                {renderPath(outboundPoints, '#10b981', 'outboundGrad')}
                <div className="flex justify-between items-center mt-2 text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/50">
                  <span>Dock 05 Cross-Dock Staging</span>
                  <span className="text-emerald-400 font-semibold">98.2% Sorter Accuracy</span>
                </div>
              </div>

              {/* Domestic Logistics */}
              <div className="bg-slate-900/90 rounded-2xl p-3.5 border border-slate-800/80 shadow-inner">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="font-mono text-xs font-bold text-slate-200 tracking-wider">
                      DOMESTIC LOGISTICS
                    </span>
                  </div>
                  <span className="font-mono text-xs text-amber-400 font-bold">
                    12,410 Units
                  </span>
                </div>
                {renderPath(domesticPoints, '#f59e0b', 'domesticGrad')}
                <div className="flex justify-between items-center mt-2 text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/50">
                  <span>Regional Hub Fulfillment</span>
                  <span className="text-slate-300">Carrier: Swift Global</span>
                </div>
              </div>

              {/* Global Logistics */}
              <div className="bg-slate-900/90 rounded-2xl p-3.5 border border-slate-800/80 shadow-inner">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="font-mono text-xs font-bold text-slate-200 tracking-wider">
                      GLOBAL LOGISTICS & FREIGHT
                    </span>
                  </div>
                  <span className="font-mono text-xs text-blue-400 font-bold">
                    6,040 Units
                  </span>
                </div>
                {renderPath(globalPoints, '#3b82f6', 'globalGrad')}
                <div className="flex justify-between items-center mt-2 text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/50">
                  <span>Intermodal Ocean / Air Hub</span>
                  <span className="text-slate-300">Carrier: Maersk Line</span>
                </div>
              </div>
            </div>

            {/* Bottom Telemetry Vitals Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] font-mono text-slate-400 block">OVERALL OEE</span>
                <span className="text-base font-mono font-extrabold text-emerald-400">{metrics.oee}%</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] font-mono text-slate-400 block">CONVEYOR VELOCITY</span>
                <span className="text-base font-mono font-extrabold text-cyan-400">{conveyor.speedMpm} m/min</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] font-mono text-slate-400 block">ROBOTIC ARMS MTBF</span>
                <span className="text-base font-mono font-extrabold text-slate-200">6,500 hrs</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] font-mono text-slate-400 block">GRID ENERGY DRAW</span>
                <span className="text-base font-mono font-extrabold text-amber-400">{metrics.energyDrawKW} kW</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: AMR Fleet Details */}
        {activeTab === 'amr_fleet' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {amrs.map((amr) => (
              <div
                key={amr.id}
                className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-mono text-xs font-bold text-white">{amr.name}</h4>
                    <span className="text-[10px] font-mono text-slate-400 block">{amr.zone}</span>
                    <span className="text-[10px] font-mono text-cyan-400">
                      Payload: {amr.cargoLabel} ({amr.vitals.loadKg} kg)
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <Battery className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-mono text-xs font-bold text-slate-200">
                      {amr.vitals.batteryPct}%
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 block">
                    Speed: {amr.vitals.speedMps} m/s
                  </span>
                  <span
                    className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                      amr.status === 'optimal'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {amr.state}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
