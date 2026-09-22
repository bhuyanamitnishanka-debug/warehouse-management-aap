/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Asset, 
  AssetStatus, 
  AMRUnit, 
  RoboticArmUnit, 
  ConveyorUnit, 
  LoadingDockUnit, 
  WorkOrder, 
  Technician, 
  WarehouseMetrics, 
  ViewMode 
} from './types';
import { 
  INITIAL_AMRS, 
  INITIAL_ROBOTIC_ARMS, 
  INITIAL_CONVEYOR, 
  INITIAL_DOCKS, 
  INITIAL_WORK_ORDERS, 
  INITIAL_TECHNICIANS, 
  INITIAL_METRICS 
} from './data/warehouseData';
import { Navbar } from './components/Navbar';
import { WarehouseCanvas } from './components/WarehouseCanvas';
import { OperatorTabletHUD } from './components/OperatorTabletHUD';
import { AssetDiagnosticsDrawer } from './components/AssetDiagnosticsDrawer';
import { MaintenanceDashboard } from './components/MaintenanceDashboard';
import { AMRFleetView } from './components/AMRFleetView';
import { LaborResourceView } from './components/LaborResourceView';
import { AssetQRScannerModal } from './components/AssetQRScannerModal';
import { soundFx } from './utils/audio';
import { 
  Gauge, 
  Bot, 
  Activity, 
  ShieldCheck, 
  Wrench, 
  Sparkles, 
  Layers, 
  Cpu, 
  Radio, 
  Truck,
  Zap,
  Users
} from 'lucide-react';

