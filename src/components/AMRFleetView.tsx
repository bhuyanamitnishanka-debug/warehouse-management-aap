/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AMRUnit, AssetStatus } from '../types';
import { soundFx } from '../utils/audio';
import { 
  Bot, 
  Battery, 
  Zap, 
  MapPin, 
  ArrowRight, 
  Sliders, 
  PauseCircle, 
  PlayCircle, 
  Compass, 
  CheckCircle2, 
  AlertTriangle,
  RotateCw
} from 'lucide-react';

interface AMRFleetViewProps {
  amrs: AMRUnit[];
  setAmrs: React.Dispatch<React.SetStateAction<AMRUnit[]>>;
  onSelectAMR: (amr: AMRUnit) => void;
}

export const AMRFleetView: React.FC<AMRFleetViewProps> = ({
  amrs,
  setAmrs,
  onSelectAMR,
}) => {
  const handleDispatch = (amrId: string, destination: string) => {
    soundFx.playSuccess();
    setAmrs((prev) =>
      prev.map((a) => {
        if (a.id !== amrId) return a;
        return {
          ...a,
          zone: destination,
          state: 'transit',
        };
      })
    );
  };

  const handleToggleEmergencyStop = (amrId: string) => {
    soundFx.playAlarm();
    setAmrs((prev) =>
      prev.map((a) => {
        if (a.id !== amrId) return a;
        const isHalted = a.state === 'stopped';
        return {
          ...a,
          state: isHalted ? 'transit' : 'stopped',
          status: isHalted ? 'optimal' : 'warning',
        };
      })
    );
  };

  return (
    <div className="space-y-6">
      {/* Fleet KPI Summary Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-lg">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-1">
            <Bot className="w-4 h-4 text-emerald-400" />
            <span>Active AMR Units</span>
          </div>
          <div className="text-2xl font-mono font-extrabold text-white">
            {amrs.filter((a) => a.state !== 'stopped').length} / {amrs.length}
          </div>
          <span className="text-[10px] font-mono text-emerald-400">100% Path Adherence</span>
        </div>

        <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-lg">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-1">
            <Battery className="w-4 h-4 text-cyan-400" />
            <span>Avg Fleet Battery</span>
          </div>
          <div className="text-2xl font-mono font-extrabold text-cyan-400">
            {Math.round(amrs.reduce((acc, a) => acc + (a.vitals.batteryPct || 0), 0) / amrs.length)}%
          </div>
          <span className="text-[10px] font-mono text-slate-400">Inductive charge online</span>
        </div>

        <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-lg">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-1">
            <Compass className="w-4 h-4 text-blue-400" />
            <span>Avg Transit Speed</span>
          </div>
          <div className="text-2xl font-mono font-extrabold text-white">1.35 m/s</div>
          <span className="text-[10px] font-mono text-slate-400">Dynamic obstacle braking</span>
        </div>

        <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-lg">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-1">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Fleet Payload Moved</span>
          </div>
          <div className="text-2xl font-mono font-extrabold text-amber-400">14.8 Tons</div>
          <span className="text-[10px] font-mono text-slate-400">Current shift</span>
        </div>
      </div>

      {/* AMR Fleet Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {amrs.map((amr) => {
          const vitals = amr.vitals;
          const isStopped = amr.state === 'stopped';

          return (
            <div
              key={amr.id}
              className={`bg-slate-900/95 rounded-2xl p-5 border transition-all ${
                isStopped
                  ? 'border-rose-500/60 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
                  : 'border-slate-800 hover:border-slate-700 shadow-xl'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <Bot className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-mono text-sm font-bold text-white tracking-wide">
                      {amr.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                      <span>{amr.code}</span>
                      <span>&bull;</span>
                      <span className="text-slate-400">{amr.zone}</span>
                    </div>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                    isStopped
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : amr.status === 'optimal'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {amr.state}
                </span>
              </div>

              {/* Specs & Gauges */}
              <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-800/80 my-3 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px]">BATTERY</span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-200">
                    <Battery className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{vitals.batteryPct}%</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px]">PAYLOAD</span>
                  <span className="font-bold text-slate-200">
                    {vitals.loadKg} / {vitals.maxLoadKg} kg
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px]">MOTOR TEMP</span>
                  <span className="font-bold text-slate-200">
                    {vitals.temperatureC.toFixed(1)}°C
                  </span>
                </div>
              </div>

              {/* Cargo Status */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs font-mono mb-4 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[10px]">CURRENT CARGO ASSIGNMENT</span>
                  <span className="text-white font-semibold">
                    {amr.carryingCargo ? `${amr.cargoType.toUpperCase()}: ${amr.cargoLabel}` : 'Empty / Available for staging'}
                  </span>
                </div>
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: amr.carryingCargo ? amr.cargoColor : '#334155' }}
                />
              </div>

              {/* Control Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => onSelectAMR(amr)}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-semibold transition-all text-center"
                >
                  Inspect Vitals
                </button>

                <button
                  onClick={() => handleDispatch(amr.id, 'Zone D - Dock Staging')}
                  className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-semibold transition-all"
                >
                  Route to Dock 04
                </button>

                <button
                  onClick={() => handleToggleEmergencyStop(amr.id)}
                  className={`p-2 rounded-xl border transition-all ${
                    isStopped
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                      : 'bg-rose-950/80 hover:bg-rose-900 border-rose-600 text-rose-300'
                  }`}
                  title={isStopped ? 'Resume Robot Transit' : 'Emergency E-Stop'}
                >
                  {isStopped ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
