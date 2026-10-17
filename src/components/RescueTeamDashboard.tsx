import React, { useState } from "react";
import {
  AuthUser,
  EmergencyRequest,
  Hospital,
  OfficialUpdate,
  RescueTeam,
  RescueTeamStatus,
  RoadBlock,
  Shelter,
} from "../types";
import { DisasterMap } from "./DisasterMap";
import { RescueNavigationRoute } from "./RescueNavigationRoute";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  CheckSquare,
  Clock,
  Compass,
  FileText,
  Hospital as HospIcon,
  MapPin,
  Megaphone,
  Navigation,
  Radio,
  Search,
  Shield,
  Square,
  Truck,
  Users,
  XCircle,
} from "lucide-react";
import { soundManager } from "../utils/audioAlert";

interface RescueTeamDashboardProps {
  currentUser?: AuthUser;
  teams: RescueTeam[];
  requests: EmergencyRequest[];
  hospitals: Hospital[];
  shelters: Shelter[];
  roadBlocks: RoadBlock[];
  officialUpdates: OfficialUpdate[];
  onUpdateStatus: (requestId: string, teamId: string, status: any, note?: string) => Promise<void>;
  onToggleTeamAvailability: (teamId: string, status: RescueTeamStatus) => Promise<void>;
  onReportMissing: (payload: any) => Promise<void>;
  onReportRoadblock: (payload: any) => Promise<void>;
}

