import React, { useState } from "react";
import { AuthUser, Hospital, RescueTeam, RescueUnitType, Shelter, UserRole } from "../types";
import {
  Building2,
  CheckCircle2,
  HeartHandshake,
  Hospital as HospIcon,
  KeyRound,
  Lock,
  PlusCircle,
  Radio,
  Shield,
  ShieldAlert,
  Tent,
  Truck,
  User,
  Users,
  X,
} from "lucide-react";
import { soundManager } from "../utils/audioAlert";

interface AuthModalProps {
  teams: RescueTeam[];
  hospitals: Hospital[];
  shelters: Shelter[];
  onLogin: (user: AuthUser) => void;
  onRegisterTeam: (data: {
    name: string;
    unitType: RescueUnitType;
    leader: string;
    contact: string;
    vehicleType: string;
  }) => Promise<RescueTeam>;
  onClose?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  teams,
  hospitals,
  shelters,
  onLogin,
  onRegisterTeam,
  onClose,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>("citizen");

  // Citizen inputs
  const [citizenName, setCitizenName] = useState("Sweety Muddana");
  const [citizenPhone, setCitizenPhone] = useState("+1 (555) 234-8901");

  // Rescue Team inputs
  const [rescueUnitType, setRescueUnitType] = useState<RescueUnitType>("NDRF");
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id || "");
  const [isRegisteringTeam, setIsRegisteringTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamLeader, setNewTeamLeader] = useState("");
  const [newTeamContact, setNewTeamContact] = useState("+1 (555) 789-0123");
  const [newTeamVehicle, setNewTeamVehicle] = useState("NDRF Heavy All-Terrain Rescue Vehicle");

  // Hospital inputs
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>(hospitals[0]?.id || "");
  const [hospitalOfficer, setHospitalOfficer] = useState("Dr. R. V. Sharma (Chief Trauma)");

  // Shelter inputs
  const [selectedShelterId, setSelectedShelterId] = useState<string>(shelters[0]?.id || "");
  const [shelterOfficer, setShelterOfficer] = useState("Officer Meera Patel (Camp Incharge)");

  // Control Room inputs
  const [adminOfficerId, setAdminOfficerId] = useState("DISASTER-CHIEF-01");
  const [adminPasscode, setAdminPasscode] = useState("COMMAND-CLEARANCE-ALPHA");

  const filteredTeams = teams.filter(
    (t) => !rescueUnitType || t.unitType === rescueUnitType
  );

  const handleCitizenLogin = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playChime("success");
    onLogin({
      id: `user-cit-${Date.now()}`,
      role: "citizen",
      name: citizenName.trim() || "Citizen User",
      identifier: citizenPhone.trim() || "+1 (555) 019-2831",
      contact: citizenPhone.trim() || "+1 (555) 019-2831",
      loginTime: Date.now(),
      token: `tok-cit-${Date.now()}`,
    });
  };

  const handleRescueLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegisteringTeam) {
      if (!newTeamName.trim() || !newTeamLeader.trim()) return;
      soundManager.playChime("success");
      const created = await onRegisterTeam({
        name: newTeamName.trim(),
        unitType: rescueUnitType,
        leader: newTeamLeader.trim(),
        contact: newTeamContact.trim(),
        vehicleType: newTeamVehicle.trim(),
      });
      onLogin({
        id: `user-res-${created.id}`,
        role: "rescue_team",
        name: `${created.name} (${created.unitType})`,
        identifier: created.id,
        unitType: created.unitType,
        contact: created.contact,
        loginTime: Date.now(),
        token: `tok-res-${Date.now()}`,
      });
    } else {
      const chosenTeam = teams.find((t) => t.id === selectedTeamId) || filteredTeams[0] || teams[0];
      if (!chosenTeam) return;
      soundManager.playChime("success");
      onLogin({
        id: `user-res-${chosenTeam.id}`,
        role: "rescue_team",
        name: `${chosenTeam.name} (${chosenTeam.unitType || "Field Unit"})`,
        identifier: chosenTeam.id,
        unitType: chosenTeam.unitType || rescueUnitType,
        contact: chosenTeam.contact,
        loginTime: Date.now(),
        token: `tok-res-${Date.now()}`,
      });
    }
  };

  const handleHospitalLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const hosp = hospitals.find((h) => h.id === selectedHospitalId) || hospitals[0];
    soundManager.playChime("success");
    onLogin({
      id: `user-hosp-${hosp.id}`,
      role: "hospital",
      name: hospitalOfficer,
      identifier: hosp.id,
      facilityId: hosp.id,
      facilityName: hosp.name,
      contact: hosp.contact,
      loginTime: Date.now(),
      token: `tok-hosp-${Date.now()}`,
    });
  };

  const handleShelterLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const shelt = shelters.find((s) => s.id === selectedShelterId) || shelters[0];
    soundManager.playChime("success");
    onLogin({
      id: `user-shelt-${shelt.id}`,
      role: "shelter",
      name: shelterOfficer,
      identifier: shelt.id,
      facilityId: shelt.id,
      facilityName: shelt.name,
      contact: shelt.contact,
      loginTime: Date.now(),
      token: `tok-shelt-${Date.now()}`,
    });
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playChime("success");
    onLogin({
      id: `user-admin-${Date.now()}`,
      role: "admin",
      name: `Command Officer (${adminOfficerId})`,
      identifier: adminOfficerId,
      loginTime: Date.now(),
      token: `tok-admin-${Date.now()}`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-950/80 via-slate-900 to-slate-900 border-b border-slate-800 p-6 sm:p-8 text-center relative">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center text-white mx-auto shadow-xl shadow-red-600/30 mb-3">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Lock className="w-3.5 h-3.5" />
            Role-Based Access Control (RBAC) Gateway
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            RescueLink Disaster Command
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md mx-auto">
            Select your assigned role to access your authorized dashboard with strict credential isolation.
          </p>
        </div>

        {/* Role Selection Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-3 bg-slate-950 border-b border-slate-800">
          {[
            { role: "citizen", label: "Citizen", icon: User, color: "text-red-400" },
            { role: "rescue_team", label: "Rescue Unit", icon: Truck, color: "text-blue-400" },
            { role: "hospital", label: "Hospital", icon: HospIcon, color: "text-emerald-400" },
            { role: "shelter", label: "Shelter", icon: Tent, color: "text-indigo-400" },
            { role: "admin", label: "Control Room", icon: Shield, color: "text-purple-400" },
          ].map((item) => {
            const Icon = item.icon;
            const isSelected = selectedRole === item.role;
            return (
              <button
                key={item.role}
                type="button"
                onClick={() => setSelectedRole(item.role as UserRole)}
                className={`flex flex-col items-center gap-1.5 p-2.5 rounded-2xl transition text-center ${
                  isSelected
                    ? "bg-slate-800 border border-slate-700 shadow-md"
                    : "hover:bg-slate-900/60 text-slate-400 hover:text-slate-200"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    isSelected ? "bg-red-600 text-white" : "bg-slate-900 " + item.color
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-[11px] font-bold ${isSelected ? "text-white" : "text-slate-400"}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Form Container */}
        <div className="p-6 sm:p-8">
          {/* 1. CITIZEN LOGIN */}
          {selectedRole === "citizen" && (
            <form onSubmit={handleCitizenLogin} className="flex flex-col gap-4">
              <div className="bg-red-950/30 border border-red-500/30 rounded-2xl p-4 text-xs text-red-200 flex items-center gap-3">
                <Shield className="w-5 h-5 text-red-400 shrink-0" />
                <div>
                  <strong>Citizen & Evacuee Access:</strong> Report emergencies, trigger real-time SOS beacons, monitor live response milestones, and track missing family members.
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  Citizen / Reporter Name
                </label>
                <input
                  type="text"
                  required
                  value={citizenName}
                  onChange={(e) => setCitizenName(e.target.value)}
                  placeholder="e.g. Sweety Muddana"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  Primary Mobile Number / Alert Contact
                </label>
                <input
                  type="text"
                  required
                  value={citizenPhone}
                  onChange={(e) => setCitizenPhone(e.target.value)}
                  placeholder="e.g. +1 (555) 234-8901"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-red-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Automated missing person reunion alerts & shelter match notifications will be routed to this number.
                </span>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 cursor-pointer"
              >
                <User className="w-4 h-4" />
                Access Citizen Dashboard
              </button>
            </form>
          )}

          {/* 2. RESCUE TEAM TERMINAL LOGIN */}
          {selectedRole === "rescue_team" && (
            <form onSubmit={handleRescueLogin} className="flex flex-col gap-4">
              <div className="bg-blue-950/30 border border-blue-500/30 rounded-2xl p-4 text-xs text-blue-200 flex items-center gap-3">
                <Truck className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <strong>Targeted Unit Routing:</strong> Select your unit category (NDRF, Paramedic, Task Force, etc.). Tasks will be dispatched strictly to your unit.
                </div>
              </div>

              {/* Unit Category Selector */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                  1. Unit Specialization Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["NDRF", "Paramedic", "Task Force", "Fire & Hazmat", "Water Rescue", "Quick Response"] as RescueUnitType[]).map(
                    (ut) => (
                      <button
                        key={ut}
                        type="button"
                        onClick={() => {
                          setRescueUnitType(ut);
                          const matching = teams.filter((t) => t.unitType === ut);
                          if (matching.length > 0) setSelectedTeamId(matching[0].id);
                        }}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition ${
                          rescueUnitType === ut
                            ? "bg-blue-600 border-blue-500 text-white shadow-md"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        {ut}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Toggle Register New vs Existing */}
              <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  2. Squad Identity
                </label>
                <button
                  type="button"
                  onClick={() => setIsRegisteringTeam(!isRegisteringTeam)}
                  className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  {isRegisteringTeam ? "Choose Existing Unit" : "+ Register New Active Unit"}
                </button>
              </div>

              {isRegisteringTeam ? (
                <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Squad Name</label>
                    <input
                      type="text"
                      required
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder={`e.g. ${rescueUnitType} Alpha Strike Unit`}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Squad Commander</label>
                      <input
                        type="text"
                        required
                        value={newTeamLeader}
                        onChange={(e) => setNewTeamLeader(e.target.value)}
                        placeholder="Leader Name"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Radio / Phone</label>
                      <input
                        type="text"
                        required
                        value={newTeamContact}
                        onChange={(e) => setNewTeamContact(e.target.value)}
                        placeholder="+1 (555) 789-0123"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Deployment Vehicle</label>
                    <input
                      type="text"
                      value={newTeamVehicle}
                      onChange={(e) => setNewTeamVehicle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    Select Active Registered Squad ({filteredTeams.length} available)
                  </label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    {filteredTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} • {t.unitType || "Field"} • Leader: {t.leader} ({t.status.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                className="w-full mt-2 py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 cursor-pointer"
              >
                <Truck className="w-4 h-4" />
                {isRegisteringTeam ? "Register & Launch Terminal" : "Launch Rescue Operations Terminal"}
              </button>
            </form>
          )}

          {/* 3. HOSPITAL LOGIN */}
          {selectedRole === "hospital" && (
            <form onSubmit={handleHospitalLogin} className="flex flex-col gap-4">
              <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 text-xs text-emerald-200 flex items-center gap-3">
                <HospIcon className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <strong>Trauma Center Coordination:</strong> Manage emergency ICU capacity, accept incoming paramedic transfers, and log surgical bed availability.
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  Select Hospital / Trauma Center
                </label>
                <select
                  value={selectedHospitalId}
                  onChange={(e) => setSelectedHospitalId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.availableBeds} beds free • {h.icuAvailable} ICU)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  Medical Officer on Duty
                </label>
                <input
                  type="text"
                  required
                  value={hospitalOfficer}
                  onChange={(e) => setHospitalOfficer(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
              >
                <HospIcon className="w-4 h-4" />
                Access Hospital Operations
              </button>
            </form>
          )}

          {/* 4. SHELTER LOGIN */}
          {selectedRole === "shelter" && (
            <form onSubmit={handleShelterLogin} className="flex flex-col gap-4">
              <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-2xl p-4 text-xs text-indigo-200 flex items-center gap-3">
                <Tent className="w-5 h-5 text-indigo-400 shrink-0" />
                <div>
                  <strong>Relief Camp & Intake Management:</strong> Register rescued individuals, update relief bed vacancies, and trigger automated missing person reunion matches.
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  Select Relief Shelter / Camp
                </label>
                <select
                  value={selectedShelterId}
                  onChange={(e) => setSelectedShelterId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  {shelters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.vacancies} vacancies • {s.waterFoodSupplyDays} days supply)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  Shelter Coordinator / Officer
                </label>
                <input
                  type="text"
                  required
                  value={shelterOfficer}
                  onChange={(e) => setShelterOfficer(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                <Tent className="w-4 h-4" />
                Access Shelter Relief Operations
              </button>
            </form>
          )}

          {/* 5. CONTROL ROOM COMMANDER LOGIN */}
          {selectedRole === "admin" && (
            <form onSubmit={handleAdminLogin} className="flex flex-col gap-4">
              <div className="bg-purple-950/30 border border-purple-500/30 rounded-2xl p-4 text-xs text-purple-200 flex items-center gap-3">
                <Shield className="w-5 h-5 text-purple-400 shrink-0" />
                <div>
                  <strong>High-Clearance Authority:</strong> Full tactical oversight, AI priority queue overrides, live missing person feeds, fleet tracking, and reassessment loops.
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  Commander Clearance ID
                </label>
                <input
                  type="text"
                  required
                  value={adminOfficerId}
                  onChange={(e) => setAdminOfficerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  Security Passcode
                </label>
                <input
                  type="password"
                  required
                  value={adminPasscode}
                  onChange={(e) => setAdminPasscode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 cursor-pointer"
              >
                <Shield className="w-4 h-4" />
                Authorize & Enter Control Room
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
