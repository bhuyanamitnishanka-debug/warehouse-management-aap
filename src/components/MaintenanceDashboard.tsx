/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { WorkOrder, Technician, WorkOrderPriority, WorkOrderStatus, Asset } from '../types';
import { soundFx } from '../utils/audio';
import { AssetPredictiveHealthTrend } from './AssetPredictiveHealthTrend';
import { ProactiveMaintenanceBanner } from './ProactiveMaintenanceBanner';
import { PreventiveMaintenanceScheduler } from './PreventiveMaintenanceScheduler';
import { SparePartsInventory } from './SparePartsInventory';
import { 
  Wrench, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Plus, 
  UserCheck, 
  Shield, 
  Calendar, 
  Filter, 
  Zap,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Package,
  Layers,
  AlertTriangle,
  QrCode
} from 'lucide-react';

interface MaintenanceDashboardProps {
  workOrders: WorkOrder[];
  setWorkOrders: React.Dispatch<React.SetStateAction<WorkOrder[]>>;
  technicians: Technician[];
  assets?: Asset[];
  selectedAssetId?: string;
  onSelectAssetById: (assetId: string) => void;
  onSimulateIncident: (incidentType: string) => void;
  onCreateWorkOrder?: (wo: Partial<WorkOrder>) => void;
  onSimulatePredictiveAnomaly?: (assetId: string, anomalyType: 'thermal' | 'vibration' | 'normalize') => void;
  onOpenQRScanner?: () => void;
}

