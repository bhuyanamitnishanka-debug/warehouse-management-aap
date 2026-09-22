/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AssetCategory = 'amr' | 'robotic_arm' | 'conveyor' | 'dock' | 'rack' | 'scanner';
export type AssetStatus = 'optimal' | 'warning' | 'critical' | 'maintenance';
export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'urgent';
export type WorkOrderStatus = 'pending' | 'in_progress' | 'completed';
export type WorkOrderCategory = 'Mechanical' | 'Electrical' | 'Hydraulics/Pneumatics' | 'Software/Firmware' | 'Sensors/LiDAR';

export interface AssetVitals {
  temperatureC: number;
  temperatureMax: number;
  vibrationRms: number; // mm/s
  vibrationMax: number;
  batteryPct?: number; // for AMRs
  speedMps?: number;
  loadKg?: number;
  maxLoadKg?: number;
  healthScore: number; // 0-100%
  operatingHours: number;
  cycleCount: number;
  firmwareVersion: string;
  lastServiceDate: string;
  nextScheduledService: string;
  mtbfHours: number;
}

export interface Asset {
  id: string;
  name: string;
  code: string;
  category: AssetCategory;
  zone: string;
  status: AssetStatus;
  vitals: AssetVitals;
  activeWorkOrderId?: string;
  activeFault?: string;
  description: string;
}

export interface PredictiveInsight {
  id: string;
  assetId: string;
  assetName: string;
  assetCode: string;
  severity: 'advisory' | 'warning';
  title: string;
  triggerCause: string;
  telemetrySummary: {
    healthScore: number;
    healthTrend: 'declining' | 'degraded';
    currentTemp: number;
    maxTemp: number;
    tempRatePerHour?: number;
    vibrationRms: number;
    vibrationMax: number;
    operationalState: string;
  };
  impactAnalysis: string;
  estimatedRulHours: number;
  recommendedAction: string;
  suggestedWorkOrder: {
    title: string;
    priority: WorkOrderPriority;
    category: WorkOrderCategory;
    description: string;
    estimatedHours: number;
    steps: { text: string; completed: boolean }[];
  };
  detectedAt: string;
  acknowledged?: boolean;
}

export interface AMRUnit extends Asset {
  category: 'amr';
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  rotation: number;
  carryingCargo: boolean;
  cargoType: 'crate' | 'tote' | 'none';
  cargoColor: string;
  cargoLabel: string;
  routeStep: number;
  waypoints: { x: number; y: number }[];
  state: 'transit' | 'loading' | 'unloading' | 'charging' | 'idle' | 'stopped';
}

export interface RoboticArmUnit extends Asset {
  category: 'robotic_arm';
  baseX: number;
  baseY: number;
  railX: number;
  railTargetX: number;
  joint1Angle: number;
  joint2Angle: number;
  joint3Angle: number;
  gripperState: 'open' | 'holding' | 'releasing';
  carryingBox: boolean;
  phase: 'idle' | 'reaching_rack' | 'gripping' | 'transferring' | 'releasing_amr';
  phaseTimer: number;
}

export interface ConveyorUnit extends Asset {
  category: 'conveyor';
  rollersActive: boolean;
  speedMpm: number; // meters per minute
  scannerActive: boolean;
  packagesScannedCount: number;
  lastScannedBarcode: string;
  jamSensorTriggered: boolean;
}

export interface LoadingDockUnit extends Asset {
  category: 'dock';
  dockNumber: number;
  truckPresent: boolean;
  truckLicense: string;
  carrier: string;
  progressPct: number;
  direction: 'inbound' | 'outbound';
  totalPallets: number;
  processedPallets: number;
}

export interface WorkOrder {
  id: string;
  title: string;
  assetId: string;
  assetName: string;
  assetCode: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assignedTechnician: string;
  technicianRole: string;
  category: 'Mechanical' | 'Electrical' | 'Hydraulics/Pneumatics' | 'Software/Firmware' | 'Sensors/LiDAR';
  createdDate: string;
  dueDate: string;
  estimatedHours: number;
  description: string;
  steps: { text: string; completed: boolean }[];
}

export interface Technician {
  id: string;
  name: string;
  specialty: string;
  role: string;
  shift: string;
  shiftStartHour: number;
  shiftEndHour: number;
  shiftHoursLogged: number;
  shiftMaxHours: number;
  assignedStationZone: string;
  status: 'active' | 'dispatched' | 'standby' | 'on_break';
  currentAssetId?: string;
  completedTodayCount: number;
  safetyScore: number;
  efficiencyRating: number;
  certifications: string[];
  contactRadioChannel?: string;
  avatarColor: string;
}

export interface WarehouseMetrics {
  oee: number; // Overall Equipment Effectiveness %
  availability: number; // %
  performance: number; // %
  qualityRate: number; // %
  activeAMRCount: number;
  totalAMRCount: number;
  packagesProcessedToday: number;
  inboundPerHour: number;
  outboundPerHour: number;
  activeAlarmsCount: number;
  pendingWorkOrdersCount: number;
  preventiveCompliancePct: number;
  energyDrawKW: number;
}

export type ViewMode = 'prototype' | 'maintenance' | 'labor' | 'tablet_hud' | 'fleet_amr';

export interface SparePart {
  id: string;
  partNumber: string;
  name: string;
  category: 'Mechanical' | 'Electrical' | 'Sensors/LiDAR' | 'Hydraulics/Pneumatics' | 'Wear Items';
  compatibleAssetIds: string[];
  compatibleAssetCodes: string[];
  compatibleCategory: AssetCategory;
  quantityOnHand: number;
  reorderPoint: number;
  safetyStock: number;
  maxCapacity: number;
  unitCostUSD: number;
  leadTimeDays: number;
  supplier: string;
  storageBin: string;
  unitOfMeasure: string;
  lastRestockedDate: string;
  burnRatePerMonth: number;
  criticality: 'critical' | 'high' | 'standard';
  description: string;
}
