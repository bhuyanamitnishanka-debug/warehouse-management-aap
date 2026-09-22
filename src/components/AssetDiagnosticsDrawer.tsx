/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Asset, AssetStatus, WorkOrder } from '../types';
import { soundFx } from '../utils/audio';
import { 
  X, 
  Activity, 
  Thermometer, 
  Vibrate, 
  Battery, 
  Cpu, 
  Wrench, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  RefreshCw, 
  Play, 
  Square,
  Clock,
  Calendar,
  Zap,
  Sparkles,
  Package
} from 'lucide-react';
import { INITIAL_SPARE_PARTS } from '../data/sparePartsData';

interface AssetDiagnosticsDrawerProps {
  asset: Asset | null;
  onClose: () => void;
  onUpdateStatus: (assetId: string, newStatus: AssetStatus, faultMessage?: string) => void;
  onCreateWorkOrder: (wo: Partial<WorkOrder>) => void;
}

export const AssetDiagnosticsDrawer: React.FC<AssetDiagnosticsDrawerProps> = ({
  asset,
  onClose,
  onUpdateStatus,
  onCreateWorkOrder,
}) => {
  if (!asset) return null;

  const [testingInProgress, setTestingInProgress] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const vitals = asset.vitals;
  const isCritical = asset.status === 'critical';
  const isWarning = asset.status === 'warning';

  const handleSelfTest = () => {
    soundFx.playClick();
    setTestingInProgress(true);
    setSuccessMessage(null);

    setTimeout(() => {
      setTestingInProgress(false);
      soundFx.playSuccess();
      setSuccessMessage('Self-test complete: All sensors, motor controllers, and optical encoders within nominal tolerance.');
      if (asset.status === 'critical') {
        onUpdateStatus(asset.id, 'optimal');
      }
    }, 1400);
  };

  const handleCreateWO = () => {
    soundFx.playClick();
    const newWo: Partial<WorkOrder> = {
      title: `Emergency Diagnostic Check on ${asset.name}`,
      assetId: asset.id,
      assetName: asset.name,
      assetCode: asset.code,
      priority: isCritical ? 'urgent' : 'high',
      status: 'pending',
      assignedTechnician: 'Marcus Vance',
      technicianRole: 'Lead Automation Engineer',
      category: asset.category === 'amr' ? 'Sensors/LiDAR' : 'Mechanical',
      estimatedHours: 2.0,
      description: `Dispatched from live digital twin diagnostics. Investigate sensor telemetry on ${asset.code}.`,
      steps: [
        { text: 'Perform visual inspection of physical hardware', completed: false },
        { text: 'Check bearing grease and mechanical alignment', completed: false },
        { text: 'Verify firmware telemetry handshake', completed: false },
      ],
    };
    onCreateWorkOrder(newWo);
    soundFx.playSuccess();
    setSuccessMessage(`Maintenance Work Order WO-${Math.floor(4100 + Math.random() * 50)} created & technician dispatched!`);
  };

  const handleToggleFault = () => {
    if (asset.status === 'critical') {
      soundFx.playSuccess();
      onUpdateStatus(asset.id, 'optimal');
      setSuccessMessage('Fault cleared. Machine returned to autonomous service.');
    } else {
      soundFx.playAlarm();
      onUpdateStatus(asset.id, 'critical', 'Motor thermal threshold exceeded (>72°C) - High vibration detected.');
      setSuccessMessage('Fault injected: Machine halted into safety failover state.');
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-950 border-l border-slate-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header Bar */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              isCritical
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
            }`}
          >
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-sm font-bold text-white tracking-wide">
                {asset.name}
              </h3>
            </div>
            <span className="text-xs font-mono text-cyan-400 font-semibold">
              {asset.code} &bull; {asset.zone}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            soundFx.playClick();
            onClose();
          }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status Badge & Health Bar */}
        <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400">OPERATIONAL STATUS</span>
            <span
              className={`text-xs font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                asset.status === 'optimal'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : asset.status === 'warning'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
              }`}
            >
              {asset.status}
            </span>
          </div>

          <div className="mt-3">
            <div className="flex justify-between items-center text-xs font-mono mb-1">
              <span className="text-slate-400">Asset Health Index</span>
              <span className="text-emerald-400 font-bold">{vitals.healthScore}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  vitals.healthScore > 80
                    ? 'bg-emerald-400'
                    : vitals.healthScore > 60
                    ? 'bg-amber-400'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${vitals.healthScore}%` }}
              />
            </div>
          </div>
        </div>

        {/* Live Vitals Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Temperature */}
          <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono mb-1">
              <Thermometer className="w-3.5 h-3.5 text-amber-400" />
              <span>Motor Temp</span>
            </div>
            <div className="text-xl font-mono font-bold text-white">
              {vitals.temperatureC.toFixed(1)}°C
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              Max safe: {vitals.temperatureMax}°C
            </span>
          </div>

          {/* Vibration */}
          <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono mb-1">
              <Vibrate className="w-3.5 h-3.5 text-cyan-400" />
              <span>Vibration RMS</span>
            </div>
            <div className="text-xl font-mono font-bold text-white">
              {vitals.vibrationRms.toFixed(2)}{' '}
              <span className="text-xs font-normal text-slate-400">mm/s</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              Limit: {vitals.vibrationMax} mm/s
            </span>
          </div>

          {/* Operating Hours */}
          <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono mb-1">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Run Hours</span>
            </div>
            <div className="text-lg font-mono font-bold text-white">
              {vitals.operatingHours.toLocaleString()} h
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              MTBF: {vitals.mtbfHours} h
            </span>
          </div>

          {/* Cycle Count */}
          <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono mb-1">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span>Total Cycles</span>
            </div>
            <div className="text-lg font-mono font-bold text-white">
              {vitals.cycleCount.toLocaleString()}
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              Firmware: {vitals.firmwareVersion}
            </span>
          </div>
        </div>

        {/* Predictive Maintenance AI Assessment */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-3.5 rounded-2xl border border-cyan-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold text-cyan-300 tracking-wider">
              PREDICTIVE MAINTENANCE TELEMETRY
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-mono">
            {isCritical
              ? 'ALARM DETECTED: Kinematic thermal spike and harmonic anomaly. Automated safety interlocking active. Immediate physical inspection recommended.'
              : 'Continuous FFT vibration harmonic analysis indicates bearing lubrication remains in Grade-A condition. Projected component wear rate is 0.04% per 100 operating hours.'}
          </p>
          <div className="mt-2.5 pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex justify-between">
            <span>Next Scheduled: {vitals.nextScheduledService}</span>
            <span className="text-cyan-400 font-semibold">RUL: ~840 hrs</span>
          </div>
        </div>

        {/* Linked Critical Spare Parts & Stock Levels */}
        {(() => {
          const compatibleParts = INITIAL_SPARE_PARTS.filter(
            (p) => p.compatibleAssetIds.includes(asset.id) || p.compatibleAssetCodes.includes(asset.code)
          );
          if (compatibleParts.length === 0) return null;

          return (
            <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-white">
                  <Package className="w-3.5 h-3.5 text-cyan-400" />
                  <span>LINKED SPARE PARTS INVENTORY ({compatibleParts.length})</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Warehouse Storage</span>
              </div>

              <div className="space-y-2">
                {compatibleParts.map((part) => {
                  const isBelow = part.quantityOnHand <= part.reorderPoint;
                  return (
                    <div
                      key={part.id}
                      className={`p-2.5 rounded-xl border text-xs font-mono flex items-center justify-between gap-2 ${
                        isBelow
                          ? 'bg-rose-950/30 border-rose-800/80 text-rose-200'
                          : 'bg-slate-950/80 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white truncate">{part.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>SKU: {part.partNumber}</span>
                          <span>&bull;</span>
                          <span>Bin: {part.storageBin}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-xs font-bold text-white">
                            {part.quantityOnHand} {part.unitOfMeasure}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            (Min: {part.reorderPoint})
                          </span>
                        </div>
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded inline-block mt-0.5 ${
                            isBelow
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {isBelow ? 'REORDER ALERT' : 'IN STOCK'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Success / Alert message notice */}
        {successMessage && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs font-mono text-emerald-200 animate-in fade-in">
            {successMessage}
          </div>
        )}

        {/* Action Controls */}
        <div className="space-y-2 pt-2">
          <button
            onClick={handleSelfTest}
            disabled={testingInProgress}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-semibold py-2.5 px-4 rounded-xl transition-all border border-slate-700 active:scale-98"
          >
            <RefreshCw className={`w-4 h-4 ${testingInProgress ? 'animate-spin' : ''}`} />
            <span>{testingInProgress ? 'Running Sensor Calibration...' : 'Run Diagnostics & Zero Sensors'}</span>
          </button>

          <button
            onClick={handleCreateWO}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-semibold py-2.5 px-4 rounded-xl transition-all shadow-md active:scale-98"
          >
            <Wrench className="w-4 h-4" />
            <span>Schedule Maintenance Work Order</span>
          </button>

          <button
            onClick={handleToggleFault}
            className={`w-full flex items-center justify-center gap-2 font-mono text-xs font-semibold py-2.5 px-4 rounded-xl transition-all border active:scale-98 ${
              isCritical
                ? 'bg-emerald-900/60 hover:bg-emerald-800 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/60 hover:bg-rose-900/80 border-rose-600/50 text-rose-300'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>{isCritical ? 'Clear Fault & Resume Operation' : 'Simulate Fault Injection'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
