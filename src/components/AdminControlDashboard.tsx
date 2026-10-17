import React, { useState } from "react";
import {
  AuditLogEntry,
  ControlRoomSummary,
  EmergencyRequest,
  Hospital,
  MissingPerson,
  MissingPersonMatchNotification,
  RescueTeam,
  RescueUnitType,
  RoadBlock,
  Shelter,
} from "../types";
import { DisasterMap } from "./DisasterMap";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  Flame,
  HeartHandshake,
  Layers,
  MapPin,
  PhoneCall,
  Play,
  PlusCircle,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  Sliders,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { soundManager } from "../utils/audioAlert";

interface AdminControlDashboardProps {
  summary: ControlRoomSummary;
  requests: EmergencyRequest[];
  teams: RescueTeam[];
  hospitals: Hospital[];
  shelters: Shelter[];
  roadBlocks: RoadBlock[];
  auditLogs: AuditLogEntry[];
  missingPersons?: MissingPerson[];
  notifications?: MissingPersonMatchNotification[];
  onApproveAssignment: (requestId: string) => Promise<void>;
  onReassignTask: (requestId: string, newTeamId: string, reason: string) => Promise<void>;
  onClearRoadblock: (blockId: string) => Promise<void>;
  onTriggerReassessment: (reason: string) => Promise<void>;
  onTriggerSimulation: (type: "sos" | "roadblock" | "team_offline") => Promise<void>;
  onRegisterTeam?: (data: {
    name: string;
    unitType: RescueUnitType;
    leader: string;
    contact: string;
    vehicleType: string;
  }) => Promise<RescueTeam>;
  onMarkNotificationRead?: (id: string) => Promise<void>;
}