export const MaintenanceDashboard: React.FC<MaintenanceDashboardProps> = ({
  workOrders,
  setWorkOrders,
  technicians,
  assets = [],
  selectedAssetId,
  onSelectAssetById,
  onSimulateIncident,
  onCreateWorkOrder,
  onSimulatePredictiveAnomaly,
  onOpenQRScanner,
}) => {
  const [maintenanceTab, setMaintenanceTab] = useState<'all' | 'spare_parts' | 'pm_scheduler' | 'work_orders'>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedWoId, setExpandedWoId] = useState<string | null>('WO-4091');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New WO form state
  const [newTitle, setNewTitle] = useState('');
  const [newAsset, setNewAsset] = useState('conv-01');
  const [newPriority, setNewPriority] = useState<WorkOrderPriority>('medium');
  const [newCategory, setNewCategory] = useState<WorkOrder['category']>('Mechanical');
  const [newTechnician, setNewTechnician] = useState('Marcus Vance');

  const filteredOrders = workOrders.filter((wo) => {
    if (filterPriority !== 'all' && wo.priority !== filterPriority) return false;
    if (filterStatus !== 'all' && wo.status !== filterStatus) return false;
    return true;
  });

  const toggleStep = (woId: string, stepIndex: number) => {
    soundFx.playClick();
    setWorkOrders((prev) =>
      prev.map((wo) => {
        if (wo.id !== woId) return wo;
        const newSteps = [...wo.steps];
        newSteps[stepIndex] = {
          ...newSteps[stepIndex],
          completed: !newSteps[stepIndex].completed,
        };
        // If all completed, auto-mark completed
        const allDone = newSteps.every((s) => s.completed);
        return {
          ...wo,
          steps: newSteps,
          status: allDone ? 'completed' : wo.status,
        };
      })
    );
  };

  const handleCreateNewOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    soundFx.playSuccess();
    const newWo: WorkOrder = {
      id: `WO-${Math.floor(4120 + Math.random() * 50)}`,
      title: newTitle,
      assetId: newAsset,
      assetName: newAsset.includes('conv') ? 'Main High-Speed Conveyor' : newAsset.includes('arm') ? 'Robotic Arm 01' : 'AMR Unit 01',
      assetCode: newAsset.toUpperCase(),
      priority: newPriority,
      status: 'pending',
      assignedTechnician: newTechnician,
      technicianRole: 'Automation Specialist',
      category: newCategory,
      createdDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      estimatedHours: 2.0,
      description: 'Scheduled maintenance intervention created via operations console.',
      steps: [
        { text: 'Isolate machine power & lock-out tag-out (LOTO)', completed: false },
        { text: 'Perform mechanical / electronic sensor diagnostics', completed: false },
        { text: 'Execute recalibration test and close work order', completed: false },
      ],
    };

    setWorkOrders([newWo, ...workOrders]);
    setShowCreateModal(false);
    setNewTitle('');
  };

  return (
    <div className="space-y-6">
      {/* Predictive Insight Notification System: Proactive Maintenance Warning Banner */}
      <ProactiveMaintenanceBanner
        assets={assets}
        workOrders={workOrders}
        onSelectAssetById={onSelectAssetById}
        onCreateWorkOrder={(wo) => {
          if (onCreateWorkOrder) {
            onCreateWorkOrder(wo);
          } else {
            const fullWo: WorkOrder = {
              id: wo.id || `PM-${Math.floor(5200 + Math.random() * 80)}`,
              title: wo.title || 'Proactive Maintenance Work Order',
              assetId: wo.assetId || 'conv-01',
              assetName: wo.assetName || 'Conveyor Sorter CNV-01',
              assetCode: wo.assetCode || 'CNV-SORT-01',
              priority: wo.priority || 'high',
              status: wo.status || 'pending',
              assignedTechnician: wo.assignedTechnician || 'Sarah Chen',
              technicianRole: wo.technicianRole || 'Predictive Reliability Engineer',
              category: wo.category || 'Mechanical',
              createdDate: new Date().toISOString().split('T')[0],
              dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
              estimatedHours: wo.estimatedHours || 2.0,
              description: wo.description || 'Proactive work order dispatched from predictive insight analysis.',
              steps: wo.steps || [
                { text: 'Verify electrical isolation and LOTO', completed: false },
                { text: 'Perform diagnostic scan and lubrication', completed: false },
                { text: 'Verify recovery of healthScore above 90%', completed: false },
              ],
            };
            setWorkOrders((prev) => [fullWo, ...prev]);
          }
        }}
        onSimulatePredictiveAnomaly={onSimulatePredictiveAnomaly}
      />

      {/* Top Action Bar: Metrics & Incident Simulator Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Incident Fault Injection Quick Bar */}
        <div className="lg:col-span-2 bg-slate-900/90 rounded-2xl p-4 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h3 className="font-mono text-sm font-bold text-white tracking-wider">
                RAPID FAULT INJECTION & INCIDENT DRILLS
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              Live Digital Twin Response Test
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              onClick={() => onSimulateIncident('conveyor_bearing')}
              className="p-3 bg-slate-950/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-left transition-all group"
            >
              <div className="flex items-center justify-between text-xs font-mono font-bold text-amber-300 mb-1">
                <span>Conveyor Overheat</span>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2">
                Simulate roller bearing friction spike (&gt;75°C) on CNV-SORT-01.
              </p>
            </button>

            <button
              onClick={() => onSimulateIncident('amr_obstacle')}
              className="p-3 bg-slate-950/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-left transition-all group"
            >
              <div className="flex items-center justify-between text-xs font-mono font-bold text-blue-300 mb-1">
                <span>AMR LiDAR Stall</span>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2">
                Simulate dynamic path obstruction on AMR-NOV-02.
              </p>
            </button>

            <button
              onClick={() => onSimulateIncident('arm_pneumatic')}
              className="p-3 bg-slate-950/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-left transition-all group"
            >
              <div className="flex items-center justify-between text-xs font-mono font-bold text-rose-300 mb-1">
                <span>Arm Suction Drop</span>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2">
                Trigger vacuum loss on Robotic Pick Arm RA-PK-01.
              </p>
            </button>
          </div>
        </div>

        {/* Maintenance Compliance & MTTR Summary */}
        <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-mono text-sm font-bold text-slate-200 tracking-wider">
              PM COMPLIANCE
            </h3>
            <span className="text-xs font-mono text-emerald-400 font-bold">96.4%</span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between text-slate-300">
              <span>Mean Time To Repair (MTTR):</span>
              <span className="text-cyan-400 font-semibold">42 mins</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Preventive Tasks Completed:</span>
              <span className="text-emerald-400 font-semibold">18 / 19</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Next Major Overhaul:</span>
              <span className="text-amber-400 font-semibold">In 14 Days</span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => {
                soundFx.playClick();
                setShowCreateModal(true);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-semibold py-2 px-3 rounded-xl transition-all shadow-md active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Create Work Order</span>
            </button>

            {onOpenQRScanner && (
              <button
                id="maintenance-qr-scanner-btn"
                onClick={() => {
                  soundFx.playClick();
                  onOpenQRScanner();
                }}
                className="flex items-center justify-center gap-1.5 bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-500/50 text-cyan-300 font-mono text-xs font-semibold py-2 px-3 rounded-xl transition-all shadow-[0_0_12px_rgba(6,182,212,0.2)] active:scale-98"
                title="Scan QR Code to identify asset"
              >
                <QrCode className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">QR Scan</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sub-Navigation Ribbon for Maintenance Views */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-2 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950/90 rounded-xl border border-slate-800/80">
          <button
            onClick={() => {
              soundFx.playClick();
              setMaintenanceTab('all');
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              maintenanceTab === 'all'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Unified View</span>
          </button>

          <button
            onClick={() => {
              soundFx.playClick();
              setMaintenanceTab('spare_parts');
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              maintenanceTab === 'spare_parts'
                ? 'bg-gradient-to-r from-amber-600 to-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Spare Parts Inventory</span>
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500/30 text-rose-300 text-[10px] font-bold">
              Stock Radar
            </span>
          </button>

          <button
            onClick={() => {
              soundFx.playClick();
              setMaintenanceTab('pm_scheduler');
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              maintenanceTab === 'pm_scheduler'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>PM Runtime Scheduler</span>
          </button>

          <button
            onClick={() => {
              soundFx.playClick();
              setMaintenanceTab('work_orders');
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              maintenanceTab === 'work_orders'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Work Orders ({filteredOrders.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 px-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Parts Telemetry Sync: <strong className="text-white">Active</strong></span>
        </div>
      </div>

      {/* Spare Parts Inventory Tracking Component */}
      {(maintenanceTab === 'all' || maintenanceTab === 'spare_parts') && (
        <SparePartsInventory
          assets={assets}
          workOrders={workOrders}
          setWorkOrders={setWorkOrders}
          technicians={technicians}
          selectedAssetId={selectedAssetId}
          onSelectAssetById={onSelectAssetById}
        />
      )}

      {/* Recharts Predictive Maintenance Health Degradation Trend & PM Scheduler */}
      {(maintenanceTab === 'all' || maintenanceTab === 'pm_scheduler') && (
        <>
          {assets && assets.length > 0 && (
            <AssetPredictiveHealthTrend
              assets={assets}
              selectedAssetId={selectedAssetId}
              onSelectAsset={onSelectAssetById}
            />
          )}

          {assets && assets.length > 0 && (
            <PreventiveMaintenanceScheduler
              assets={assets}
              workOrders={workOrders}
              setWorkOrders={setWorkOrders}
              technicians={technicians}
              onSelectAssetById={onSelectAssetById}
            />
          )}
        </>
      )}

      {/* Main Work Orders List and Technician Roster */}
      {(maintenanceTab === 'all' || maintenanceTab === 'work_orders') && (
        <>
          <div className="bg-slate-900/90 rounded-2xl p-4 md:p-6 border border-slate-800 shadow-xl space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-cyan-400" />
            <h2 className="font-mono text-base font-bold text-white tracking-wider">
              MAINTENANCE WORK ORDERS & CHECKLISTS ({filteredOrders.length})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs font-mono text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs font-mono text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Orders Accordion Cards */}
        <div className="space-y-3">
          {filteredOrders.map((wo) => {
            const isExpanded = expandedWoId === wo.id;
            const completedCount = wo.steps.filter((s) => s.completed).length;

            return (
              <div
                key={wo.id}
                className="bg-slate-950/70 border border-slate-800/90 rounded-xl overflow-hidden transition-all hover:border-slate-700"
              >
                {/* Header Summary Row */}
                <div
                  onClick={() => {
                    soundFx.playClick();
                    setExpandedWoId(isExpanded ? null : wo.id);
                  }}
                  className="p-3.5 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-900/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded">
                      {wo.id}
                    </span>

                    <div>
                      <h4 className="font-mono text-sm font-bold text-white">
                        {wo.title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-0.5">
                        <span className="text-slate-300 font-semibold">{wo.assetName}</span>
                        <span>&bull;</span>
                        <span>Assigned: {wo.assignedTechnician}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {/* Priority Badge */}
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                        wo.priority === 'urgent'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : wo.priority === 'high'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      }`}
                    >
                      {wo.priority}
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                        wo.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : wo.status === 'in_progress'
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          : 'bg-slate-500/20 text-slate-300 border-slate-500/40'
                      }`}
                    >
                      {wo.status.replace('_', ' ')}
                    </span>

                    {/* Completed steps counter */}
                    <span className="text-xs font-mono text-slate-400 hidden sm:inline">
                      {completedCount}/{wo.steps.length} steps
                    </span>

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details & Checklist */}
                {isExpanded && (
                  <div className="p-4 border-t border-slate-800 bg-slate-900/40 space-y-3 animate-in fade-in">
                    <p className="text-xs text-slate-300 font-mono leading-relaxed">
                      {wo.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400 pt-1">
                      <div>Category: <span className="text-slate-200">{wo.category}</span></div>
                      <div>Due: <span className="text-slate-200">{wo.dueDate}</span></div>
                      <div>Est. Duration: <span className="text-slate-200">{wo.estimatedHours} hrs</span></div>
                      <button
                        onClick={() => onSelectAssetById(wo.assetId)}
                        className="text-cyan-400 hover:text-cyan-300 underline font-semibold flex items-center gap-1"
                      >
                        Inspect Machine in Digital Twin &rarr;
                      </button>
                    </div>

                    {/* Step-by-Step Task Checklist */}
                    <div className="pt-2">
                      <h5 className="font-mono text-xs font-bold text-slate-300 tracking-wider mb-2">
                        PROCEDURAL CHECKLIST
                      </h5>
                      <div className="space-y-2">
                        {wo.steps.map((step, idx) => (
                          <label
                            key={idx}
                            className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 cursor-pointer hover:border-cyan-500/50 transition-all text-xs font-mono"
                          >
                            <input
                              type="checkbox"
                              checked={step.completed}
                              onChange={() => toggleStep(wo.id, idx)}
                              className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                            />
                            <span
                              className={`${
                                step.completed ? 'line-through text-slate-500' : 'text-slate-200'
                              }`}
                            >
                              {step.text}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Technician Roster Section */}
      <div className="bg-slate-900/90 rounded-2xl p-4 md:p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-emerald-400" />
          <h2 className="font-mono text-base font-bold text-white tracking-wider">
            ON-SHIFT FIELD MAINTENANCE TECHNICIANS
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {technicians.map((tech) => (
            <div
              key={tech.id}
              className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/90 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white"
                      style={{ backgroundColor: tech.avatarColor }}
                    >
                      {tech.name[0]}
                    </div>
                    <div>
                      <h4 className="font-mono text-xs font-bold text-white">{tech.name}</h4>
                      <span className="text-[10px] font-mono text-slate-400 block">
                        {tech.specialty}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] font-mono space-y-1 text-slate-300 mt-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Completed Today:</span>
                    <span className="text-slate-200 font-semibold">{tech.completedTodayCount} tasks</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Safety Rating:</span>
                    <span className="text-emerald-400 font-semibold">{tech.safetyScore}%</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800 flex justify-between items-center">
                <span
                  className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                    tech.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : tech.status === 'dispatched'
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'bg-slate-500/20 text-slate-300'
                  }`}
                >
                  {tech.status}
                </span>
                <span className="text-[10px] font-mono text-slate-400">Shift A (07:00-15:30)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      </>
      )}

      {/* Modal: Create Work Order */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white tracking-wider">
                DISPATCH PREVENTIVE / CORRECTIVE WORK ORDER
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateNewOrder} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Work Order Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inspect motor commutator & check tension"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Target Asset</label>
                  <select
                    value={newAsset}
                    onChange={(e) => setNewAsset(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="conv-01">High-Speed Conveyor (CNV-SORT-01)</option>
                    <option value="arm-01">Robotic Arm 01 (RA-PK-01)</option>
                    <option value="arm-02">Robotic Arm 02 (RA-PK-02)</option>
                    <option value="amr-01">AMR Unit 01 (Echo)</option>
                    <option value="amr-02">AMR Unit 02 (Nova)</option>
                    <option value="dock-04">Loading Dock Bay 04</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as WorkOrderPriority)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Dispatched Tech</label>
                  <select
                    value={newTechnician}
                    onChange={(e) => setNewTechnician(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    {technicians.map((t) => (
                      <option key={t.id} value={t.name}>{t.name} ({t.specialty.split(' ')[0]})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as WorkOrder['category'])}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="Mechanical">Mechanical</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Hydraulics/Pneumatics">Hydraulics/Pneumatics</option>
                    <option value="Sensors/LiDAR">Sensors/LiDAR</option>
                    <option value="Software/Firmware">Software/Firmware</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Create & Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