export default function App() {
  // Core simulated warehouse state
  const [amrs, setAmrs] = useState<AMRUnit[]>(INITIAL_AMRS);
  const [roboticArms, setRoboticArms] = useState<RoboticArmUnit[]>(INITIAL_ROBOTIC_ARMS);
  const [conveyor, setConveyor] = useState<ConveyorUnit>(INITIAL_CONVEYOR);
  const [docks, setDocks] = useState<LoadingDockUnit[]>(INITIAL_DOCKS);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(INITIAL_WORK_ORDERS);
  const [technicians, setTechnicians] = useState<Technician[]>(INITIAL_TECHNICIANS);
  const [metrics, setMetrics] = useState<WarehouseMetrics>(INITIAL_METRICS);

  // App navigation & interaction states
  const [currentView, setCurrentView] = useState<ViewMode>('prototype');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isTabletModalOpen, setIsTabletModalOpen] = useState<boolean>(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState<boolean>(false);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Calculate active alarms
  const activeAlarms = [
    ...amrs.filter((a) => a.status === 'critical'),
    ...roboticArms.filter((a) => a.status === 'critical'),
    ...(conveyor.status === 'critical' ? [conveyor] : []),
    ...docks.filter((d) => d.status === 'critical'),
  ];

  // Calculate Technician Utilization: percentage of total labor hours allocated to active work orders vs total shift capacity
  const technicianUtilization = useMemo(() => {
    // Total shift capacity across technicians (hours)
    const totalShiftCapacity = technicians.reduce((sum, t) => sum + (t.shiftMaxHours || 8), 0);

    // Active work orders (in progress or pending dispatch)
    const activeWorkOrders = workOrders.filter(
      (wo) => wo.status === 'in_progress' || wo.status === 'pending'
    );

    // Total labor hours currently allocated to active work orders
    const allocatedLaborHours = activeWorkOrders.reduce(
      (sum, wo) => sum + (wo.estimatedHours || 0),
      0
    );

    const percentage = totalShiftCapacity > 0 ? (allocatedLaborHours / totalShiftCapacity) * 100 : 0;
    const formattedPct = percentage % 1 === 0 ? percentage.toFixed(0) : percentage.toFixed(1);

    return {
      percentage,
      formattedPct,
      allocatedLaborHours,
      totalShiftCapacity,
      activeOrdersCount: activeWorkOrders.length,
    };
  }, [technicians, workOrders]);

  // Trigger Fault / Alarm injection
  const handleTriggerFault = (assetId: string) => {
    soundFx.playAlarm();

    if (assetId === 'conv-01') {
      setConveyor((prev) => ({
        ...prev,
        status: 'critical',
        vitals: {
          ...prev.vitals,
          temperatureC: 84.5,
          vibrationRms: 7.8,
          healthScore: 54,
        },
      }));
      // Add emergency work order
      const newWo: WorkOrder = {
        id: `WO-${Math.floor(4130 + Math.random() * 50)}`,
        title: 'EMERGENCY: Sorter Conveyor Drive Bearing Thermal Surge',
        assetId: 'conv-01',
        assetName: 'Main High-Speed Roller Conveyor',
        assetCode: 'CNV-SORT-01',
        priority: 'urgent',
        status: 'pending',
        assignedTechnician: 'Marcus Vance',
        technicianRole: 'Senior Mechanical Tech',
        category: 'Mechanical',
        createdDate: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        estimatedHours: 1.5,
        description: 'Vibration frequency exceeded ISO limit. Bearing temperature 84.5°C. Conveyor auto-interlocked.',
        steps: [
          { text: 'Isolate main conveyor electrical bus', completed: false },
          { text: 'Check drive belt alignment and thermal sensor', completed: false },
          { text: 'Inspect bearing race for spalling or grease breakdown', completed: false },
        ],
      };
      setWorkOrders((prev) => [newWo, ...prev]);
    } else if (assetId.startsWith('amr')) {
      setAmrs((prev) =>
        prev.map((a) => {
          if (a.id !== assetId) return a;
          return {
            ...a,
            status: 'critical',
            state: 'stopped',
            vitals: {
              ...a.vitals,
              healthScore: 61,
            },
          };
        })
      );
    }
  };

  // Combined assets array for maintenance analytics & dashboards
  const allAssets: Asset[] = [
    conveyor,
    ...roboticArms,
    ...amrs,
    ...docks,
  ];

  // Select asset by ID
  const handleSelectAssetById = (assetId: string, switchView = true) => {
    let found: Asset | undefined;
    if (assetId.startsWith('amr')) {
      found = amrs.find((a) => a.id === assetId);
    } else if (assetId.startsWith('arm')) {
      found = roboticArms.find((a) => a.id === assetId);
    } else if (assetId.startsWith('conv')) {
      found = conveyor;
    } else if (assetId.startsWith('dock')) {
      found = docks.find((d) => d.id === assetId);
    }

    if (found) {
      setSelectedAsset(found);
      if (switchView) {
        setCurrentView('prototype');
      }
    }
  };

  // Update asset status
  const handleUpdateAssetStatus = (assetId: string, newStatus: AssetStatus, faultMessage?: string) => {
    if (assetId.startsWith('amr')) {
      setAmrs((prev) =>
        prev.map((a) => {
          if (a.id !== assetId) return a;
          return {
            ...a,
            status: newStatus,
            state: newStatus === 'critical' ? 'stopped' : 'transit',
            vitals: {
              ...a.vitals,
              healthScore: newStatus === 'optimal' ? 96 : 58,
            },
          };
        })
      );
    } else if (assetId.startsWith('arm')) {
      setRoboticArms((prev) =>
        prev.map((a) => {
          if (a.id !== assetId) return a;
          return {
            ...a,
            status: newStatus,
            vitals: {
              ...a.vitals,
              healthScore: newStatus === 'optimal' ? 97 : 60,
            },
          };
        })
      );
    } else if (assetId.startsWith('conv')) {
      setConveyor((prev) => ({
        ...prev,
        status: newStatus,
        vitals: {
          ...prev.vitals,
          temperatureC: newStatus === 'optimal' ? 51.2 : 82.0,
          vibrationRms: newStatus === 'optimal' ? 3.1 : 7.2,
          healthScore: newStatus === 'optimal' ? 92 : 55,
        },
      }));
    }

    // Also update selectedAsset instance if open
    if (selectedAsset && selectedAsset.id === assetId) {
      setSelectedAsset((prev) =>
        prev
          ? {
              ...prev,
              status: newStatus,
              vitals: {
                ...prev.vitals,
                healthScore: newStatus === 'optimal' ? 96 : 58,
              },
            }
          : null
      );
    }
  };

  // Create work order
  const handleCreateWorkOrder = (partialWo: Partial<WorkOrder>) => {
    const fullWo: WorkOrder = {
      id: partialWo.id || `WO-${Math.floor(4130 + Math.random() * 50)}`,
      title: partialWo.title || 'Diagnostic Inspection',
      assetId: partialWo.assetId || 'conv-01',
      assetName: partialWo.assetName || 'Warehouse Asset',
      assetCode: partialWo.assetCode || 'WHS-AST',
      priority: partialWo.priority || 'medium',
      status: partialWo.status || 'pending',
      assignedTechnician: partialWo.assignedTechnician || 'Sarah Chen',
      technicianRole: partialWo.technicianRole || 'Robotics Specialist',
      category: partialWo.category || 'Mechanical',
      createdDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      estimatedHours: partialWo.estimatedHours || 1.5,
      description: partialWo.description || 'Maintenance task dispatched.',
      steps: partialWo.steps || [{ text: 'Perform visual inspection', completed: false }],
    };
    setWorkOrders((prev) => [fullWo, ...prev]);
  };

  // Simulate predictive anomalies (declining health / elevated temperature while still operational)
  const handleSimulatePredictiveAnomaly = (assetId: string, anomalyType: 'thermal' | 'vibration' | 'normalize') => {
    if (anomalyType === 'normalize') {
      soundFx.playSuccess();
      setConveyor((prev) => ({
        ...prev,
        status: 'optimal',
        vitals: {
          ...prev.vitals,
          temperatureC: 51.2,
          vibrationRms: 3.1,
          healthScore: 94,
        },
      }));
      setAmrs((prev) =>
        prev.map((a) => ({
          ...a,
          status: 'optimal',
          vitals: {
            ...a.vitals,
            temperatureC: 38.0,
            vibrationRms: 1.2,
            healthScore: 96,
          },
        }))
      );
      setRoboticArms((prev) =>
        prev.map((arm) => ({
          ...arm,
          status: 'optimal',
          vitals: {
            ...arm.vitals,
            temperatureC: 44.0,
            vibrationRms: 2.1,
            healthScore: 96,
          },
        }))
      );
    } else if (anomalyType === 'thermal') {
      soundFx.playAlarm();
      setConveyor((prev) => ({
        ...prev,
        status: 'warning',
        rollersActive: true,
        vitals: {
          ...prev.vitals,
          temperatureC: 66.8,
          vibrationRms: 4.4,
          healthScore: 74,
        },
      }));
    } else if (anomalyType === 'vibration') {
      soundFx.playAlarm();
      setAmrs((prev) =>
        prev.map((a) => {
          if (a.id !== 'amr-02') return a;
          return {
            ...a,
            status: 'warning',
            state: 'transit',
            vitals: {
              ...a.vitals,
              temperatureC: 49.5,
              vibrationRms: 4.3,
              healthScore: 71,
            },
          };
        })
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Industrial Header Navigation */}
      <Navbar
        currentView={currentView}
        onSelectView={setCurrentView}
        activeAlarmsCount={activeAlarms.length}
        onToggleTabletModal={() => setIsTabletModalOpen(true)}
        onToggleQRScanner={() => setIsQRScannerOpen(true)}
      />

      {/* Main App Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 md:p-6 space-y-6">
        {/* KPI Live Telemetry Ticker */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
          <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 shadow-sm flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Gauge className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono text-slate-400 uppercase block truncate">OEE SCORE</span>
              <span className="text-base font-mono font-bold text-white">{metrics.oee}%</span>
            </div>
          </div>

          <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 shadow-sm flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono text-slate-400 uppercase block truncate">AMR FLEET</span>
              <span className="text-base font-mono font-bold text-cyan-400 truncate block">
                {amrs.filter((a) => a.state !== 'stopped').length}/{amrs.length} Active
              </span>
            </div>
          </div>

          <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 shadow-sm flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono text-slate-400 uppercase block truncate">SORT VELOCITY</span>
              <span className="text-base font-mono font-bold text-white truncate block">{conveyor.speedMpm} m/m</span>
            </div>
          </div>

          <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 shadow-sm flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono text-slate-400 uppercase block truncate">GRID ENERGY</span>
              <span className="text-base font-mono font-bold text-white truncate block">{metrics.energyDrawKW} kW</span>
            </div>
          </div>

          <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 shadow-sm flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <Wrench className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono text-slate-400 uppercase block truncate">OPEN ORDERS</span>
              <span className="text-base font-mono font-bold text-white truncate block">
                {workOrders.filter((w) => w.status !== 'completed').length} Pending
              </span>
            </div>
          </div>

          {/* Technician Utilization Metric */}
          <div 
            onClick={() => {
              soundFx.playClick();
              setCurrentView('labor');
            }}
            className="bg-slate-900/90 hover:bg-slate-800/90 transition-all cursor-pointer rounded-xl p-3 border border-slate-800 hover:border-indigo-500/50 shadow-sm flex items-center gap-2.5 min-w-0 group"
            title={`Technician Utilization: ${technicianUtilization.formattedPct}% (${technicianUtilization.allocatedLaborHours.toFixed(1)}h allocated across ${technicianUtilization.activeOrdersCount} active work orders vs ${technicianUtilization.totalShiftCapacity}h total shift capacity). Click to view Labor & Shifts.`}
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono text-slate-400 uppercase block truncate group-hover:text-indigo-300 transition-colors" title="Technician Utilization">
                TECH UTILIZATION
              </span>
              <div className="flex items-baseline gap-1 truncate">
                <span className="text-base font-mono font-bold text-indigo-300">
                  {technicianUtilization.formattedPct}%
                </span>
                <span className="text-[9px] font-mono text-slate-400 hidden xl:inline">
                  ({technicianUtilization.allocatedLaborHours.toFixed(1)}/{technicianUtilization.totalShiftCapacity}h)
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 shadow-sm flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono text-slate-400 uppercase block truncate">SAFETY RECORD</span>
              <span className="text-base font-mono font-bold text-emerald-400 truncate block">184 Days</span>
            </div>
          </div>
        </div>

        {/* View 1: Interactive Animated Warehouse Prototype (2.5D Digital Twin) */}
        {currentView === 'prototype' && (
          <div className="space-y-6">
            <WarehouseCanvas
              amrs={amrs}
              setAmrs={setAmrs}
              roboticArms={roboticArms}
              setRoboticArms={setRoboticArms}
              conveyor={conveyor}
              setConveyor={setConveyor}
              docks={docks}
              setDocks={setDocks}
              selectedAsset={selectedAsset}
              onSelectAsset={setSelectedAsset}
              simulationSpeed={simulationSpeed}
              setSimulationSpeed={setSimulationSpeed}
              isPaused={isPaused}
              setIsPaused={setIsPaused}
              onTriggerFault={handleTriggerFault}
              onOpenQRScanner={() => setIsQRScannerOpen(true)}
            />

            {/* Quick-Access Machine Status Deck */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Conveyor */}
              <div
                onClick={() => setSelectedAsset(conveyor)}
                className="bg-slate-900/80 hover:bg-slate-900 p-4 rounded-xl border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition-all shadow-md group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">
                    CNV-SORT-01
                  </span>
                  <span
                    className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                      conveyor.status === 'optimal'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300 animate-pulse'
                    }`}
                  >
                    {conveyor.status}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-mono mb-2">
                  High-Speed Roller & Scanner
                </p>
                <div className="flex justify-between text-[11px] font-mono text-slate-400 border-t border-slate-800 pt-2">
                  <span>Temp: {conveyor.vitals.temperatureC.toFixed(1)}°C</span>
                  <span className="text-cyan-400 font-semibold">Inspect &rarr;</span>
                </div>
              </div>

              {/* Robotic Arm 01 */}
              <div
                onClick={() => setSelectedAsset(roboticArms[0])}
                className="bg-slate-900/80 hover:bg-slate-900 p-4 rounded-xl border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition-all shadow-md group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">
                    RA-PK-01 (KUKA)
                  </span>
                  <span
                    className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                      roboticArms[0].status === 'optimal'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {roboticArms[0].status}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-mono mb-2">
                  6-Axis Rail Pick & Place Arm
                </p>
                <div className="flex justify-between text-[11px] font-mono text-slate-400 border-t border-slate-800 pt-2">
                  <span>Cycle: {roboticArms[0].phase}</span>
                  <span className="text-cyan-400 font-semibold">Inspect &rarr;</span>
                </div>
              </div>

              {/* AMR Unit 01 */}
              <div
                onClick={() => setSelectedAsset(amrs[0])}
                className="bg-slate-900/80 hover:bg-slate-900 p-4 rounded-xl border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition-all shadow-md group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">
                    AMR-ECH-01
                  </span>
                  <span
                    className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                      amrs[0].status === 'optimal'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {amrs[0].state}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-mono mb-2">
                  Autonomous Mobile Robot
                </p>
                <div className="flex justify-between text-[11px] font-mono text-slate-400 border-t border-slate-800 pt-2">
                  <span>Battery: {amrs[0].vitals.batteryPct}%</span>
                  <span className="text-cyan-400 font-semibold">Inspect &rarr;</span>
                </div>
              </div>

              {/* Dock Bay 04 */}
              <div
                onClick={() => setSelectedAsset(docks[0])}
                className="bg-slate-900/80 hover:bg-slate-900 p-4 rounded-xl border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition-all shadow-md group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">
                    DCK-BAY-04
                  </span>
                  <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                    INBOUND
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-mono mb-2">
                  Swift Global Freight Trailer
                </p>
                <div className="flex justify-between text-[11px] font-mono text-slate-400 border-t border-slate-800 pt-2">
                  <span>Progress: {docks[0].progressPct.toFixed(0)}%</span>
                  <span className="text-cyan-400 font-semibold">Inspect &rarr;</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View 2: Maintenance & Work Orders Hub */}
        {currentView === 'maintenance' && (
          <MaintenanceDashboard
            workOrders={workOrders}
            setWorkOrders={setWorkOrders}
            technicians={technicians}
            assets={allAssets}
            selectedAssetId={selectedAsset?.id}
            onSelectAssetById={(id) => handleSelectAssetById(id, false)}
            onCreateWorkOrder={handleCreateWorkOrder}
            onSimulatePredictiveAnomaly={handleSimulatePredictiveAnomaly}
            onSimulateIncident={(type) => {
              if (type === 'conveyor_bearing') handleTriggerFault('conv-01');
              if (type === 'amr_obstacle') handleTriggerFault('amr-02');
              if (type === 'arm_pneumatic') handleTriggerFault('arm-01');
            }}
            onOpenQRScanner={() => setIsQRScannerOpen(true)}
          />
        )}

        {/* View 3: AMR Fleet Management View */}
        {currentView === 'fleet_amr' && (
          <AMRFleetView
            amrs={amrs}
            setAmrs={setAmrs}
            onSelectAMR={(amr) => setSelectedAsset(amr)}
          />
        )}

        {/* View 4: Labor Resource & Workforce Dispatch View */}
        {currentView === 'labor' && (
          <LaborResourceView
            technicians={technicians}
            setTechnicians={setTechnicians}
            workOrders={workOrders}
            setWorkOrders={setWorkOrders}
            assets={allAssets}
            onSelectAsset={(id) => handleSelectAssetById(id, false)}
          />
        )}
      </main>

      {/* Asset Diagnostics Slide-over Drawer */}
      <AssetDiagnosticsDrawer
        asset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
        onUpdateStatus={handleUpdateAssetStatus}
        onCreateWorkOrder={handleCreateWorkOrder}
      />

      {/* Handheld Operator Tablet Modal (Recreation of User Reference Image) */}
      {isTabletModalOpen && (
        <OperatorTabletHUD
          metrics={metrics}
          amrs={amrs}
          roboticArms={roboticArms}
          conveyor={conveyor}
          docks={docks}
          onClose={() => setIsTabletModalOpen(false)}
        />
      )}

      {/* Optical Camera QR / Barcode Asset Scanner Modal */}
      <AssetQRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        assets={allAssets}
        onSelectAsset={(asset) => {
          setSelectedAsset(asset);
          soundFx.playSuccess();
        }}
      />
    </div>
  );
}