export const AdminControlDashboard: React.FC<AdminControlDashboardProps> = ({
  summary,
  requests,
  teams,
  hospitals,
  shelters,
  roadBlocks,
  auditLogs,
  missingPersons = [],
  notifications = [],
  onApproveAssignment,
  onReassignTask,
  onClearRoadblock,
  onTriggerReassessment,
  onTriggerSimulation,
  onRegisterTeam,
  onMarkNotificationRead,
}) => {
  const [activeTab, setActiveTab] = useState<
    "queue" | "map" | "teams" | "missing" | "reunions" | "roadblocks" | "logs"
  >("queue");
  const [selectedIncident, setSelectedIncident] = useState<EmergencyRequest | null>(
    requests.length > 0 ? requests[0] : null
  );
  const [reassignModalReqId, setReassignModalReqId] = useState<string | null>(null);
  const [targetTeamId, setTargetTeamId] = useState<string>(teams.length > 0 ? teams[0].id : "");
  const [reassignReason, setReassignReason] = useState<string>("");
  const [isReevaluating, setIsReevaluating] = useState(false);

  // New Team Modal state
  const [showRegisterTeamModal, setShowRegisterTeamModal] = useState(false);
  const [regTeamName, setRegTeamName] = useState("");
  const [regUnitType, setRegUnitType] = useState<RescueUnitType>("NDRF");
  const [regLeader, setRegLeader] = useState("");
  const [regContact, setRegContact] = useState("+1 (555) 019-4829");
  const [regVehicle, setRegVehicle] = useState("NDRF Specialized Heavy Transport");
  const [isRegistering, setIsRegistering] = useState(false);

  // Missing Persons Filter state
  const [mpSearch, setMpSearch] = useState("");
  const [mpFilterStatus, setMpFilterStatus] = useState<"all" | "missing" | "found">("all");

  // Team Filter state
  const [teamTypeFilter, setTeamTypeFilter] = useState<string>("all");

  // Filter requests
  const activeRequests = requests
    .filter((r) => r.status !== "completed" && r.status !== "cancelled")
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const sosCount = activeRequests.filter((r) => r.isSOS).length;

  const handleApprove = async (id: string) => {
    soundManager.playChime("success");
    await onApproveAssignment(id);
  };

  const handleConfirmReassign = async () => {
    if (!reassignModalReqId || !targetTeamId || !reassignReason) return;
    soundManager.playChime("warning");
    await onReassignTask(reassignModalReqId, targetTeamId, reassignReason);
    setReassignModalReqId(null);
    setReassignReason("");
  };

  const handleManualReassessment = async () => {
    setIsReevaluating(true);
    soundManager.playChime("warning");
    try {
      await onTriggerReassessment("Manual Control Room Commander Evaluation Request");
    } finally {
      setIsReevaluating(false);
    }
  };

  const handleRegisterTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regTeamName.trim() || !regLeader.trim()) return;
    setIsRegistering(true);
    try {
      if (onRegisterTeam) {
        await onRegisterTeam({
          name: regTeamName.trim(),
          unitType: regUnitType,
          leader: regLeader.trim(),
          contact: regContact.trim() || "+1 (555) 019-0000",
          vehicleType: regVehicle.trim() || "Emergency Tactical Transport",
        });
        soundManager.playChime("success");
      }
      setRegTeamName("");
      setRegLeader("");
      setShowRegisterTeamModal(false);
    } finally {
      setIsRegistering(false);
    }
  };

  const onlineUnitsCount = summary.activeOnlineUnitsCount ?? teams.filter((t) => t.isOnline !== false).length;
  const onlineUnitsByType = summary.onlineUnitsByType ?? {
    NDRF: teams.filter((t) => t.unitType === "NDRF").length,
    Paramedic: teams.filter((t) => t.unitType === "Paramedic").length,
    "Fire & Hazmat": teams.filter((t) => t.unitType === "Fire & Hazmat").length,
    "Water Rescue": teams.filter((t) => t.unitType === "Water Rescue").length,
    "Quick Reaction Team": teams.filter((t) => t.unitType === "Quick Reaction Team").length,
    "Army/Military Support": teams.filter((t) => t.unitType === "Army/Military Support").length,
  };

  const filteredTeams = teams.filter((t) => {
    if (teamTypeFilter === "all") return true;
    return t.unitType === teamTypeFilter;
  });

  const filteredMissingPersons = missingPersons.filter((mp) => {
    const isMatched = mp.matchStatus === "matched" || mp.status === "located_in_shelter" || mp.status === "reunited";
    if (mpFilterStatus === "missing" && isMatched) return false;
    if (mpFilterStatus === "found" && !isMatched) return false;
    if (!mpSearch) return true;
    const q = mpSearch.toLowerCase();
    const pName = (mp.fullName || mp.name || "").toLowerCase();
    const pLoc = (mp.lastSeenLocation || "").toLowerCase();
    const pMarks = (mp.identificationMarks || "").toLowerCase();
    return pName.includes(q) || pLoc.includes(q) || pMarks.includes(q);
  });

  const matchedMissingCount = missingPersons.filter(
    (m) => m.matchStatus === "matched" || m.status === "located_in_shelter" || m.status === "reunited"
  ).length;

  return (
    <div id="admin-control-dashboard-container" className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Top Match Notification Banner (Requirement 3) */}
      {notifications.length > 0 && notifications.some((n) => !n.read) && (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border-2 border-emerald-500/60 p-4 rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl shrink-0">
              🎉
            </div>
            <div>
              <div className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <span>Shelter Cross-Match Alert</span>
                <span className="bg-emerald-500/20 px-2 py-0.5 rounded text-[10px] text-emerald-300">
                  Citizen Notified
                </span>
              </div>
              <p className="text-xs text-slate-200 mt-0.5">
                <strong>{notifications[0].missingPersonName}</strong> was identified and matched at{" "}
                <strong>{notifications[0].shelterName}</strong>! Condition:{" "}
                <span className="text-emerald-400 font-bold">
                  {notifications[0].physicalCondition}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => setActiveTab("reunions")}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5"
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              View Matches ({notifications.length})
            </button>
            {onMarkNotificationRead && (
              <button
                onClick={() => onMarkNotificationRead(notifications[0].id)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Banner with Authority Control Room Identity & Simulation Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-700 flex items-center justify-center text-white text-2xl shadow-lg shadow-red-600/30">
            <Radio className="w-7 h-7 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold text-red-400">
                Central Disaster Command
              </span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-500/40">
                Live AI Triage Online
              </span>
            </div>
            <h1 className="text-2xl font-black text-white">Authority Control Room & AI Triage</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated weighted scoring, dynamic resource reallocation, and missing persons tracking.
            </p>
          </div>
        </div>

        {/* Dynamic Simulation / Testing Tools */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-800 w-full lg:w-auto">
          <span className="text-[10px] uppercase font-bold text-slate-400 px-2">
            Chaos Simulation:
          </span>
          <button
            onClick={() => onTriggerSimulation("sos")}
            className="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
            +Simulate SOS
          </button>
          <button
            onClick={() => onTriggerSimulation("roadblock")}
            className="px-3 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>🚧</span>
            +Road Block
          </button>
          <button
            onClick={() => onTriggerSimulation("team_offline")}
            className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Truck className="w-3.5 h-3.5 text-purple-400" />
            +Team Drop
          </button>
          <button
            onClick={handleManualReassessment}
            disabled={isReevaluating}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReevaluating ? "animate-spin" : ""}`} />
            Force Reassessment Loop
          </button>
        </div>
      </div>

      {/* Situational Overview KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col">
          <span className="text-[10px] uppercase font-bold text-slate-400">Total Affected</span>
          <div className="text-2xl font-black text-white mt-1">{summary.totalPeopleAffected}</div>
          <span className="text-[10px] text-slate-500 mt-0.5">Citizens in peril</span>
        </div>

        <div className="bg-slate-900 border border-red-500/40 p-4 rounded-2xl flex flex-col bg-red-950/20">
          <span className="text-[10px] uppercase font-bold text-red-400 flex items-center gap-1">
            <AlertOctagon className="w-3.5 h-3.5" /> SOS Alerts
          </span>
          <div className="text-2xl font-black text-red-400 mt-1">{sosCount}</div>
          <span className="text-[10px] text-red-300 mt-0.5">High threat distress</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col">
          <span className="text-[10px] uppercase font-bold text-amber-400">Vulnerable Count</span>
          <div className="text-2xl font-black text-amber-400 mt-1">
            {summary.totalVulnerable ?? summary.totalVulnerablePeople ?? 0}
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5">Injured, kids, elderly</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col">
          <span className="text-[10px] uppercase font-bold text-slate-400">Active Incidents</span>
          <div className="text-2xl font-black text-white mt-1">{activeRequests.length}</div>
          <span className="text-[10px] text-slate-500 mt-0.5">Pending or assigned</span>
        </div>

        {/* Dynamic Online Units KPI (Requirement 4) */}
        <div className="bg-slate-900 border border-emerald-500/40 p-4 rounded-2xl flex flex-col bg-emerald-950/10">
          <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
            <Truck className="w-3.5 h-3.5" /> Online Units
          </span>
          <div className="text-2xl font-black text-emerald-400 mt-1">
            {onlineUnitsCount} / {teams.length}
          </div>
          <span className="text-[10px] text-emerald-300/80 mt-0.5">
            NDRF: {onlineUnitsByType["NDRF"] || 0} • Med: {onlineUnitsByType["Paramedic"] || 0}
          </span>
        </div>

        {/* Missing Persons Tracker KPI (Requirement 2) */}
        <div className="bg-slate-900 border border-teal-500/40 p-4 rounded-2xl flex flex-col bg-teal-950/10">
          <span className="text-[10px] uppercase font-bold text-teal-400 flex items-center gap-1">
            <Search className="w-3.5 h-3.5" /> Missing Persons
          </span>
          <div className="text-2xl font-black text-teal-400 mt-1">{missingPersons.length}</div>
          <span className="text-[10px] text-teal-300 mt-0.5">
            {matchedMissingCount} found in shelters
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col">
          <span className="text-[10px] uppercase font-bold text-blue-400">Hospital Beds</span>
          <div className="text-2xl font-black text-blue-400 mt-1">
            {summary.hospitalBedsFree ?? summary.totalHospitalBedsAvailable ?? 0}
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5">Trauma vacancies</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col">
          <span className="text-[10px] uppercase font-bold text-indigo-400">Shelter Vacancies</span>
          <div className="text-2xl font-black text-indigo-400 mt-1">
            {summary.shelterVacancies ?? summary.totalShelterVacancies ?? 0}
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5">Relief beds</span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
        <button
          onClick={() => setActiveTab("queue")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition ${
            activeTab === "queue"
              ? "bg-red-600 text-white shadow-md shadow-red-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Flame className="w-4 h-4" />
          AI Incident Priority Queue ({activeRequests.length})
        </button>

        <button
          onClick={() => setActiveTab("map")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition ${
            activeTab === "map"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Layers className="w-4 h-4" />
          Live Tactical Disaster Map
        </button>

        <button
          onClick={() => setActiveTab("teams")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition ${
            activeTab === "teams"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Truck className="w-4 h-4" />
          Fleet & Rescue Squad Tracker ({teams.length})
        </button>

        {/* Missing Persons Feed (Requirement 2) */}
        <button
          onClick={() => setActiveTab("missing")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition ${
            activeTab === "missing"
              ? "bg-teal-600 text-white shadow-md shadow-teal-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Search className="w-4 h-4" />
          Missing Persons Feed ({missingPersons.length})
        </button>

        {/* Missing Person Match Reunions (Requirement 3) */}
        <button
          onClick={() => setActiveTab("reunions")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition ${
            activeTab === "reunions"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <HeartHandshake className="w-4 h-4" />
          Reunions ({notifications.length})
        </button>

        <button
          onClick={() => setActiveTab("roadblocks")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition ${
            activeTab === "roadblocks"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <span>🚧</span>
          Road Blocks & Rerouting ({roadBlocks.filter((r) => r.status === "active").length})
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition ${
            activeTab === "logs"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Activity className="w-4 h-4" />
          Audit Logs ({auditLogs.length})
        </button>
      </div>

      {/* TAB 1: AI INCIDENT PRIORITY QUEUE (EXPLAINABLE SCORING) */}
      {activeTab === "queue" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Ranked Incident Queue */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                Ranked by Dynamic Explainable AI Priority Score
              </span>
              <span className="text-xs text-slate-400">
                Showing {activeRequests.length} Active Incidents
              </span>
            </div>

            {activeRequests.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl">
                No active emergencies currently reported.
              </div>
            ) : (
              activeRequests.map((req, index) => {
                const isSelected = selectedIncident?.id === req.id;
                const isPending = req.status === "pending_review";

                return (
                  <div
                    key={req.id}
                    onClick={() => setSelectedIncident(req)}
                    className={`p-5 rounded-2xl border transition cursor-pointer flex flex-col gap-3 ${
                      isSelected
                        ? "bg-slate-800/90 border-blue-500 shadow-lg shadow-blue-900/30"
                        : "bg-slate-900 border-slate-800 hover:border-slate-700"
                    } ${req.isSOS ? "border-l-4 border-l-red-500" : ""}`}
                  >
                    {/* Header line */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center">
                          #{index + 1}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            req.isSOS ? "bg-red-600 text-white animate-pulse" : "bg-blue-600 text-white"
                          }`}
                        >
                          {req.isSOS ? "🚨 SOS DISTRESS" : req.hazardType}
                        </span>
                        <span className="text-xs font-bold text-slate-200">{req.rescueType}</span>
                      </div>

                      {/* AI Priority Score Badge */}
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Priority Score
                          </span>
                          <span className="text-base font-black text-red-400">
                            {req.priorityScore} <span className="text-xs text-slate-500">/ 100</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{req.location.address}</span>
                    </div>

                    {/* Breakdown Summary Chips */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="bg-slate-950 px-2.5 py-1 rounded-lg text-slate-300 font-semibold border border-slate-800">
                        👥 {req.peopleAffected} Affected
                      </span>
                      {req.vulnerabilities.injured > 0 && (
                        <span className="bg-red-950/60 px-2 py-1 rounded-lg text-red-300 font-bold border border-red-500/30">
                          {req.vulnerabilities.injured} Injured
                        </span>
                      )}
                      {req.vulnerabilities.kids > 0 && (
                        <span className="bg-amber-950/60 px-2 py-1 rounded-lg text-amber-300 font-bold border border-amber-500/30">
                          {req.vulnerabilities.kids} Children
                        </span>
                      )}
                      {req.vulnerabilities.elderly > 0 && (
                        <span className="bg-blue-950/60 px-2 py-1 rounded-lg text-blue-300 font-bold border border-blue-500/30">
                          {req.vulnerabilities.elderly} Elderly
                        </span>
                      )}
                    </div>

                    {/* Team dispatch status & Quick action */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Truck className="w-3.5 h-3.5 text-emerald-400" />
                        {req.assignedTeamName ? (
                          <span className="text-emerald-400 font-bold">
                            Assigned: {req.assignedTeamName} (~{req.etaMinutes || 7}m)
                          </span>
                        ) : (
                          <span className="text-amber-400 font-bold italic">
                            Recommended: {req.recommendedTeamName || "Pending AI match"}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isPending && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(req.id);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approve Dispatch
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setReassignModalReqId(req.id);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
                        >
                          Modify / Reassign
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Transparent Explainable AI Inspection Panel */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {selectedIncident ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-5 sticky top-4">
                <div className="border-b border-slate-800 pb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-bold text-purple-400 flex items-center gap-1.5">
                      <Zap className="w-4 h-4" /> Explainable AI Inspection
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      ID: #{selectedIncident.id.toUpperCase()}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-white mt-1">
                    {selectedIncident.rescueType}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedIncident.location.address}</p>
                </div>

                {/* Formula Display Banner */}
                <div className="bg-slate-950 p-3 rounded-2xl border border-purple-500/30 text-xs flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-purple-300">
                    Calculated Scoring Formula:
                  </span>
                  <div className="font-mono text-[11px] text-slate-300 leading-snug">
                    Priority Score = (Vulnerability × 35) + (People × 15) + (Medical × 20) + (Hazard × 15) + (Time × 10) + (Access × -10) + (Resource × 5)
                  </div>
                </div>

                {/* Score Breakdown Bars */}
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Vulnerability Factor (Weight 35%)</span>
                      <strong className="text-amber-400">
                        {Math.round(selectedIncident.scoreBreakdown.vulnerabilityScore)} pts
                      </strong>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (selectedIncident.scoreBreakdown.vulnerabilityScore / 35) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Medical Urgency (Weight 20%)</span>
                      <strong className="text-red-400">
                        {Math.round(selectedIncident.scoreBreakdown.medicalUrgencyScore)} pts
                      </strong>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-red-500 h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (selectedIncident.scoreBreakdown.medicalUrgencyScore / 20) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Hazard Dynamics (Weight 15%)</span>
                      <strong className="text-blue-400">
                        {Math.round(selectedIncident.scoreBreakdown.hazardSeverityScore)} pts
                      </strong>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (selectedIncident.scoreBreakdown.hazardSeverityScore / 15) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>People Volume (Weight 15%)</span>
                      <strong className="text-emerald-400">
                        {Math.round(selectedIncident.scoreBreakdown.peopleAffectedScore)} pts
                      </strong>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (selectedIncident.scoreBreakdown.peopleAffectedScore / 15) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Natural Language Justification */}
                <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-xs flex flex-col gap-2">
                  <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                    Transparent AI Reason:
                  </span>
                  <p className="text-slate-300 leading-relaxed">
                    {selectedIncident.scoreBreakdown.explanation}
                  </p>
                  {selectedIncident.scoreBreakdown.aiTriageSummary && (
                    <div className="mt-1 text-purple-300 bg-purple-950/40 p-2.5 rounded-xl border border-purple-500/30">
                      <strong>AI Operational Assessment:</strong> {selectedIncident.scoreBreakdown.aiTriageSummary}
                    </div>
                  )}
                </div>

                {/* Recommended Team Matching Justification */}
                <div className="bg-emerald-950/30 border border-emerald-500/30 p-4 rounded-2xl text-xs flex flex-col gap-1.5">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Team Matching Justification:
                  </span>
                  <p className="text-slate-200">
                    {selectedIncident.teamMatchingExplanation ||
                      "Squad matches equipment and vicinity requirements for this incident."}
                  </p>
                </div>

                {/* Direct Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  {selectedIncident.status === "pending_review" && (
                    <button
                      onClick={() => handleApprove(selectedIncident.id)}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve & Dispatch Squad
                    </button>
                  )}
                  <button
                    onClick={() => setReassignModalReqId(selectedIncident.id)}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition"
                  >
                    Reassign Unit
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl">
                Select an incident from the queue to view full explainable triage metrics.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LIVE DISASTER MAP */}
      {activeTab === "map" && (
        <div className="h-[650px] w-full">
          <DisasterMap
            requests={requests}
            teams={teams}
            hospitals={hospitals}
            shelters={shelters}
            roadBlocks={roadBlocks}
            zoom={13}
          />
        </div>
      )}

      {/* TAB 3: RESCUE FLEET TRACKER & DYNAMIC REGISTRATIONS (Requirement 4) */}
      {activeTab === "teams" && (
        <div className="flex flex-col gap-6">
          {/* Action Header & Dynamic Unit Registration */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Truck className="w-5 h-5 text-emerald-400" />
                  Fleet Deployment & Active Online Units
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                  {onlineUnitsCount} Online
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Real-time active status across specialized response categories. AI targets missions strictly by unit category.
              </p>
            </div>

            <button
              onClick={() => setShowRegisterTeamModal(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-900/30 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Register Active Rescue Unit
            </button>
          </div>

          {/* Unit Type Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: "all", label: `All Units (${teams.length})` },
              { id: "NDRF", label: `NDRF (${onlineUnitsByType["NDRF"] || 0})` },
              { id: "Paramedic", label: `Paramedic (${onlineUnitsByType["Paramedic"] || 0})` },
              { id: "Fire & Hazmat", label: `Fire & Hazmat (${onlineUnitsByType["Fire & Hazmat"] || 0})` },
              { id: "Water Rescue", label: `Water Rescue (${onlineUnitsByType["Water Rescue"] || 0})` },
              { id: "Quick Reaction Team", label: `QRT (${onlineUnitsByType["Quick Reaction Team"] || 0})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setTeamTypeFilter(f.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
                  teamTypeFilter === f.id
                    ? "bg-slate-800 text-white border-slate-600 shadow-md"
                    : "bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Teams Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredTeams.map((team) => (
              <div
                key={team.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between gap-4 relative overflow-hidden"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-lg">
                      🚒
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          team.status === "available"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                            : team.status === "busy"
                            ? "bg-amber-950 text-amber-300 border border-amber-500/30"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {team.status}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {team.isOnline !== false ? "🟢 Online" : "⚪ Offline"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-500/30">
                      {team.unitType || "NDRF"}
                    </span>
                    <h3 className="font-bold text-white text-base mt-2">{team.name}</h3>
                    <p className="text-xs text-slate-400">Leader: {team.leader}</p>
                    <p className="text-[11px] text-slate-500 mt-1">Vehicle: {team.vehicleType}</p>
                  </div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-xs">
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Specialization</span>
                  <div className="text-slate-300 font-medium truncate mt-0.5">
                    {team.specialization.join(", ")}
                  </div>
                  <div className="mt-2 text-slate-400 flex justify-between">
                    <span>Workload:</span>
                    <strong className="text-white">{team.workloadCount} active tasks</strong>
                  </div>
                </div>

                <div className="text-xs text-slate-400 flex items-center justify-between border-t border-slate-800 pt-2">
                  <span>Radio/Contact:</span>
                  <span className="font-mono text-slate-200">{team.contact}</span>
                </div>
              </div>
            ))}
          </div>

          {/* DYNAMIC RESCUE TEAM REGISTRATION MODAL */}
          {showRegisterTeamModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-4 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-lg font-black text-white">Register Active Rescue Unit</h3>
                  </div>
                  <button
                    onClick={() => setShowRegisterTeamModal(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleRegisterTeamSubmit} className="flex flex-col gap-3 text-xs">
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">Squad Name *</label>
                    <input
                      type="text"
                      required
                      value={regTeamName}
                      onChange={(e) => setRegTeamName(e.target.value)}
                      placeholder="e.g. NDRF Alpha Tactical-05"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">Unit Specialization Type *</label>
                    <select
                      value={regUnitType}
                      onChange={(e) => setRegUnitType(e.target.value as RescueUnitType)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                    >
                      <option value="NDRF">NDRF (National Disaster Response Force)</option>
                      <option value="Paramedic">Paramedic / Emergency Medical Care</option>
                      <option value="Fire & Hazmat">Fire & Hazardous Chemical Response</option>
                      <option value="Water Rescue">Water Rescue & Flood Evacuation</option>
                      <option value="Quick Reaction Team">Quick Reaction Team (QRT)</option>
                      <option value="Army/Military Support">Army / Tactical Armed Assistance</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">Squad Leader *</label>
                    <input
                      type="text"
                      required
                      value={regLeader}
                      onChange={(e) => setRegLeader(e.target.value)}
                      placeholder="e.g. Commander Vikram Singh"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-300 font-bold block mb-1">Contact / Radio</label>
                      <input
                        type="text"
                        value={regContact}
                        onChange={(e) => setRegContact(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-bold block mb-1">Vehicle Platform</label>
                      <input
                        type="text"
                        value={regVehicle}
                        onChange={(e) => setRegVehicle(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800 mt-2">
                    <button
                      type="button"
                      onClick={() => setShowRegisterTeamModal(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isRegistering}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-md transition flex items-center gap-1.5"
                    >
                      <PlusCircle className="w-4 h-4" />
                      {isRegistering ? "Registering..." : "Add to Active Fleet"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CONTROL ROOM MISSING PERSONS FEED (Requirement 2) */}
      {activeTab === "missing" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Search className="w-5 h-5 text-teal-400" />
                  Live Missing Persons Registry & Tracing Feed
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-teal-950 text-teal-300 border border-teal-500/30">
                  {missingPersons.length} Total Registered
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Central real-time stream of all citizens reported missing, continuously cross-referenced with shelter check-ins.
              </p>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-2">
              {(["all", "missing", "found"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setMpFilterStatus(s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition ${
                    mpFilterStatus === s
                      ? "bg-teal-600 text-white"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {s === "all" ? "All Records" : s === "missing" ? "In Tracing" : "Found in Shelters"}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={mpSearch}
              onChange={(e) => setMpSearch(e.target.value)}
              placeholder="Search missing individual by name, last seen location, or physical features..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500"
            />
          </div>

          {/* Missing Persons Grid */}
          {filteredMissingPersons.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-slate-950/60 border border-slate-800 rounded-2xl">
              No missing person records match the current filter criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMissingPersons.map((person) => {
                const isFound = person.matchStatus === "matched" || person.status === "located_in_shelter" || person.status === "reunited";
                const displayName = person.fullName || person.name;
                const reporterName = person.reportedBy?.name || person.reporterName || "Anonymous Reporter";
                const reporterPhone = person.reportedBy?.phone || person.reporterPhone || "Not provided";
                return (
                  <div
                    key={person.id}
                    className={`bg-slate-950 border rounded-2xl p-5 flex flex-col justify-between gap-3 shadow-lg transition ${
                      isFound
                        ? "border-emerald-500/50 shadow-emerald-950/20"
                        : "border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {person.photoUrl ? (
                            <img
                              src={person.photoUrl}
                              alt={displayName}
                              className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl shrink-0">
                              👤
                            </div>
                          )}
                          <div>
                            <h3 className="font-black text-white text-base leading-snug">
                              {displayName}
                            </h3>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {person.age} yrs • {person.gender}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isFound
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                              : "bg-amber-950 text-amber-300 border border-amber-500/40 animate-pulse"
                          }`}
                        >
                          {isFound ? "Found in Shelter" : "Active Tracing"}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-slate-300 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                        <div>
                          <strong className="text-slate-400">Last Seen:</strong> {person.lastSeenLocation}
                        </div>
                        {person.identificationMarks && (
                          <div>
                            <strong className="text-slate-400">Marks/Features:</strong>{" "}
                            {person.identificationMarks}
                          </div>
                        )}
                        <div className="border-t border-slate-800/80 pt-1 text-[11px] text-slate-400">
                          <span>Reported by: </span>
                          <strong className="text-slate-200">{reporterName}</strong> (
                          <span className="font-mono">{reporterPhone}</span>)
                        </div>
                      </div>
                    </div>

                    {/* Match Details if Found */}
                    {isFound && (
                      <div className="bg-emerald-950/50 border border-emerald-500/40 p-3 rounded-xl text-xs flex flex-col gap-1">
                        <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Accommodated at {person.matchedShelterName || "Relief Shelter"}
                        </div>
                        <div className="text-slate-300 text-[11px]">
                          Condition:{" "}
                          <span className="text-emerald-400 font-bold">
                            {person.matchedCondition || "Safe / Stable"}
                          </span>
                        </div>
                        {person.matchedShelterContact && (
                          <div className="text-slate-400 text-[11px]">
                            Camp Hotline: <span className="font-mono text-slate-200">{person.matchedShelterContact}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: REUNION MATCHES FEED (Requirement 3) */}
      {activeTab === "reunions" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <HeartHandshake className="w-5 h-5 text-indigo-400" />
                  Family Reunions & Shelter Cross-Match Logs
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-950 text-indigo-300 border border-indigo-500/30">
                  {notifications.length} Matches
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Automated matching history: Whenever shelter authorities check in a found citizen matching a missing person, notifications are broadcast directly to citizen reporters and recorded here.
              </p>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-slate-950/60 border border-slate-800 rounded-2xl">
              No reunion matches recorded yet. Matches appear as relief shelter staff log rescued individuals.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-5 shadow-lg flex flex-col justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl shrink-0">
                      🎉
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                          Reunion Match Confirmed
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(notif.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <h4 className="text-base font-black text-white mt-1">
                        {notif.missingPersonName}
                      </h4>
                      <p className="text-xs text-slate-300 mt-2 space-y-1">
                        <div>
                          <strong>Shelter:</strong> {notif.shelterName} ({notif.shelterAddress})
                        </div>
                        <div>
                          <strong>Condition:</strong>{" "}
                          <span className="text-emerald-400 font-bold">{notif.physicalCondition}</span>
                        </div>
                        <div>
                          <strong>Reporter Contact:</strong>{" "}
                          <span className="font-mono text-slate-200">{notif.reporterPhone}</span>
                        </div>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    <a
                      href={`tel:${notif.shelterContact}`}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      Contact Camp: {notif.shelterContact}
                    </a>
                    {!notif.read && onMarkNotificationRead && (
                      <button
                        onClick={() => onMarkNotificationRead(notif.id)}
                        className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ROAD BLOCKS & REROUTING */}
      {activeTab === "roadblocks" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-6">
          <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <span>🚧</span> Active Transit Road Blocks & Obstructions
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Clearing a roadblock dynamically triggers rerouting for all impacted rescue vehicles and recalculates ETAs.
              </p>
            </div>
            <span className="text-xs text-amber-400 font-bold bg-amber-950/60 border border-amber-500/30 px-3 py-1 rounded-xl">
              {roadBlocks.filter((r) => r.status === "active").length} Active Roadblocks
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roadBlocks.map((rb) => (
              <div
                key={rb.id}
                className={`p-5 rounded-2xl border flex flex-col justify-between gap-3 ${
                  rb.status === "active"
                    ? "bg-slate-950 border-amber-500/40"
                    : "bg-slate-950/50 border-slate-800 opacity-60"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <span>🚧</span> {rb.blockageType}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        rb.status === "active"
                          ? "bg-amber-950 text-amber-300 border border-amber-500/30"
                          : "bg-emerald-950 text-emerald-300"
                      }`}
                    >
                      {rb.status}
                    </span>
                  </div>

                  <h3 className="font-bold text-white text-base mt-2">{rb.roadName}</h3>
                  <p className="text-xs text-slate-400 mt-1">{rb.description}</p>
                  <span className="text-[10px] text-slate-500 mt-2 block">
                    Reported by: {rb.reportedBy} ({new Date(rb.reportedAt).toLocaleTimeString()})
                  </span>
                </div>

                {rb.status === "active" && (
                  <button
                    onClick={() => onClearRoadblock(rb.id)}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Cleared (Trigger Dynamic Rerouting)
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT LOGS */}
      {activeTab === "logs" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-400" />
              Real-Time Decision Audit Trail
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Chronological log of automated AI assignments, commander overrides, and status transitions.
            </p>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <div>
                    <span className="font-bold text-slate-200 uppercase text-[10px] bg-slate-800 px-1.5 py-0.5 rounded mr-2">
                      {log.action}
                    </span>
                    <span className="text-slate-300">{log.note || log.details}</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                  Actor: {log.actor}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REASSIGN TASK MODAL */}
      {reassignModalReqId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full flex flex-col gap-4 shadow-2xl">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-400" />
              Commander Task Reassignment Override
            </h3>
            <p className="text-xs text-slate-400">
              Select an alternative rescue unit and provide a reason for the audit trail.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-300">Select Alternate Team</label>
              <select
                value={targetTeamId}
                onChange={(e) => setTargetTeamId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white mt-1"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.status.toUpperCase()} - {t.workloadCount} tasks)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300">Reason for Reassignment *</label>
              <textarea
                rows={2}
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                placeholder="e.g. Squad Alpha closer to primary sector; specialized crane equipment needed..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white mt-1"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setReassignModalReqId(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReassign}
                disabled={!reassignReason}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold"
              >
                Confirm Reassignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
