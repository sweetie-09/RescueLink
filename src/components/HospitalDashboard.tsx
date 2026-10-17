import React, { useState } from "react";
import {
  EmergencyRequest,
  Hospital,
  HospitalEmergencyStatus,
  HospitalOperatingStatus,
} from "../types";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  HeartPulse,
  Hospital as HospIcon,
  Phone,
  Save,
  ShieldAlert,
  UserCheck,
  Users,
} from "lucide-react";
import { soundManager } from "../utils/audioAlert";

interface HospitalDashboardProps {
  hospitals: Hospital[];
  requests: EmergencyRequest[];
  onUpdateHospital: (hospitalId: string, updates: Partial<Hospital>) => Promise<void>;
}

export const HospitalDashboard: React.FC<HospitalDashboardProps> = ({
  hospitals,
  requests,
  onUpdateHospital,
}) => {
  const [selectedHospId, setSelectedHospId] = useState<string>(
    hospitals.length > 0 ? hospitals[0].id : "hosp-1"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentHospital =
    hospitals.find((h) => h.id === selectedHospId) || hospitals[0];

  // Local form state
  const [availableBeds, setAvailableBeds] = useState<number>(currentHospital?.availableBeds || 0);
  const [totalBeds, setTotalBeds] = useState<number>(currentHospital?.totalBeds || 0);
  const [icuVacancies, setIcuVacancies] = useState<number>(currentHospital?.icuVacancies || 0);
  const [doctorsAvailable, setDoctorsAvailable] = useState<number>(
    currentHospital?.doctorsAvailable || 0
  );
  const [operatingStatus, setOperatingStatus] = useState<HospitalOperatingStatus>(
    currentHospital?.operatingStatus || "Available"
  );
  const [emergencyStatus, setEmergencyStatus] = useState<HospitalEmergencyStatus>(
    currentHospital?.emergencyStatus || "Normal"
  );
  const [contact, setContact] = useState<string>(currentHospital?.contact || "");

  // Update form inputs when selected hospital changes
  const handleSelectHospital = (id: string) => {
    setSelectedHospId(id);
    const h = hospitals.find((item) => item.id === id);
    if (h) {
      setAvailableBeds(h.availableBeds);
      setTotalBeds(h.totalBeds);
      setIcuVacancies(h.icuVacancies);
      setDoctorsAvailable(h.doctorsAvailable);
      setOperatingStatus(h.operatingStatus);
      setEmergencyStatus(h.emergencyStatus);
      setContact(h.contact);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdateHospital(currentHospital.id, {
        availableBeds: Number(availableBeds),
        totalBeds: Number(totalBeds),
        icuVacancies: Number(icuVacancies),
        doctorsAvailable: Number(doctorsAvailable),
        operatingStatus,
        emergencyStatus,
        contact,
      });
      soundManager.playChime("success");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  // Find incoming emergency referrals destined for this hospital or trauma care
  const incomingReferrals = requests.filter(
    (r) =>
      r.status !== "completed" &&
      r.status !== "cancelled" &&
      (r.targetDestinationId === currentHospital?.id ||
        (r.vulnerabilities.injured > 0 && r.status === "helping"))
  );

  return (
    <div id="hospital-dashboard-container" className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Header & Hospital Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-emerald-600/30">
            🏥
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold text-emerald-400">
                Hospital Command & Trauma Bed Desk
              </span>
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                  currentHospital?.operatingStatus === "Available"
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                    : "bg-red-950 text-red-300 border border-red-500/30"
                }`}
              >
                {currentHospital?.operatingStatus}
              </span>
            </div>
            <h1 className="text-2xl font-black text-white">{currentHospital?.name}</h1>
            <p className="text-xs text-slate-400 mt-0.5">{currentHospital?.location.address}</p>
          </div>
        </div>

        {/* Hospital Switcher */}
        <div>
          <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
            Switch Facility
          </label>
          <select
            value={selectedHospId}
            onChange={(e) => handleSelectHospital(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
          >
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.availableBeds} beds free)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Bed & Resource Management Form */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="border-b border-slate-800 pb-4 mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-emerald-400" />
                Live Bed Capacity & Triage Management
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Updates sync in real-time across Control Room and Rescue Ambulances.
              </p>
            </div>
            {saveSuccess && (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 rounded-xl flex items-center gap-1.5 animate-pulse">
                <CheckCircle2 className="w-4 h-4" /> Capacity Saved!
              </span>
            )}
          </div>

          <form onSubmit={handleSave} className="flex flex-col gap-6">
            {/* Bed Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2">
                <label className="text-xs font-bold uppercase text-slate-400">Available General Beds</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={availableBeds}
                    onChange={(e) => setAvailableBeds(Number(e.target.value))}
                    className="w-full text-2xl font-black bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-emerald-400"
                  />
                </div>
                <span className="text-[11px] text-slate-500">Total capacity: {totalBeds}</span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2">
                <label className="text-xs font-bold uppercase text-slate-400">ICU / Ventilator Vacancies</label>
                <input
                  type="number"
                  min={0}
                  value={icuVacancies}
                  onChange={(e) => setIcuVacancies(Number(e.target.value))}
                  className="w-full text-2xl font-black bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-purple-400"
                />
                <span className="text-[11px] text-slate-500">Critical trauma reserve</span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2">
                <label className="text-xs font-bold uppercase text-slate-400">Doctors on Duty</label>
                <input
                  type="number"
                  min={0}
                  value={doctorsAvailable}
                  onChange={(e) => setDoctorsAvailable(Number(e.target.value))}
                  className="w-full text-2xl font-black bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-blue-400"
                />
                <span className="text-[11px] text-slate-500">Active ER & surgery staff</span>
              </div>
            </div>

            {/* Operating Status Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Facility Operating Status
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["Available", "Full", "Damaged", "Closed"] as HospitalOperatingStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setOperatingStatus(st)}
                    className={`py-3 px-2 rounded-xl text-xs font-bold uppercase transition border ${
                      operatingStatus === st
                        ? st === "Available"
                          ? "bg-emerald-600 text-white border-emerald-400"
                          : st === "Full"
                          ? "bg-amber-600 text-white border-amber-400"
                          : "bg-red-600 text-white border-red-400"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Emergency Surge State */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Emergency Services Surge Level
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(["Normal", "Critical Surge", "Diverting"] as HospitalEmergencyStatus[]).map((es) => (
                  <button
                    key={es}
                    type="button"
                    onClick={() => setEmergencyStatus(es)}
                    className={`py-3 px-3 rounded-xl text-xs font-bold transition border ${
                      emergencyStatus === es
                        ? es === "Normal"
                          ? "bg-emerald-600 text-white border-emerald-400"
                          : es === "Critical Surge"
                          ? "bg-amber-600 text-white border-amber-400"
                          : "bg-red-600 text-white border-red-400"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {es}
                  </button>
                ))}
              </div>
            </div>

            {/* Emergency Hotline Contact */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-slate-400" />
                ER Hotline / Radio Contact
              </label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono"
              />
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Broadcasting Capacity..." : "Broadcast Hospital Status to Fleet"}
            </button>
          </form>
        </div>

        {/* Right Column: Incoming Emergency Referrals */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-400" />
                Incoming Emergency Referrals
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">En route patient transfers</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-950 text-red-300 border border-red-500/40">
              {incomingReferrals.length} Inbound
            </span>
          </div>

          <div className="flex flex-col gap-3 overflow-y-auto max-h-[500px]">
            {incomingReferrals.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <span>No pending trauma patient transfers routed to this hospital currently.</span>
              </div>
            ) : (
              incomingReferrals.map((req) => (
                <div
                  key={req.id}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-950 text-red-300 border border-red-500/40">
                      {req.priorityScore >= 80 ? "Urgent Trauma" : "Medical Referral"}
                    </span>
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> ~{req.etaMinutes || 8} mins ETA
                    </span>
                  </div>

                  <div className="font-bold text-sm text-slate-100 mt-1">{req.rescueType}</div>
                  <div className="text-xs text-slate-400">{req.location.address}</div>

                  <div className="grid grid-cols-2 gap-2 mt-1 bg-slate-900/80 p-2 rounded-xl text-xs">
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold">Injured Count</span>
                      <div className="font-black text-red-400">
                        {req.vulnerabilities.injured} Patients ({req.peopleAffected} total)
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold">Transfer Squad</span>
                      <div className="font-semibold text-slate-200 truncate">
                        {req.assignedTeamName || "Ambulance Squad"}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
