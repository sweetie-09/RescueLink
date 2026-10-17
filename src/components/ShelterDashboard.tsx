import React, { useState } from "react";
import {
  EmergencyRequest,
  MissingPerson,
  RescuedPerson,
  Shelter,
  ShelterOperatingStatus,
} from "../types";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Droplets,
  HeartHandshake,
  Package,
  Plus,
  Save,
  Search,
  Tent,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { soundManager } from "../utils/audioAlert";

interface ShelterDashboardProps {
  shelters: Shelter[];
  requests: EmergencyRequest[];
  missingPersons: MissingPerson[];
  onUpdateShelter: (shelterId: string, updates: Partial<Shelter>) => Promise<void>;
  onRegisterRescued: (shelterId: string, payload: any) => Promise<RescuedPerson>;
}

export const ShelterDashboard: React.FC<ShelterDashboardProps> = ({
  shelters,
  requests,
  missingPersons,
  onUpdateShelter,
  onRegisterRescued,
}) => {
  const [selectedShelterId, setSelectedShelterId] = useState<string>(
    shelters.length > 0 ? shelters[0].id : "shelter-1"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentShelter =
    shelters.find((s) => s.id === selectedShelterId) || shelters[0];

  // Local capacity & supply form
  const [totalCapacity, setTotalCapacity] = useState(currentShelter?.totalCapacity || 500);
  const [currentOccupancy, setCurrentOccupancy] = useState(currentShelter?.currentOccupancy || 320);
  const [foodDaysRemaining, setFoodDaysRemaining] = useState(currentShelter?.foodDaysRemaining || 4);
  const [waterSupplyLitres, setWaterSupplyLitres] = useState(currentShelter?.waterSupplyLitres || 4200);
  const [operatingStatus, setOperatingStatus] = useState<ShelterOperatingStatus>(
    currentShelter?.operatingStatus || "Available"
  );
  const [contact, setContact] = useState(currentShelter?.contact || "");

  // Rescued Person Intake Form
  const [intakeName, setIntakeName] = useState("");
  const [intakeAge, setIntakeAge] = useState<number | "">("");
  const [intakeGender, setIntakeGender] = useState("Male");
  const [intakeFoundLoc, setIntakeFoundLoc] = useState("");
  const [intakeFeatures, setIntakeFeatures] = useState("");
  const [intakeMarks, setIntakeMarks] = useState("");
  const [intakeCondition, setIntakeCondition] = useState<RescuedPerson["healthCondition"]>("Stable");
  const [intakeSubmitting, setIntakeSubmitting] = useState(false);
  const [intakeSuccessMatch, setIntakeSuccessMatch] = useState<string | null>(null);

  const handleSelectShelter = (id: string) => {
    setSelectedShelterId(id);
    const s = shelters.find((item) => item.id === id);
    if (s) {
      setTotalCapacity(s.totalCapacity);
      setCurrentOccupancy(s.currentOccupancy);
      setFoodDaysRemaining(s.foodDaysRemaining);
      setWaterSupplyLitres(s.waterSupplyLitres);
      setOperatingStatus(s.operatingStatus);
      setContact(s.contact);
    }
  };

  const handleSaveCapacity = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdateShelter(currentShelter.id, {
        totalCapacity: Number(totalCapacity),
        currentOccupancy: Number(currentOccupancy),
        foodDaysRemaining: Number(foodDaysRemaining),
        waterSupplyLitres: Number(waterSupplyLitres),
        operatingStatus,
        contact,
      });
      soundManager.playChime("success");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntakeSubmitting(true);
    try {
      const person = await onRegisterRescued(currentShelter.id, {
        name: intakeName || "Unknown Citizen",
        approximateAge: Number(intakeAge) || 30,
        gender: intakeGender,
        foundLocation: intakeFoundLoc || "Extracted by field rescue squad",
        physicalFeatures: intakeFeatures,
        identificationMarks: intakeMarks,
        healthCondition: intakeCondition,
      });

      if (person.matchedMissingPersonId) {
        soundManager.playChime("alert");
        const matchedProfile = missingPersons.find(
          (m) => m.id === person.matchedMissingPersonId
        );
        setIntakeSuccessMatch(
          matchedProfile?.name || "Matched with Missing Person Report!"
        );
      } else {
        soundManager.playChime("success");
        setIntakeSuccessMatch(null);
      }

      // Reset intake form
      setIntakeName("");
      setIntakeAge("");
      setIntakeFeatures("");
      setIntakeMarks("");
      setIntakeFoundLoc("");
    } finally {
      setIntakeSubmitting(false);
    }
  };

  // Incoming referrals destined for this shelter
  const incomingEvacuees = requests.filter(
    (r) =>
      r.status !== "completed" &&
      r.status !== "cancelled" &&
      r.targetDestinationId === currentShelter?.id
  );

  return (
    <div id="shelter-dashboard-container" className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Header & Shelter Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-indigo-600/30">
            ⛺
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold text-indigo-400">
                Relief Shelter & Evacuee Station
              </span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                {currentShelter?.operatingStatus}
              </span>
            </div>
            <h1 className="text-2xl font-black text-white">{currentShelter?.name}</h1>
            <p className="text-xs text-slate-400 mt-0.5">{currentShelter?.location.address}</p>
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
            Switch Relief Center
          </label>
          <select
            value={selectedShelterId}
            onChange={(e) => handleSelectShelter(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:border-indigo-500 focus:outline-none"
          >
            {shelters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.vacancies} vacancies)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Shelter Supplies & Capacity Form */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="border-b border-slate-800 pb-4 mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Tent className="w-5 h-5 text-indigo-400" />
                Capacity & Relief Supply Logistics
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Calculates live vacancy and ration burn rates.
              </p>
            </div>
            {saveSuccess && (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 rounded-xl flex items-center gap-1.5 animate-pulse">
                <CheckCircle2 className="w-4 h-4" /> Updated!
              </span>
            )}
          </div>

          <form onSubmit={handleSaveCapacity} className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-1">
                <label className="text-xs font-bold uppercase text-slate-400">Total Capacity</label>
                <input
                  type="number"
                  min={1}
                  value={totalCapacity}
                  onChange={(e) => setTotalCapacity(Number(e.target.value))}
                  className="text-2xl font-black bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-white"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-1">
                <label className="text-xs font-bold uppercase text-slate-400">Current Occupancy</label>
                <input
                  type="number"
                  min={0}
                  value={currentOccupancy}
                  onChange={(e) => setCurrentOccupancy(Number(e.target.value))}
                  className="text-2xl font-black bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-indigo-400"
                />
                <span className="text-[11px] text-emerald-400 font-semibold">
                  Vacancies: {Math.max(0, totalCapacity - currentOccupancy)} Available
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-1">
                <label className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-amber-400" /> Food Rations
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={foodDaysRemaining}
                    onChange={(e) => setFoodDaysRemaining(Number(e.target.value))}
                    className="text-2xl font-black bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-amber-400"
                  />
                  <span className="text-xs text-slate-400">Days</span>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-1">
                <label className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5 text-blue-400" /> Clean Water
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={waterSupplyLitres}
                    onChange={(e) => setWaterSupplyLitres(Number(e.target.value))}
                    className="text-2xl font-black bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-blue-400"
                  />
                  <span className="text-xs text-slate-400">Litres</span>
                </div>
              </div>
            </div>

            {/* Operating status */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Operating Status
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(["Available", "Full", "Damaged", "Closed"] as ShelterOperatingStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setOperatingStatus(st)}
                    className={`py-3 px-2 rounded-xl text-xs font-bold uppercase transition border ${
                      operatingStatus === st
                        ? "bg-indigo-600 text-white border-indigo-400"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Update Shelter Resources
            </button>
          </form>

          {/* Incoming Evacuees Referrals List */}
          <div className="mt-8 border-t border-slate-800 pt-5">
            <h3 className="font-bold text-white text-sm mb-3 flex items-center justify-between">
              <span>Incoming Evacuee Transports</span>
              <span className="text-xs text-indigo-400 font-semibold">{incomingEvacuees.length} In Transit</span>
            </h3>
            <div className="space-y-2">
              {incomingEvacuees.length === 0 ? (
                <p className="text-xs text-slate-500">No incoming groups assigned to this shelter currently.</p>
              ) : (
                incomingEvacuees.map((item) => (
                  <div key={item.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs flex justify-between items-center">
                    <div>
                      <span className="font-bold text-white">{item.rescueType}</span>
                      <p className="text-[11px] text-slate-400">{item.peopleAffected} persons via {item.assignedTeamName}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 text-[10px] font-bold">
                      ~{item.etaMinutes || 10}m ETA
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Rescued / Unknown Persons Intake & Biometric Matching */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col gap-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-purple-400" />
              Rescued & Unknown Person Intake
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Registers arrived individuals. The AI automatically cross-references missing-person inquiries.
            </p>
          </div>

          {/* Biometric Cross-Match Banner */}
          {intakeSuccessMatch && (
            <div className="p-4 bg-purple-950/80 border-2 border-purple-500 rounded-2xl flex items-center gap-3 animate-bounce">
              <Search className="w-6 h-6 text-purple-300 shrink-0" />
              <div>
                <span className="text-xs font-black uppercase text-purple-300">
                  ⚡ INSTANT BIOMETRIC MATCH FOUND!
                </span>
                <p className="text-xs text-white mt-0.5">
                  Rescued individual matched family inquiry: <strong>{intakeSuccessMatch}</strong>. Family notified.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleIntakeSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-300">Name / Given Identity</label>
                <input
                  type="text"
                  value={intakeName}
                  onChange={(e) => setIntakeName(e.target.value)}
                  placeholder="Name or 'Unknown Male / Female'"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-300">Approx. Age</label>
                  <input
                    type="number"
                    value={intakeAge}
                    onChange={(e) => setIntakeAge(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="e.g. 35"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Gender</label>
                  <select
                    value={intakeGender}
                    onChange={(e) => setIntakeGender(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300">Found / Extracted Location</label>
              <input
                type="text"
                value={intakeFoundLoc}
                onChange={(e) => setIntakeFoundLoc(e.target.value)}
                placeholder="Sector 3 flooded avenue, rooftop rescue, etc."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300">
                Physical Features & Clothing Description * (Used for cross-match)
              </label>
              <textarea
                rows={2}
                required
                value={intakeFeatures}
                onChange={(e) => setIntakeFeatures(e.target.value)}
                placeholder="e.g. Gray hair, blue polo shirt, wire spectacles, height approx 5ft 8in..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-300">Identification Marks</label>
                <input
                  type="text"
                  value={intakeMarks}
                  onChange={(e) => setIntakeMarks(e.target.value)}
                  placeholder="Scars, birthmarks, wristband..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Health Condition</label>
                <select
                  value={intakeCondition}
                  onChange={(e) => setIntakeCondition(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                >
                  <option value="Stable">Stable</option>
                  <option value="Injured">Injured (First Aid Given)</option>
                  <option value="Critical">Critical (Refer to Hospital)</option>
                  <option value="Dehydrated">Dehydrated / Mild Shock</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={intakeSubmitting}
              className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <UserCheck className="w-4 h-4" />
              {intakeSubmitting ? "Cross-Matching..." : "Register Intake & Cross-Match Missing Records"}
            </button>
          </form>

          {/* Rescued Roster in This Shelter */}
          <div className="border-t border-slate-800 pt-4">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Current Shelter Rescued Roster</span>
              <span className="text-slate-400">({currentShelter.rescuedPersons?.length || 0} Registered)</span>
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(currentShelter.rescuedPersons || []).map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-slate-200">{p.name}</span>
                    <span className="text-slate-500 text-[10px] ml-2">
                      {p.approximateAge} yrs • {p.gender} • {p.healthCondition}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{p.physicalFeatures}</p>
                  </div>
                  {p.matchedMissingPersonId && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-950 text-purple-300 border border-purple-500/40">
                      Family Matched
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
