/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Asset, SparePart, WorkOrder, Technician, WorkOrderPriority } from '../types';
import { INITIAL_SPARE_PARTS } from '../data/sparePartsData';
import { soundFx } from '../utils/audio';
import {
  Package,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Search,
  Filter,
  Plus,
  Minus,
  ShoppingCart,
  Truck,
  Wrench,
  MapPin,
  DollarSign,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  ChevronDown,
  Layers,
  RotateCcw
} from 'lucide-react';

interface SparePartsInventoryProps {
  assets: Asset[];
  workOrders: WorkOrder[];
  setWorkOrders: React.Dispatch<React.SetStateAction<WorkOrder[]>>;
  technicians: Technician[];
  selectedAssetId?: string;
  onSelectAssetById?: (assetId: string) => void;
}

export const SparePartsInventory: React.FC<SparePartsInventoryProps> = ({
  assets,
  workOrders,
  setWorkOrders,
  technicians,
  selectedAssetId,
  onSelectAssetById,
}) => {
  // Inventory state
  const [parts, setParts] = useState<SparePart[]>(INITIAL_SPARE_PARTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'alert_only' | 'optimal'>('all');
  const [filterAssetId, setFilterAssetId] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // If selectedAssetId changes and is provided, optionally highlight or pre-filter
  const activeSelectedAsset = useMemo(() => {
    return assets.find((a) => a.id === selectedAssetId);
  }, [assets, selectedAssetId]);

  // Derived calculations: Alerts
  const alertParts = useMemo(() => {
    return parts.filter((part) => part.quantityOnHand <= part.reorderPoint);
  }, [parts]);

  // Filtered Parts
  const filteredParts = useMemo(() => {
    return parts.filter((part) => {
      // Status filter
      if (filterStatus === 'alert_only' && part.quantityOnHand > part.reorderPoint) {
        return false;
      }
      if (filterStatus === 'optimal' && part.quantityOnHand <= part.reorderPoint) {
        return false;
      }

      // Category filter
      if (filterCategory !== 'all' && part.category !== filterCategory) {
        return false;
      }

      // Asset filter
      if (filterAssetId !== 'all' && !part.compatibleAssetIds.includes(filterAssetId)) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = part.name.toLowerCase().includes(q);
        const matchesPartNum = part.partNumber.toLowerCase().includes(q);
        const matchesBin = part.storageBin.toLowerCase().includes(q);
        const matchesSupplier = part.supplier.toLowerCase().includes(q);
        const matchesAsset = part.compatibleAssetCodes.some((c) => c.toLowerCase().includes(q));
        if (!matchesName && !matchesPartNum && !matchesBin && !matchesSupplier && !matchesAsset) {
          return false;
        }
      }

      return true;
    });
  }, [parts, filterStatus, filterCategory, filterAssetId, searchQuery]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const totalCount = parts.length;
    const criticalAlertsCount = alertParts.length;
    const totalValuation = parts.reduce(
      (acc, item) => acc + item.quantityOnHand * item.unitCostUSD,
      0
    );
    const avgLeadTime = Math.round(
      parts.reduce((acc, item) => acc + item.leadTimeDays, 0) / (parts.length || 1)
    );

    return {
      totalCount,
      criticalAlertsCount,
      totalValuation,
      avgLeadTime,
    };
  }, [parts, alertParts]);

  // Show Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Adjust stock count manually (+1 / -1)
  const handleAdjustStock = (partId: string, delta: number) => {
    setParts((prev) =>
      prev.map((item) => {
        if (item.id === partId) {
          const newQty = Math.max(0, Math.min(item.maxCapacity, item.quantityOnHand + delta));
          if (delta > 0) soundFx.playSuccess();
          else soundFx.playClick();
          return {
            ...item,
            quantityOnHand: newQty,
          };
        }
        return item;
      })
    );
  };

  // Restock specific part to full capacity
  const handleRestockPart = (part: SparePart) => {
    soundFx.playSuccess();
    const restockQty = Math.max(part.reorderPoint * 2, part.maxCapacity - part.quantityOnHand);
    const newQty = Math.min(part.maxCapacity, part.quantityOnHand + restockQty);

    setParts((prev) =>
      prev.map((item) => {
        if (item.id === part.id) {
          return {
            ...item,
            quantityOnHand: newQty,
            lastRestockedDate: new Date().toISOString().split('T')[0],
          };
        }
        return item;
      })
    );

    showToast(`Restocked ${part.name} (+${restockQty} ${part.unitOfMeasure}). Current inventory: ${newQty}.`);
  };

  // Batch PO: Reorder all parts currently below reorder point
  const handleBatchReorderAll = () => {
    if (alertParts.length === 0) {
      showToast('All spare parts have healthy inventory levels above their reorder point!');
      return;
    }

    soundFx.playSuccess();
    let totalItemsAdded = 0;

    setParts((prev) =>
      prev.map((item) => {
        if (item.quantityOnHand <= item.reorderPoint) {
          const delta = item.maxCapacity - item.quantityOnHand;
          totalItemsAdded += delta;
          return {
            ...item,
            quantityOnHand: item.maxCapacity,
            lastRestockedDate: new Date().toISOString().split('T')[0],
          };
        }
        return item;
      })
    );

    showToast(
      `Dispatched Automated Purchase Orders for ${alertParts.length} critical components (+${totalItemsAdded} units replenished)!`
    );
  };

  // Create Work Order using this specific replacement part
  const handleCreateWorkOrderWithPart = (part: SparePart) => {
    soundFx.playSuccess();
    const primaryAssetId = part.compatibleAssetIds[0] || 'conv-01';
    const primaryAssetCode = part.compatibleAssetCodes[0] || 'CNV-SORT-01';
    const linkedAsset = assets.find((a) => a.id === primaryAssetId);

    const assignedTech =
      technicians.find((t) => t.assignedStationZone.toLowerCase().includes(part.compatibleCategory))?.name ||
      technicians[0]?.name ||
      'Marcus Vance';

    const newPriority: WorkOrderPriority =
      part.criticality === 'critical' ? 'urgent' : part.criticality === 'high' ? 'high' : 'medium';

    const newWo: WorkOrder = {
      id: `WO-${Math.floor(4160 + Math.random() * 80)}`,
      title: `[PARTS REPLACEMENT] ${primaryAssetCode}: Install ${part.name}`,
      assetId: primaryAssetId,
      assetName: linkedAsset?.name || primaryAssetCode,
      assetCode: primaryAssetCode,
      priority: newPriority,
      status: 'pending',
      assignedTechnician: assignedTech,
      technicianRole: 'Mechanical/Reliability Specialist',
      category: part.category === 'Wear Items' ? 'Mechanical' : part.category,
      createdDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      estimatedHours: 1.5,
      description: `Replace worn/fatigued component with genuine spare part (${part.partNumber}, stored at ${part.storageBin}). Current inventory on hand: ${part.quantityOnHand} ${part.unitOfMeasure}.`,
      steps: [
        { text: `Obtain 1x ${part.partNumber} from inventory storage ${part.storageBin}`, completed: false },
        { text: `Perform LOTO electrical & mechanical isolation on ${primaryAssetCode}`, completed: false },
        { text: `Remove defective component and inspect mounting surface for wear/scoring`, completed: false },
        { text: `Torque ${part.name} to manufacturer factory specifications`, completed: false },
        { text: `Conduct dynamic sensor/speed test and log inventory deduction`, completed: false },
      ],
    };

    // Deduct 1 unit from stock if available
    if (part.quantityOnHand > 0) {
      handleAdjustStock(part.id, -1);
    }

    setWorkOrders((prev) => [newWo, ...prev]);
    showToast(
      `Generated Work Order ${newWo.id} for ${primaryAssetCode} and allocated 1x ${part.partNumber}!`
    );
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl p-4 md:p-6 border border-slate-800 shadow-xl space-y-5 font-mono">
      {/* Header and Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-cyan-400 border border-blue-500/20">
              <Package className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-white tracking-wider">
              SPARE PARTS INVENTORY &amp; REORDER RADAR
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              ASSET TELEMETRY SYNCED
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time stock level monitoring for critical mechanical and sensory components with automated reorder trigger alerts.
          </p>
        </div>

        {/* Global Action: Batch PO */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleBatchReorderAll}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
              alertParts.length > 0
                ? 'bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)] animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Generate Reorder PO for All Low Stock</span>
            {alertParts.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[10px] font-bold">
                {alertParts.length} Alerts
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Toast Alert Message */}
      {toastMessage && (
        <div className="bg-gradient-to-r from-emerald-950/90 to-cyan-950/90 border border-emerald-500/50 p-3 rounded-xl flex items-center justify-between text-emerald-200 text-xs shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white text-[11px] px-1.5"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Focused Asset Alert Banner (if user selected an asset from the digital twin) */}
      {activeSelectedAsset && (
        <div className="bg-blue-950/40 border border-blue-500/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="p-1 rounded bg-blue-500/20 text-cyan-300">
              <Layers className="w-3.5 h-3.5" />
            </span>
            <span className="text-slate-300">
              Active Digital Twin Focus:{' '}
              <strong className="text-white font-bold">{activeSelectedAsset.code}</strong> (
              {activeSelectedAsset.name})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundFx.playClick();
                setFilterAssetId(activeSelectedAsset.id);
              }}
              className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors"
            >
              Filter Parts for {activeSelectedAsset.code}
            </button>
            {filterAssetId === activeSelectedAsset.id && (
              <button
                onClick={() => {
                  soundFx.playClick();
                  setFilterAssetId('all');
                }}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4 Analytical KPI Metric Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Tracked SKUs */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 shadow-inner">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>TRACKED SKUs</span>
            <Package className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-white">{metrics.totalCount}</span>
            <span className="text-xs text-slate-400">components</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Conveyors, AMRs, Robots, Docks</p>
        </div>

        {/* Critical Shortages / Below Reorder Point */}
        <div
          className={`rounded-xl p-3 border shadow-inner ${
            metrics.criticalAlertsCount > 0
              ? 'bg-rose-950/30 border-rose-800/80 text-rose-300'
              : 'bg-slate-950/80 border-slate-800 text-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="font-bold">BELOW REORDER POINT</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-white">{metrics.criticalAlertsCount}</span>
            <span className="text-xs text-rose-400">parts under minimum</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Immediate procurement required</p>
        </div>

        {/* Total Inventory Valuation */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 shadow-inner">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>INVENTORY VALUATION</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-emerald-400">
              ${metrics.totalValuation.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs text-slate-400">USD</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">On-hand warehouse stock value</p>
        </div>

        {/* Avg Supplier Lead Time */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 shadow-inner">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>AVG LEAD TIME</span>
            <Truck className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-amber-300">{metrics.avgLeadTime}</span>
            <span className="text-xs text-slate-400">days delivery</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">OEM procurement pipeline</p>
        </div>
      </div>

      {/* Critical Alerts Banner Box (if any part is below reorder point) */}
      {alertParts.length > 0 && (
        <div className="bg-rose-950/20 border border-rose-800/80 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
              <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
              <span>CRITICAL INVENTORY REORDER ALERTS ({alertParts.length} ITEMS AT RISK)</span>
            </div>
            <span className="text-[10px] text-slate-400">
              Threshold: Stock &le; Reorder Point
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {alertParts.map((item) => (
              <div
                key={item.id}
                className="bg-slate-950/90 border border-rose-900/60 p-2.5 rounded-lg flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white truncate">{item.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                    <span className="text-rose-400 font-bold">
                      {item.quantityOnHand} {item.unitOfMeasure} left
                    </span>
                    <span>(Reorder: {item.reorderPoint})</span>
                    <span className="text-slate-500">&bull; {item.storageBin}</span>
                  </div>
                  <div className="text-[10px] text-cyan-300 truncate mt-0.5">
                    For: {item.compatibleAssetCodes.join(', ')}
                  </div>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => handleRestockPart(item)}
                    className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded shadow transition-all active:scale-95"
                    title="Generate Rapid Restock Purchase Order"
                  >
                    Quick PO
                  </button>
                  <button
                    onClick={() => handleCreateWorkOrderWithPart(item)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold rounded border border-slate-700 transition-all"
                    title="Create Work Order using this part"
                  >
                    + WO
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800/90">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search part name, SKU, bin (e.g. bearing, sensor, SKF)..."
            className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              soundFx.playClick();
              setFilterStatus('all');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              filterStatus === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All ({parts.length})
          </button>
          <button
            onClick={() => {
              soundFx.playClick();
              setFilterStatus('alert_only');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              filterStatus === 'alert_only'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-900 text-rose-400 hover:text-rose-300 border border-slate-800'
            }`}
          >
            Below Reorder ({alertParts.length})
          </button>
          <button
            onClick={() => {
              soundFx.playClick();
              setFilterStatus('optimal');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              filterStatus === 'optimal'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 text-emerald-400 hover:text-emerald-300 border border-slate-800'
            }`}
          >
            Healthy ({parts.length - alertParts.length})
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-1.5">
          <select
            value={filterCategory}
            onChange={(e) => {
              soundFx.playClick();
              setFilterCategory(e.target.value);
            }}
            className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Categories</option>
            <option value="Mechanical">Mechanical</option>
            <option value="Sensors/LiDAR">Sensors &amp; LiDAR</option>
            <option value="Wear Items">Wear Items &amp; Suction</option>
            <option value="Electrical">Electrical &amp; Batteries</option>
            <option value="Hydraulics/Pneumatics">Hydraulics &amp; Seals</option>
          </select>
        </div>

        {/* Asset Linkage Filter */}
        <div className="flex items-center gap-1.5">
          <select
            value={filterAssetId}
            onChange={(e) => {
              soundFx.playClick();
              setFilterAssetId(e.target.value);
            }}
            className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Linked Assets</option>
            <option value="conv-01">CNV-SORT-01 (Conveyor)</option>
            <option value="arm-01">RA-PK-01 (Robotic Arm 01)</option>
            <option value="arm-02">RA-PK-02 (Robotic Arm 02)</option>
            <option value="amr-01">AMR-ECH-01</option>
            <option value="amr-02">AMR-NOV-02</option>
            <option value="amr-03">AMR-BLT-03</option>
            <option value="amr-04">AMR-TTN-04</option>
            <option value="dock-04">DCK-BAY-04 (Dock 04)</option>
            <option value="dock-05">DCK-BAY-05 (Dock 05)</option>
          </select>
        </div>
      </div>

      {/* Main Parts Catalog Grid */}
      <div className="space-y-3">
        {filteredParts.length === 0 ? (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-8 text-center space-y-2">
            <Package className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-300 font-bold">No Spare Parts Match Criteria</p>
            <p className="text-xs text-slate-500">
              Try adjusting your search query, equipment category, or reset the filters.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterCategory('all');
                setFilterStatus('all');
                setFilterAssetId('all');
              }}
              className="mt-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          </div>
        ) : (
          filteredParts.map((part) => {
            const isBelowReorder = part.quantityOnHand <= part.reorderPoint;
            const stockPct = Math.min(100, Math.round((part.quantityOnHand / part.maxCapacity) * 100));
            const reorderMarkerPct = Math.min(100, Math.round((part.reorderPoint / part.maxCapacity) * 100));

            return (
              <div
                key={part.id}
                className={`rounded-xl border transition-all ${
                  isBelowReorder
                    ? 'bg-rose-950/20 border-rose-800/80 hover:border-rose-700'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Identity and Details */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        isBelowReorder
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                          : 'bg-blue-500/10 text-cyan-400 border-blue-500/20'
                      }`}
                    >
                      <Package className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-bold text-white text-sm tracking-wide">
                          {part.name}
                        </span>
                        <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">
                          {part.partNumber}
                        </span>
                        {/* Status Alert Badge */}
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            isBelowReorder
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {isBelowReorder ? 'BELOW REORDER POINT' : 'OPTIMAL STOCK'}
                        </span>
                        {/* Category */}
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {part.category}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-1 mb-1.5">
                        {part.description}
                      </p>

                      {/* Linked Equipment Badge List */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                        <span className="text-slate-500">Compatible Assets:</span>
                        {part.compatibleAssetCodes.map((code, idx) => {
                          const assetId = part.compatibleAssetIds[idx];
                          return (
                            <button
                              key={code}
                              onClick={() => {
                                if (onSelectAssetById && assetId) {
                                  soundFx.playClick();
                                  onSelectAssetById(assetId);
                                }
                              }}
                              className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 hover:border-cyan-500/50 transition-colors flex items-center gap-1"
                              title={`Inspect telemetry for ${code}`}
                            >
                              <span>{code}</span>
                              <ArrowRight className="w-2.5 h-2.5 opacity-60" />
                            </button>
                          );
                        })}
                        <span className="text-slate-600">&bull;</span>
                        <span className="flex items-center gap-1 text-slate-400">
                          <MapPin className="w-3 h-3 text-amber-400" />
                          Bin: <strong className="text-white">{part.storageBin}</strong>
                        </span>
                        <span className="text-slate-600">&bull;</span>
                        <span className="text-slate-400">
                          Supplier: <strong className="text-slate-300">{part.supplier}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Center: Stock Level Gauge and Reorder Threshold */}
                  <div className="w-full lg:w-72 shrink-0 space-y-1.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        On Hand: <strong className="text-white text-sm">{part.quantityOnHand}</strong>{' '}
                        {part.unitOfMeasure}
                      </span>
                      <span className="text-xs text-slate-400">
                        Reorder: <strong className="text-amber-400">{part.reorderPoint}</strong> / Max{' '}
                        {part.maxCapacity}
                      </span>
                    </div>

                    {/* Gauge with Reorder Marker */}
                    <div className="relative w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                      <div
                        style={{ width: `${stockPct}%` }}
                        className={`h-full rounded-full transition-all duration-300 ${
                          isBelowReorder
                            ? 'bg-gradient-to-r from-rose-600 to-rose-500'
                            : 'bg-gradient-to-r from-cyan-600 to-emerald-500'
                        }`}
                      />
                      {/* Vertical Reorder Line */}
                      <div
                        style={{ left: `${reorderMarkerPct}%` }}
                        className="absolute top-0 bottom-0 w-0.5 bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]"
                        title={`Reorder Point: ${part.reorderPoint}`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 text-slate-300">
                        <DollarSign className="w-3 h-3 text-emerald-400" />
                        ${part.unitCostUSD.toFixed(2)} / {part.unitOfMeasure}
                      </span>
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        Lead: {part.leadTimeDays}d
                      </span>
                    </div>
                  </div>

                  {/* Right: Quick Inventory Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Manual Inc/Dec Qty */}
                    <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                      <button
                        onClick={() => handleAdjustStock(part.id, -1)}
                        disabled={part.quantityOnHand <= 0}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Consume 1 unit (deduct)"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2 text-xs font-bold text-white min-w-[24px] text-center">
                        {part.quantityOnHand}
                      </span>
                      <button
                        onClick={() => handleAdjustStock(part.id, 1)}
                        disabled={part.quantityOnHand >= part.maxCapacity}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Add 1 unit to stock"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Restock PO Action */}
                    <button
                      onClick={() => handleRestockPart(part)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow active:scale-95"
                      title="Issue purchase order restock for this part"
                    >
                      <ShoppingCart className="w-3 h-3" />
                      <span>Restock</span>
                    </button>

                    {/* Create Work Order with Part */}
                    <button
                      onClick={() => handleCreateWorkOrderWithPart(part)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold border border-slate-700 transition-all active:scale-95"
                      title="Generate a work order on the linked asset with this part"
                    >
                      <Wrench className="w-3 h-3 text-cyan-400" />
                      <span>+ WO</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
