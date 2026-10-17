import React, { useEffect, useState } from "react";
import {
  AuditLogEntry,
  AuthUser,
  ControlRoomSummary,
  EmergencyRequest,
  Hospital,
  MissingPerson,
  MissingPersonMatchNotification,
  OfficialUpdate,
  RescueTeam,
  RescueTeamStatus,
  RescueUnitType,
  RoadBlock,
  Shelter,
  UserRole,
} from "./types";
import { SosAlertOverlay } from "./components/SosAlertOverlay";
import { CitizenDashboard } from "./components/CitizenDashboard";
import { RescueTeamDashboard } from "./components/RescueTeamDashboard";
import { HospitalDashboard } from "./components/HospitalDashboard";
import { ShelterDashboard } from "./components/ShelterDashboard";
import { AdminControlDashboard } from "./components/AdminControlDashboard";
import { AuthModal } from "./components/AuthModal";
import {
  AlertOctagon,
  Building2,
  CheckCircle2,
  HeartHandshake,
  Hospital as HospIcon,
  Lock,
  LogOut,
  Radio,
  RefreshCw,
  Shield,
  ShieldAlert,
  Tent,
  Truck,
  User,
  Volume2,
  VolumeX,
} from "lucide-react";
import { soundManager } from "./utils/audioAlert";