export const RescueTeamDashboard: React.FC<RescueTeamDashboardProps> = ({
  currentUser,
  teams,
  requests,
  hospitals,
  shelters,
  roadBlocks,
  officialUpdates,
  onUpdateStatus,
  onToggleTeamAvailability,
  onReportMissing,
  onReportRoadblock,
}) => {
  // Current active team selection - prioritize authenticated user's unit
  const [selectedTeamId, setSelectedTeamId] = useState<string>(() => {
    if (currentUser?.identifier) {
      const match = teams.find((t) => t.id === currentUser.identifier);
      if (match) return match.id;
    }
    return teams.length > 0 ? teams[0].id : "team-1";
  });

  const [activeTab, setActiveTab] = useState<"missions" | "resources" | "report" | "feed">("missions");
  const [withdrawalReason, setWithdrawalReason] = useState("");
  const [showWithdrawModal, setShowWithdrawModal] = useState<string | null>(null);
  const [expandedNavTaskId, setExpandedNavTaskId] = useState<string | null>(null);

  // Field checklists state
  const [checkedEquip, setCheckedEquip] = useState<Record<string, boolean>>({});

  // Field reporting state
  const [reportType, setReportType] = useState<"roadblock" | "missing">("roadblock");
  const [fieldRbRoad, setFieldRbRoad] = useState("");
  const [fieldRbType, setFieldRbType] = useState<RoadBlock["blockageType"]>("Flooded");
  const [fieldRbDesc, setFieldRbDesc] = useState("");

  const [fieldMpName, setFieldMpName] = useState("");
  const [fieldMpAge, setFieldMpAge] = useState("");
  const [fieldMpFeatures, setFieldMpFeatures] = useState("");

  const currentTeam = teams.find((t) => t.id === selectedTeamId) || teams[0];

  // Assigned tasks for this specific team
  const assignedTasks = requests.filter(
    (r) =>
      r.assignedTeamId === selectedTeamId &&
      r.status !== "completed" &&
      r.status !== "cancelled"
  );

  const toggleEquipment = (item: string) => {
    setCheckedEquip((prev) => ({ ...prev, [item]: !prev[item] }));
  };

  const handleStatusProgression = async (
    req: EmergencyRequest,
    nextStatus: EmergencyRequest["status"],
    note?: string
  ) => {
    soundManager.playChime("success");
    await onUpdateStatus(req.id, currentTeam.id, nextStatus, note);
  };

  const handleWithdrawTask = async (reqId: string) => {
    if (!withdrawalReason) return;
    soundManager.playChime("warning");
    await onUpdateStatus(
      reqId,
      currentTeam.id,
      "withdrawn",
      withdrawalReason
    );
    setShowWithdrawModal(null);
    setWithdrawalReason("");
  };

  const handleFieldRoadblock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldRbRoad) return;
    await onReportRoadblock({
      roadName: fieldRbRoad,
      location: { lat: currentTeam.location.lat + 0.003, lng: currentTeam.location.lng + 0.002 },
      blockageType: fieldRbType,
      description: `Reported by Field Unit ${currentTeam.name}: ${fieldRbDesc}`,
      reportedBy: currentTeam.name,
    });
    setFieldRbRoad("");
    setFieldRbDesc("");
    soundManager.playChime("success");
  };

  const handleFieldMissing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldMpName) return;
    await onReportMissing({
      name: fieldMpName,
      age: Number(fieldMpAge) || 25,
      gender: "Unknown",
      lastSeenLocation: `Near ${currentTeam.name} patrol perimeter`,
      lastSeenCoordinates: { lat: currentTeam.location.lat, lng: currentTeam.location.lng },
      physicalFeatures: fieldMpFeatures,
      reporterName: currentTeam.name,
      reporterPhone: currentTeam.contact,
    });
    setFieldMpName("");
    setFieldMpAge("");
    setFieldMpFeatures("");
    soundManager.playChime("success");
  };

  return (
    <div id="rescue-team-dashboard-container" className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Team Header & Unit Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-blue-600/30">
            🚒
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold text-blue-400">
                Rescue Operations Terminal
              </span>
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                  currentTeam?.status === "available"
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                    : currentTeam?.status === "busy"
                    ? "bg-amber-950 text-amber-300 border border-amber-500/30"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {currentTeam?.status}
              </span>
            </div>
            <h1 className="text-2xl font-black text-white">{currentTeam?.name}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Leader: <strong className="text-slate-200">{currentTeam?.leader}</strong> • {currentTeam?.vehicleType} • Specialization: {currentTeam?.specialization.join(", ")}
            </p>
          </div>
        </div>

        {/* Unit Selector & Status Switcher */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Select Field Unit
            </label>
            <select
              id="select-active-team"
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-blue-500 focus:outline-none"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Unit Availability
            </label>
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {(["available", "busy", "offline"] as RescueTeamStatus[]).map((st) => (
                <button
                  key={st}
                  onClick={() => onToggleTeamAvailability(currentTeam.id, st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition ${
                    currentTeam?.status === st
                      ? st === "available"
                        ? "bg-emerald-600 text-white"
                        : st === "busy"
                        ? "bg-amber-600 text-white"
                        : "bg-slate-700 text-slate-200"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
        <button
          onClick={() => setActiveTab("missions")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition ${
            activeTab === "missions"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Truck className="w-4 h-4" />
          Active Mission Dispatches ({assignedTasks.length})
        </button>

        <button
          onClick={() => setActiveTab("resources")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition ${
            activeTab === "resources"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          Vehicle Gear & Equipment
        </button>

        <button
          onClick={() => setActiveTab("report")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition ${
            activeTab === "report"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <span>🚧</span>
          Field Intel Reporting
        </button>

        <button
          onClick={() => setActiveTab("feed")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition ${
            activeTab === "feed"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Megaphone className="w-4 h-4" />
          Command Feed ({officialUpdates.length})
        </button>
      </div>

      {/* TAB 1: ACTIVE MISSIONS */}
      {activeTab === "missions" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 flex flex-col gap-6">
            {assignedTasks.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400 flex flex-col items-center gap-3">
                <CheckCircle className="w-12 h-12 text-emerald-500" />
                <h3 className="text-base font-bold text-white">No Pending Dispatches</h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  {currentTeam.name} is currently on standby in sector perimeter. The AI auto-matcher will route high-priority emergencies as they emerge.
                </p>
              </div>
            ) : (
              assignedTasks.map((task) => (
                <div
                  key={task.id}
                  className={`bg-slate-900 border rounded-3xl p-6 shadow-xl flex flex-col gap-5 ${
                    task.isSOS ? "border-red-500/60 shadow-red-950/40" : "border-slate-800"
                  }`}
                >
                  {/* Task Header */}
                  <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                            task.isSOS ? "bg-red-600 text-white animate-pulse" : "bg-blue-600 text-white"
                          }`}
                        >
                          {task.isSOS ? "🚨 SOS EMERGENCY" : task.hazardType}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          #{task.id.toUpperCase()}
                        </span>
                        <span className="text-xs font-bold text-red-400 bg-red-950/60 border border-red-500/30 px-2 py-0.5 rounded">
                          Priority Score: {task.priorityScore}/100
                        </span>
                      </div>
                      <h2 className="text-xl font-black text-white mt-1.5">{task.rescueType}</h2>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <MapPin className="w-4 h-4 text-blue-400" />
                        {task.location.address}
                      </p>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Mission Status</span>
                      <span className="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-blue-950 text-blue-300 border border-blue-500/40 mt-1">
                        {task.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  {/* Incident Snapshot */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/70 p-3 rounded-2xl border border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold">Affected</span>
                      <div className="text-lg font-black text-white">{task.peopleAffected} Persons</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold">Vulnerable</span>
                      <div className="text-xs font-bold text-amber-300 mt-1">
                        {task.vulnerabilities.injured} Injured, {task.vulnerabilities.kids} Kids, {task.vulnerabilities.elderly} Elders
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold">ETA</span>
                      <div className="text-lg font-black text-emerald-400">~{task.etaMinutes || 7}m</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold">Referral</span>
                      <div className="text-xs font-bold text-slate-300 mt-1 truncate">
                        {task.targetDestinationName || "Trauma Center"}
                      </div>
                    </div>
                  </div>

                  {/* AI Match Explanation */}
                  <div className="bg-blue-950/30 border border-blue-500/30 p-3.5 rounded-2xl text-xs text-slate-300">
                    <div className="font-bold text-blue-300 flex items-center gap-1.5 mb-1">
                      <Shield className="w-3.5 h-3.5 text-blue-400" /> AI Team Matching Justification:
                    </div>
                    <p>{task.teamMatchingExplanation || "Squad matches equipment and vicinity requirements for this incident."}</p>
                  </div>

                  {/* Required Equipment Checklist */}
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex flex-col gap-2">
                    <span className="text-xs uppercase font-bold text-slate-300 flex items-center justify-between">
                      <span>Required Equipment Checklist</span>
                      <span className="text-[10px] font-normal text-slate-400">Verify in vehicle before arrival</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                      {(currentTeam.equipment || currentTeam.resources?.map((r) => r.name) || []).map((item) => {
                        const checked = !!checkedEquip[`${task.id}-${item}`];
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => toggleEquipment(`${task.id}-${item}`)}
                            className={`flex items-center gap-2 p-2 rounded-xl text-xs text-left border transition ${
                              checked
                                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {checked ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500" />
                            )}
                            <span className="font-medium">{item}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* REAL-TIME STATUS PROGRESSION CONTROLS */}
                  <div className="border-t border-slate-800 pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowWithdrawModal(task.id)}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-950/60 border border-red-500/30 transition flex items-center justify-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Withdraw
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedNavTaskId(expandedNavTaskId === task.id ? null : task.id)
                        }
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                          expandedNavTaskId === task.id || task.status === "on_the_way"
                            ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30"
                            : "bg-slate-950 text-blue-400 border-blue-500/40 hover:bg-blue-950/50"
                        }`}
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        {expandedNavTaskId === task.id ? "Hide GPS Route" : "Live GPS Route"}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {task.status === "assigned" && (
                        <button
                          onClick={() => {
                            handleStatusProgression(task, "accepted");
                            setExpandedNavTaskId(task.id);
                          }}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Accept Mission & Navigate
                        </button>
                      )}

                      {(task.status === "assigned" || task.status === "accepted") && (
                        <button
                          onClick={() => {
                            handleStatusProgression(task, "on_the_way");
                            setExpandedNavTaskId(task.id);
                          }}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md flex items-center justify-center gap-1.5"
                        >
                          <Compass className="w-4 h-4" />
                          Mark En Route / On The Way
                        </button>
                      )}

                      {task.status === "on_the_way" && (
                        <button
                          onClick={() => handleStatusProgression(task, "arrived")}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md flex items-center justify-center gap-1.5"
                        >
                          <MapPin className="w-4 h-4" />
                          Mark Arrived on Scene
                        </button>
                      )}

                      {task.status === "arrived" && (
                        <button
                          onClick={() => handleStatusProgression(task, "helping")}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-md flex items-center justify-center gap-1.5"
                        >
                          <Shield className="w-4 h-4" />
                          Extraction / Helping in Progress
                        </button>
                      )}

                      {task.status === "helping" && (
                        <button
                          onClick={() => handleStatusProgression(task, "completed")}
                          className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Mark Mission Completed & Rescued
                        </button>
                      )}
                    </div>
                  </div>

                  {/* INTERACTIVE NAVIGATION ROUTE MAP (Requirement 6) */}
                  {(expandedNavTaskId === task.id ||
                    task.status === "accepted" ||
                    task.status === "on_the_way" ||
                    task.status === "arrived") && (
                    <div className="pt-2">
                      <RescueNavigationRoute
                        team={currentTeam}
                        request={task}
                        roadBlocks={roadBlocks}
                        onAdvanceStatus={(status, note) =>
                          handleStatusProgression(task, status, note)
                        }
                      />
                    </div>
                  )}

                  {/* WITHDRAW MODAL */}
                  {showWithdrawModal === task.id && (
                    <div className="bg-red-950/80 border-2 border-red-500 p-4 rounded-2xl flex flex-col gap-3">
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        Withdraw Mission: Reason Required for AI Reassessment
                      </div>
                      <p className="text-[11px] text-red-200">
                        Withdrawing immediately triggers the automatic dynamic reassessment loop to recalculate priority and assign the next optimal squad.
                      </p>
                      <textarea
                        rows={2}
                        value={withdrawalReason}
                        onChange={(e) => setWithdrawalReason(e.target.value)}
                        placeholder="e.g. Engine flood failure, medical supply exhausted, impassable bridge cutoff..."
                        className="bg-slate-950 border border-red-500/50 rounded-xl p-2.5 text-xs text-white"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setShowWithdrawModal(null)}
                          className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-300"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleWithdrawTask(task.id)}
                          className="px-4 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-500"
                        >
                          Confirm Withdrawal & Trigger Reassessment
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Right Column: Tactical Operational Map */}
          <div className="lg:col-span-5 h-[620px]">
            <DisasterMap
              requests={requests}
              teams={teams}
              hospitals={hospitals}
              shelters={shelters}
              roadBlocks={roadBlocks}
              center={[currentTeam.location.lat, currentTeam.location.lng]}
              zoom={14}
            />
          </div>
        </div>
      )}

      {/* TAB 2: RESOURCES & EQUIPMENT */}
      {activeTab === "resources" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
              <CheckSquare className="w-5 h-5 text-emerald-400" />
              Depot & Vehicle Inventory
            </h2>
            <div className="space-y-3">
              {(currentTeam.equipment || currentTeam.resources?.map((r) => r.name) || []).map((eq, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                >
                  <span className="font-semibold text-slate-200">{eq}</span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-300 font-bold border border-emerald-500/30">
                    Inspected & Ready
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
              <Shield className="w-5 h-5 text-blue-400" />
              Specializations & Capacity
            </h2>
            <div className="space-y-4 text-xs">
              <div>
                <span className="text-slate-400 uppercase font-semibold text-[10px]">Primary Vehicle</span>
                <div className="text-base font-bold text-white mt-0.5">{currentTeam.vehicleType}</div>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-semibold text-[10px]">Max Trapped Extraction Capacity</span>
                <div className="text-base font-bold text-emerald-400 mt-0.5">{currentTeam.capacity || 10} Persons per transit</div>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-semibold text-[10px]">Active Workload Score</span>
                <div className="text-base font-bold text-amber-400 mt-0.5">{currentTeam.workloadCount} Active Missions</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FIELD REPORTING */}
      {activeTab === "report" && (
        <div className="max-w-2xl mx-auto w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-lg font-black text-white">Field Scout Incident Intel</h2>
              <p className="text-xs text-slate-400 mt-0.5">Submit immediate observations from the transit route.</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setReportType("roadblock")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  reportType === "roadblock" ? "bg-amber-600 text-white" : "text-slate-400"
                }`}
              >
                Roadblock
              </button>
              <button
                onClick={() => setReportType("missing")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  reportType === "missing" ? "bg-purple-600 text-white" : "text-slate-400"
                }`}
              >
                Missing Person
              </button>
            </div>
          </div>

          {reportType === "roadblock" ? (
            <form onSubmit={handleFieldRoadblock} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-300">Impassable Roadway *</label>
                <input
                  type="text"
                  required
                  value={fieldRbRoad}
                  onChange={(e) => setFieldRbRoad(e.target.value)}
                  placeholder="e.g. South Canal Embankment Rd"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300">Blockage Type *</label>
                <select
                  value={fieldRbType}
                  onChange={(e) => setFieldRbType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white"
                >
                  <option value="Flooded">Deep Water Flooding</option>
                  <option value="Debris / Rubble">Debris / Rubble</option>
                  <option value="Fallen Trees">Fallen Trees</option>
                  <option value="Landslide">Landslide</option>
                  <option value="Collapsed Bridge">Collapsed Bridge</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300">Description</label>
                <textarea
                  rows={2}
                  value={fieldRbDesc}
                  onChange={(e) => setFieldRbDesc(e.target.value)}
                  placeholder="Water depth exceeds 1.2m, light vehicles cannot cross..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-md"
              >
                Broadcast Road Hazard to Fleet
              </button>
            </form>
          ) : (
            <form onSubmit={handleFieldMissing} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">Person Name *</label>
                  <input
                    type="text"
                    required
                    value={fieldMpName}
                    onChange={(e) => setFieldMpName(e.target.value)}
                    placeholder="Name / Alias"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Estimated Age</label>
                  <input
                    type="number"
                    value={fieldMpAge}
                    onChange={(e) => setFieldMpAge(e.target.value)}
                    placeholder="Approx age"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300">Physical Features / Location Context</label>
                <textarea
                  rows={2}
                  value={fieldMpFeatures}
                  onChange={(e) => setFieldMpFeatures(e.target.value)}
                  placeholder="Clothing, walking aid, last spotted by team near sector..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-md"
              >
                Publish Field Missing Person Sighting
              </button>
            </form>
          )}
        </div>
      )}

      {/* TAB 4: OFFICIAL COMMAND FEED */}
      {activeTab === "feed" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4 max-w-3xl mx-auto w-full">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-purple-400" />
              Official Disaster Command Directives
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Real-time alerts broadcast from the Central Authority.</p>
          </div>

          <div className="space-y-3">
            {officialUpdates.map((item) => (
              <div
                key={item.id}
                className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-blue-400 uppercase tracking-wider text-[10px]">
                    {item.author || item.issuedBy} {item.source ? `(${item.source})` : ""}
                  </span>
                  <span className="text-slate-500 text-[10px]">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-100">{item.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{item.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