export const App: React.FC = () => {
  // Authentication & Role-Based Access State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem("rescuelink_user");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    // Default initial session as Citizen for immediate exploration
    return {
      id: "user-citizen-sweety",
      role: "citizen",
      name: "Sweety Muddana",
      identifier: "+1 (555) 234-8901",
      loginTime: Date.now(),
    };
  });

  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [currentRole, setCurrentRole] = useState<UserRole>(() => currentUser?.role || "citizen");

  // Notifications State for Missing Person Matches (Requirement 3)
  const [notifications, setNotifications] = useState<MissingPersonMatchNotification[]>([]);

  // SSE & Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [activeSos, setActiveSos] = useState<EmergencyRequest | null>(null);

  // Core domain data collections
  const [requests, setRequests] = useState<EmergencyRequest[]>([]);
  const [teams, setTeams] = useState<RescueTeam[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [missingPersons, setMissingPersons] = useState<MissingPerson[]>([]);
  const [roadBlocks, setRoadBlocks] = useState<RoadBlock[]>([]);
  const [officialUpdates, setOfficialUpdates] = useState<OfficialUpdate[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [summary, setSummary] = useState<ControlRoomSummary>({
    totalPeopleAffected: 0,
    totalVulnerablePeople: 0,
    totalVulnerable: 0,
    activeIncidentsCount: 0,
    activeEmergencies: 0,
    sosAlertsCount: 0,
    sosAlertsActive: 0,
    availableRescueTeams: 0,
    rescueTeamsDeployed: 0,
    totalRescueTeams: 0,
    totalHospitalBedsAvailable: 0,
    hospitalBedsFree: 0,
    totalShelterVacancies: 0,
    shelterVacancies: 0,
    activeRoadblocksCount: 0,
    activeRoadBlocks: 0,
    missingPersonsCount: 0,
    locatedPersonsCount: 0,
  });

  // Keep currentRole in sync with currentUser
  useEffect(() => {
    if (currentUser) {
      setCurrentRole(currentUser.role);
    }
  }, [currentUser]);

  // Fetch initial data & notifications
  const fetchData = async () => {
    try {
      const notifUrl =
        currentUser?.role === "citizen" && currentUser?.identifier
          ? `/api/notifications?reporterPhone=${encodeURIComponent(currentUser.identifier)}`
          : "/api/notifications";

      const [reqRes, teamRes, hospRes, sheltRes, mpRes, rbRes, updRes, sumRes, notifRes] =
        await Promise.all([
          fetch("/api/requests").then((r) => r.json()),
          fetch("/api/teams").then((r) => r.json()),
          fetch("/api/hospitals").then((r) => r.json()),
          fetch("/api/shelters").then((r) => r.json()),
          fetch("/api/missing-persons").then((r) => r.json()),
          fetch("/api/roadblocks").then((r) => r.json()),
          fetch("/api/updates").then((r) => r.json()),
          fetch("/api/summary").then((r) => r.json()),
          fetch(notifUrl)
            .then((r) => r.json())
            .catch(() => []),
        ]);

      setRequests(reqRes);
      setTeams(teamRes);
      setHospitals(hospRes);
      setShelters(sheltRes);
      setMissingPersons(mpRes);
      setRoadBlocks(rbRes);
      setOfficialUpdates(updRes);
      setSummary(sumRes);
      setNotifications(notifRes);

      // Check if any SOS is already active and pending
      const pendingSos = reqRes.find(
        (r: EmergencyRequest) =>
          r.isSOS && r.status !== "completed" && r.status !== "cancelled"
      );
      if (pendingSos) {
        setActiveSos(pendingSos);
      }
    } catch (e) {
      console.error("Initial data load error:", e);
    }
  };

  useEffect(() => {
    fetchData();

    // Setup Server-Sent Events (SSE) listener
    const eventSource = new EventSource("/api/stream");

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    // SOS Alert Event
    eventSource.addEventListener("sos_alert", (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        setActiveSos(payload.request || payload);
        soundManager.playChime("alert");
        fetchData();
      } catch (err) {
        console.error("SOS event parse error:", err);
      }
    });

    // Missing Person Match Event (Requirement 3)
    eventSource.addEventListener("missing_person_match", (e: MessageEvent) => {
      try {
        const notif = JSON.parse(e.data);
        setNotifications((prev) => [notif, ...prev]);
        soundManager.playChime("success");
        fetchData();
      } catch (err) {
        console.error("Missing person match event error:", err);
      }
    });

    eventSource.addEventListener("notifications_updated", () => fetchData());
    eventSource.addEventListener("missing_persons_updated", () => fetchData());
    eventSource.addEventListener("teams_updated", () => fetchData());
    eventSource.addEventListener("team_registered", () => fetchData());

    // Request updates
    eventSource.addEventListener("request_created", () => fetchData());
    eventSource.addEventListener("request_updated", () => fetchData());
    eventSource.addEventListener("reassessment_complete", (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.log) {
          setAuditLogs((prev) => [payload.log, ...prev]);
        }
      } catch (e) {
        // ignore
      }
      fetchData();
    });
    eventSource.addEventListener("hospital_updated", () => fetchData());
    eventSource.addEventListener("shelter_updated", () => fetchData());
    eventSource.addEventListener("roadblock_updated", () => fetchData());
    eventSource.addEventListener("official_update", () => fetchData());

    return () => {
      eventSource.close();
    };
  }, []);

  // Login & Logout Handlers
  const handleLogin = (user: AuthUser) => {
    setCurrentUser(user);
    setCurrentRole(user.role);
    localStorage.setItem("rescuelink_user", JSON.stringify(user));
    setShowAuthModal(false);
    soundManager.playChime("success");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("rescuelink_user");
    setShowAuthModal(true);
  };

  const handleSwitchRoleClick = (targetRole: UserRole) => {
    if (currentUser?.role === targetRole) {
      setCurrentRole(targetRole);
    } else {
      // Prompt credential login for target role
      setShowAuthModal(true);
    }
  };

  // API Actions
  const handleCreateRequest = async (payload: any): Promise<EmergencyRequest> => {
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    await fetchData();
    return data;
  };

  const handleTriggerSos = async (payload: any): Promise<EmergencyRequest> => {
    const res = await fetch("/api/requests/sos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setActiveSos(data);
    await fetchData();
    return data;
  };

  const handleApproveAssignment = async (requestId: string) => {
    await fetch(`/api/requests/${requestId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: currentUser?.name || "Control Room Commander" }),
    });
    await fetchData();
  };

  const handleReassignTask = async (
    requestId: string,
    newTeamId: string,
    reason: string
  ) => {
    await fetch(`/api/requests/${requestId}/reassign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newTeamId, reason, actor: currentUser?.name || "Control Room Commander" }),
    });
    await fetchData();
  };

  const handleUpdateRescueStatus = async (
    requestId: string,
    teamId: string,
    status: any,
    note?: string
  ) => {
    await fetch(`/api/requests/${requestId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, status, note }),
    });
    await fetchData();
  };

  const handleCancelRequest = async (requestId: string) => {
    await fetch(`/api/requests/${requestId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Citizen self-reported safe" }),
    });
    await fetchData();
  };

  const handleToggleTeamAvailability = async (
    teamId: string,
    status: RescueTeamStatus
  ) => {
    await fetch(`/api/teams/${teamId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchData();
  };

  const handleUpdateHospital = async (
    hospitalId: string,
    updates: Partial<Hospital>
  ) => {
    await fetch(`/api/hospitals/${hospitalId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    await fetchData();
  };

  const handleUpdateShelter = async (
    shelterId: string,
    updates: Partial<Shelter>
  ) => {
    await fetch(`/api/shelters/${shelterId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    await fetchData();
  };

  const handleRegisterRescued = async (shelterId: string, payload: any) => {
    const res = await fetch(`/api/shelters/${shelterId}/rescued`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    await fetchData();
    return data;
  };

  const handleReportMissing = async (payload: any) => {
    await fetch("/api/missing-persons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await fetchData();
  };

  const handleReportRoadblock = async (payload: any) => {
    await fetch("/api/roadblocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await fetchData();
  };

  const handleClearRoadblock = async (blockId: string) => {
    await fetch(`/api/roadblocks/${blockId}/clear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: currentUser?.name || "Control Room Clearing Directive" }),
    });
    await fetchData();
  };

  const handleTriggerReassessment = async (reason: string) => {
    await fetch("/api/reassessment/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    await fetchData();
  };

  // Dynamic Rescue Team Registration (Requirement 4)
  const handleRegisterTeam = async (data: {
    name: string;
    unitType: RescueUnitType;
    leader: string;
    contact: string;
    vehicleType: string;
  }): Promise<RescueTeam> => {
    const res = await fetch("/api/teams/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const newTeam = await res.json();
    await fetchData();
    return newTeam;
  };

  // Mark Missing Person notification read (Requirement 3)
  const handleMarkNotificationRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  // Chaos simulations
  const handleTriggerSimulation = async (type: "sos" | "roadblock" | "team_offline") => {
    if (type === "sos") {
      await handleTriggerSos({
        location: {
          lat: 13.085 + (Math.random() - 0.5) * 0.02,
          lng: 80.26 + (Math.random() - 0.5) * 0.02,
          address: "Simulated Flash Flood Rooftop Distress",
        },
        peopleAffected: 5,
        vulnerabilities: { injured: 2, kids: 2, elderly: 1, pregnant: 0, impaired: 0 },
        description: "SIMULATION: Rapid water rise, 5 trapped on roof!",
        reporterContact: "SIM-CITIZEN-99",
      });
    } else if (type === "roadblock") {
      await handleReportRoadblock({
        roadName: "Simulated Main Bridge Cutoff",
        location: { lat: 13.081, lng: 80.264 },
        blockageType: "Collapsed Bridge",
        description: "SIMULATION: Structural failure blocks direct north corridor.",
        reportedBy: "Sensor Network Sim",
      });
    } else {
      // Toggle first available team to offline
      const avail = teams.find((t) => t.status === "available");
      if (avail) {
        await handleToggleTeamAvailability(avail.id, "offline");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-red-500 selection:text-white">
      {/* RBAC Authentication Modal */}
      {(showAuthModal || !currentUser) && (
        <AuthModal
          teams={teams}
          hospitals={hospitals}
          shelters={shelters}
          onLogin={handleLogin}
          onRegisterTeam={handleRegisterTeam}
          onClose={currentUser ? () => setShowAuthModal(false) : undefined}
        />
      )}

      {/* FULL-SCREEN RED ALERT SOS OVERLAY */}
      <SosAlertOverlay
        activeSos={activeSos}
        onAcknowledge={(reqId) => {
          setActiveSos(null);
        }}
        onQuickDispatch={async (reqId) => {
          await handleApproveAssignment(reqId);
          setActiveSos(null);
        }}
        onDismiss={() => setActiveSos(null)}
      />

      {/* TOP GLOBAL SYSTEM HEADER */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-md px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Logo & Platform Title */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-red-600/30">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-lg text-white tracking-tight">
                    RescueLink
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-500/30 uppercase tracking-wider">
                    Disaster AI Core
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                  Intelligent Disaster Response & Relief Coordination System
                </p>
              </div>
            </div>

            {/* Live Connection Badge & Audio Chime Tester */}
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  isConnected
                    ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-400"
                    : "bg-amber-950/60 border-amber-500/40 text-amber-400"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? "bg-emerald-400 animate-ping" : "bg-amber-400"
                  }`}
                />
                <span>{isConnected ? "Live SSE" : "Reconnecting"}</span>
              </div>

              <button
                type="button"
                onClick={() => soundManager.playChime("success")}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 border border-slate-700 flex items-center gap-1 transition cursor-pointer"
                title="Test Audio Chime"
              >
                <Volume2 className="w-3 h-3 text-emerald-400" />
                <span className="hidden sm:inline">Chime</span>
              </button>
            </div>
          </div>

          {/* ACTIVE USER PROFILE & ROLE GATEWAY (Requirement 1) */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            {currentUser && (
              <div className="flex items-center gap-2.5 bg-slate-950/90 border border-slate-800 px-3 py-1.5 rounded-2xl">
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black text-white ${
                    currentUser.role === "citizen"
                      ? "bg-red-600"
                      : currentUser.role === "rescue_team"
                      ? "bg-blue-600"
                      : currentUser.role === "hospital"
                      ? "bg-emerald-600"
                      : currentUser.role === "shelter"
                      ? "bg-indigo-600"
                      : "bg-purple-600"
                  }`}
                >
                  {currentUser.role === "citizen" && <User className="w-3.5 h-3.5" />}
                  {currentUser.role === "rescue_team" && <Truck className="w-3.5 h-3.5" />}
                  {currentUser.role === "hospital" && <HospIcon className="w-3.5 h-3.5" />}
                  {currentUser.role === "shelter" && <Tent className="w-3.5 h-3.5" />}
                  {currentUser.role === "admin" && <Shield className="w-3.5 h-3.5" />}
                </div>

                <div className="text-left">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5 leading-tight">
                    <span>{currentUser.name}</span>
                    <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                      {currentUser.role.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono leading-tight truncate max-w-[130px]">
                    {currentUser.unitType || currentUser.facilityName || currentUser.identifier || "Authenticated"}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="ml-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-200 border border-slate-700 transition cursor-pointer"
                  title="Switch Role or Account"
                >
                  Switch
                </button>
              </div>
            )}

            {/* ROLE-BASED ACCESS CONTROL (RBAC) SWITCHER */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 overflow-x-auto">
              <button
                id="role-btn-citizen"
                onClick={() => handleSwitchRoleClick("citizen")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  currentRole === "citizen"
                    ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Citizen</span>
              </button>

              <button
                id="role-btn-rescue-team"
                onClick={() => handleSwitchRoleClick("rescue_team")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  currentRole === "rescue_team"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Rescue Unit</span>
              </button>

              <button
                id="role-btn-hospital"
                onClick={() => handleSwitchRoleClick("hospital")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  currentRole === "hospital"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <HospIcon className="w-3.5 h-3.5" />
                <span>Hospital</span>
              </button>

              <button
                id="role-btn-shelter"
                onClick={() => handleSwitchRoleClick("shelter")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  currentRole === "shelter"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Tent className="w-3.5 h-3.5" />
                <span>Shelter</span>
              </button>

              <button
                id="role-btn-admin"
                onClick={() => handleSwitchRoleClick("admin")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  currentRole === "admin"
                    ? "bg-gradient-to-r from-purple-600 to-rose-600 text-white shadow-md shadow-purple-600/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Control Room</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN VIEWPORT (STRICTLY ROLE-RESTRICTED) */}
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        {currentRole === "citizen" && (
          <CitizenDashboard
            currentUser={currentUser || undefined}
            requests={requests}
            teams={teams}
            hospitals={hospitals}
            shelters={shelters}
            roadBlocks={roadBlocks}
            notifications={notifications}
            onSubmitRequest={handleCreateRequest}
            onTriggerSOS={handleTriggerSos}
            onReportMissing={handleReportMissing}
            onReportRoadblock={handleReportRoadblock}
            onCancelRequest={handleCancelRequest}
            onMarkNotificationRead={handleMarkNotificationRead}
          />
        )}

        {currentRole === "rescue_team" && (
          <RescueTeamDashboard
            currentUser={currentUser || undefined}
            teams={teams}
            requests={requests}
            hospitals={hospitals}
            shelters={shelters}
            roadBlocks={roadBlocks}
            officialUpdates={officialUpdates}
            onUpdateStatus={handleUpdateRescueStatus}
            onToggleTeamAvailability={handleToggleTeamAvailability}
            onReportMissing={handleReportMissing}
            onReportRoadblock={handleReportRoadblock}
          />
        )}

        {currentRole === "hospital" && (
          <HospitalDashboard
            hospitals={hospitals}
            requests={requests}
            onUpdateHospital={handleUpdateHospital}
          />
        )}

        {currentRole === "shelter" && (
          <ShelterDashboard
            shelters={shelters}
            requests={requests}
            missingPersons={missingPersons}
            onUpdateShelter={handleUpdateShelter}
            onRegisterRescued={handleRegisterRescued}
          />
        )}

        {currentRole === "admin" && (
          <AdminControlDashboard
            summary={summary}
            requests={requests}
            teams={teams}
            hospitals={hospitals}
            shelters={shelters}
            roadBlocks={roadBlocks}
            auditLogs={auditLogs}
            missingPersons={missingPersons}
            notifications={notifications}
            onApproveAssignment={handleApproveAssignment}
            onReassignTask={handleReassignTask}
            onClearRoadblock={handleClearRoadblock}
            onTriggerReassessment={handleTriggerReassessment}
            onTriggerSimulation={handleTriggerSimulation}
            onRegisterTeam={handleRegisterTeam}
            onMarkNotificationRead={handleMarkNotificationRead}
          />
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>RescueLink Intelligent Disaster Response System • Privacy-Conscious & Explainable AI</span>
          <span>Role-Based Access: Citizen | Rescue Team | Hospital | Shelter | Control Room</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
