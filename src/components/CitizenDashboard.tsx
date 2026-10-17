import React, { useState } from "react";
import {
  AuthUser,
  EmergencyRequest,
  HazardType,
  Hospital,
  LocationCoords,
  MissingPersonMatchNotification,
  RescueTeam,
  RoadBlock,
  Shelter,
  VulnerableCounts,
} from "../types";
import { DisasterMap } from "./DisasterMap";
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Baby,
  Bell,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Crosshair,
  HeartHandshake,
  HeartPulse,
  HelpCircle,
  Hospital as HospIcon,
  Loader2,
  MapPin,
  Minus,
  Navigation,
  PhoneCall,
  Plus,
  Radio,
  Search,
  Shield,
  Tent,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { soundManager } from "../utils/audioAlert";

interface CitizenDashboardProps {
  currentUser?: AuthUser;
  requests: EmergencyRequest[];
  teams: RescueTeam[];
  hospitals: Hospital[];
  shelters: Shelter[];
  roadBlocks: RoadBlock[];
  notifications?: MissingPersonMatchNotification[];
  onSubmitRequest: (payload: any) => Promise<EmergencyRequest>;
  onTriggerSOS: (payload: any) => Promise<EmergencyRequest>;
  onReportMissing: (payload: any) => Promise<void>;
  onReportRoadblock: (payload: any) => Promise<void>;
  onCancelRequest: (reqId: string) => Promise<void>;
  onMarkNotificationRead?: (id: string) => Promise<void>;
}

// Contextual Rescue Types dynamically indexed by Hazard Type
const RESCUE_OPTIONS_MAP: Record<HazardType, string[]> = {
  Flood: [
    "People Stranded / Trapped in Water",
    "Need Boat Rescue",
    "Medical Emergency",
    "Need Shelter",
    "Food & Water Needed",
    "Other",
  ],
  Fire: [
    "People Trapped",
    "Evacuation Needed",
    "Medical Emergency due to Fire",
    "Fire Spreading / Need Firefighting Support",
    "Other",
  ],
  Earthquake: [
    "People Trapped under Debris",
    "Medical Emergency",
    "Evacuation",
    "Structural Assessment Needed",
    "Other",
  ],
  "Building Collapse": [
    "People Trapped under Debris",
    "Medical Emergency",
    "Evacuation",
    "Structural Assessment Needed",
    "Other",
  ],
  Landslide: [
    "Road Cutoff / Buried Area",
    "People Trapped under Mud/Debris",
    "Evacuation Needed",
    "Medical Emergency",
    "Other",
  ],
  Cyclone: [
    "Severe Roof / Structural Damage",
    "Downed Power Lines / Fallen Hazards",
    "Evacuation / High Winds Trap",
    "Medical Emergency",
    "Other",
  ],
  Other: [
    "Immediate Rescue",
    "Medical Evacuation",
    "Food & Clean Water Supply",
    "Shelter Transport",
    "Other Emergency",
  ],
};

export const CitizenDashboard: React.FC<CitizenDashboardProps> = ({
  currentUser,
  requests,
  teams,
  hospitals,
  shelters,
  roadBlocks,
  notifications = [],
  onSubmitRequest,
  onTriggerSOS,
  onReportMissing,
  onReportRoadblock,
  onCancelRequest,
  onMarkNotificationRead,
}) => {
  const [activeTab, setActiveTab] = useState<
    "emergency" | "tracking" | "missing" | "alerts" | "roadblock" | "resources"
  >("emergency");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>({});
  const [myRequestId, setMyRequestId] = useState<string | null>(() => {
    // Pick the most recent citizen request if exists
    return requests.length > 0 ? requests[0].id : null;
  });

  // Filter notifications relevant to this citizen's phone or all if testing
  const relevantNotifications = notifications.filter((n) => {
    if (!currentUser?.contact) return true;
    const cleanUser = currentUser.contact.replace(/\D/g, "");
    const cleanNotif = (n.reporterPhone || "").replace(/\D/g, "");
    return (
      !cleanNotif ||
      cleanNotif === cleanUser ||
      cleanNotif.includes(cleanUser) ||
      cleanUser.includes(cleanNotif)
    );
  });

  const activeAlertBanner = relevantNotifications.find(
    (n) => !n.read && !dismissedAlerts[n.id]
  );

  // Emergency Form State - EXACT ORDER REQUIRED
  // 1. Hazard Type (mandatory)
  const [hazardType, setHazardType] = useState<HazardType>("Flood");
  // 2. Rescue Type (dynamic based on Hazard Type)
  const [rescueType, setRescueType] = useState<string>(RESCUE_OPTIONS_MAP["Flood"][0]);
  // 3. Location (map picker + GPS)
  const [location, setLocation] = useState<LocationCoords>({
    lat: 13.0827,
    lng: 80.265,
    address: "14 Riverbend Flats, Ground Floor Submerged",
  });
  // 4. Number of people affected
  const [peopleAffected, setPeopleAffected] = useState<number>(4);
  // 5. Vulnerable counts (Elderly, Pregnant, Impaired, Kids, Injured) - prominent
  const [vulnerabilities, setVulnerabilities] = useState<VulnerableCounts>({
    elderly: 1,
    pregnant: 0,
    impaired: 0,
    kids: 1,
    injured: 1,
  });
  // 6. Description
  const [description, setDescription] = useState<string>("");
  const [reporterName, setReporterName] = useState(currentUser?.name || "");
  const [reporterContact, setReporterContact] = useState(currentUser?.contact || "");

  // Missing Person Form State
  const [mpName, setMpName] = useState("");
  const [mpAge, setMpAge] = useState<number | "">("");
  const [mpGender, setMpGender] = useState("Male");
  const [mpLastSeen, setMpLastSeen] = useState("");
  const [mpFeatures, setMpFeatures] = useState("");
  const [mpMarks, setMpMarks] = useState("");
  const [mpReporterName, setMpReporterName] = useState("");
  const [mpReporterPhone, setMpReporterPhone] = useState("");
  const [missingSubmitted, setMissingSubmitted] = useState(false);

  // Roadblock Form State
  const [rbRoadName, setRbRoadName] = useState("");
  const [rbType, setRbType] = useState<RoadBlock["blockageType"]>("Flooded");
  const [rbDescription, setRbDescription] = useState("");
  const [rbReportedBy, setRbReportedBy] = useState("");
  const [roadblockSubmitted, setRoadblockSubmitted] = useState(false);

  // Handle Hazard Type change: dynamically updates Rescue Type dropdown
  const handleHazardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newHazard = e.target.value as HazardType;
    setHazardType(newHazard);
    const options = RESCUE_OPTIONS_MAP[newHazard] || RESCUE_OPTIONS_MAP["Other"];
    setRescueType(options[0]);
  };

  // GPS auto-locate
  const handleDetectGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            address: `GPS Location (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`,
          });
          soundManager.playChime("success");
        },
        () => {
          // Fallback if permission denied in iframe
          setLocation({
            lat: 13.0835,
            lng: 80.268,
            address: "Detected Disaster Coordinate: Sector 3 Lowland",
          });
        }
      );
    }
  };

  // Trigger SOS button
  const handleSosClick = async () => {
    if (sosLoading) return;
    setSosLoading(true);
    try {
      soundManager.playChime("alert");
      const sosReq = await onTriggerSOS({
        location,
        description: "DIRECT CITIZEN SOS DISTRESS TRIGGERED! Immediate rescue required.",
        reporterContact: reporterContact || "GPS Mobile Link",
      });
      setMyRequestId(sosReq.id);
      setActiveTab("tracking");
    } catch (err) {
      console.error("SOS trigger error:", err);
    } finally {
      setSosLoading(false);
    }
  };

  // Submit Emergency Request Form
  const handleSubmitEmergencyForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      soundManager.playChime("success");
      const created = await onSubmitRequest({
        hazardType,
        rescueType,
        location,
        peopleAffected,
        vulnerabilities,
        description,
        reporterName,
        reporterContact,
      });
      setMyRequestId(created.id);
      setActiveTab("tracking");
    } catch (err) {
      console.error("Form submit error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Missing Person
  const handleSubmitMissing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mpName || !mpAge) return;
    setIsSubmitting(true);
    try {
      await onReportMissing({
        name: mpName,
        age: Number(mpAge),
        gender: mpGender,
        lastSeenLocation: mpLastSeen,
        lastSeenCoordinates: { lat: location.lat, lng: location.lng },
        physicalFeatures: mpFeatures,
        identificationMarks: mpMarks,
        reporterName: mpReporterName || "Family Member",
        reporterPhone: mpReporterPhone || "Confidential",
      });
      setMissingSubmitted(true);
      setMpName("");
      setMpAge("");
      setMpFeatures("");
      setMpMarks("");
      soundManager.playChime("success");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Roadblock
  const handleSubmitRoadblock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rbRoadName) return;
    setIsSubmitting(true);
    try {
      await onReportRoadblock({
        roadName: rbRoadName,
        location: { lat: location.lat, lng: location.lng },
        blockageType: rbType,
        description: rbDescription,
        reportedBy: rbReportedBy || "Citizen Reporter",
      });
      setRoadblockSubmitted(true);
      setRbRoadName("");
      setRbDescription("");
      soundManager.playChime("success");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Active tracked request
  const currentRequest = requests.find((r) => r.id === myRequestId) || requests[0];
  const assignedTeam = teams.find((t) => t.id === currentRequest?.assignedTeamId);

  return (
    <div id="citizen-dashboard-container" className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Top Banner with Prominent SOS Button & Quick Stats */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex flex-col gap-2 text-center md:text-left z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/60 border border-red-500/40 text-red-300 text-xs font-bold uppercase tracking-wider w-fit mx-auto md:mx-0">
            <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
            Active Emergency Response Area
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Citizen Emergency & Relief Portal
          </h1>
          <p className="text-slate-400 text-sm">
            Press the emergency SOS button for immediate life safety distress, or submit a detailed rescue request with automatic AI triage and team dispatch.
          </p>
        </div>

        {/* PROMINENT SOS BUTTON */}
        <div className="z-10 flex flex-col items-center">
          <button
            id="btn-prominent-sos"
            onClick={handleSosClick}
            disabled={sosLoading}
            className="group relative flex flex-col items-center justify-center w-36 h-36 sm:w-40 sm:h-40 rounded-full bg-gradient-to-tr from-red-700 via-red-600 to-rose-500 text-white shadow-[0_0_50px_rgba(239,68,68,0.7)] hover:shadow-[0_0_70px_rgba(239,68,68,0.9)] hover:scale-105 active:scale-95 transition-all duration-200 border-4 border-red-400 cursor-pointer disabled:opacity-75"
          >
            {/* Pulsing ring */}
            <span className="absolute -inset-2 rounded-full border-2 border-red-500 animate-ping opacity-60 pointer-events-none" />
            <AlertOctagon className="w-10 h-10 sm:w-12 sm:h-12 mb-1 group-hover:animate-spin transition" />
            <span className="text-2xl sm:text-3xl font-black tracking-widest drop-shadow-md">
              SOS
            </span>
            <span className="text-[10px] sm:text-xs uppercase tracking-wider font-extrabold text-red-100">
              Press For Life Distress
            </span>
          </button>
          <span className="text-[11px] text-slate-400 mt-2 font-medium">
            Broadcasts red alert + alarm directly to Control Room
          </span>
        </div>

        {/* Subtle background glow */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* MISSING PERSON MATCH NOTIFICATION BANNER (Real-time Shelter Match Alert) */}
      {activeAlertBanner && (
        <div className="bg-gradient-to-r from-emerald-950/90 via-slate-900 to-teal-950/90 border-2 border-emerald-500 rounded-3xl p-6 shadow-2xl relative animate-pulse flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center text-2xl font-black shrink-0 shadow-lg shadow-emerald-500/50">
              🎉
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold uppercase tracking-wider">
                  Missing Person Located & Safe!
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(activeAlertBanner.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <h3 className="text-xl font-black text-white mt-1">
                {activeAlertBanner.missingPersonName} has been found in a relief shelter!
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                <strong>Current Shelter:</strong> {activeAlertBanner.shelterName} ({activeAlertBanner.shelterAddress})
                <br />
                <strong>Physical Condition:</strong>{" "}
                <span className="text-emerald-400 font-bold">{activeAlertBanner.physicalCondition}</span>
                <br />
                <strong>Shelter Contact:</strong> {activeAlertBanner.shelterContact}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            <a
              href={`tel:${activeAlertBanner.shelterContact}`}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/30"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              Call Shelter Now
            </a>
            <button
              onClick={() => {
                if (onMarkNotificationRead) onMarkNotificationRead(activeAlertBanner.id);
                setDismissedAlerts((prev) => ({ ...prev, [activeAlertBanner.id]: true }));
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Acknowledge
            </button>
            <button
              onClick={() => setDismissedAlerts((prev) => ({ ...prev, [activeAlertBanner.id]: true }))}
              className="p-2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
        <button
          id="tab-emergency-form"
          onClick={() => setActiveTab("emergency")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition ${
            activeTab === "emergency"
              ? "bg-red-600 text-white shadow-md shadow-red-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Request Rescue Form
        </button>

        <button
          id="tab-live-tracking"
          onClick={() => setActiveTab("tracking")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition ${
            activeTab === "tracking"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Navigation className="w-4 h-4" />
          Live Request Tracking {currentRequest && `(#${currentRequest.id.slice(-4)})`}
        </button>

        <button
          id="tab-report-missing"
          onClick={() => setActiveTab("missing")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition ${
            activeTab === "missing"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Search className="w-4 h-4" />
          Report Missing Person
        </button>

        <button
          id="tab-tracing-alerts"
          onClick={() => setActiveTab("alerts")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition ${
            activeTab === "alerts"
              ? "bg-teal-600 text-white shadow-md shadow-teal-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Bell className="w-4 h-4" />
          Tracing Alerts ({relevantNotifications.length})
        </button>

        <button
          id="tab-report-roadblock"
          onClick={() => setActiveTab("roadblock")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition ${
            activeTab === "roadblock"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <span>🚧</span>
          Report Road Block
        </button>

        <button
          id="tab-hospitals-shelters"
          onClick={() => setActiveTab("resources")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition ${
            activeTab === "resources"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <HospIcon className="w-4 h-4" />
          Nearest Hospitals & Shelters
        </button>
      </div>

      {/* TAB CONTENT: 1. EMERGENCY REQUEST FORM (EXACT FIELD ORDER) */}
      {activeTab === "emergency" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
            <div className="border-b border-slate-800 pb-4 mb-6">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Emergency Rescue Request Form
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Fields are processed immediately by the AI Prioritization Engine. No manual severity input is needed; the AI calculates urgency from your inputs.
              </p>
            </div>

            <form onSubmit={handleSubmitEmergencyForm} className="flex flex-col gap-6">
              {/* FIELD 1: HAZARD TYPE (MANDATORY, FIRST FIELD) */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center justify-between">
                  <span>1. Hazard Type * (Mandatory)</span>
                  <span className="text-[11px] font-normal text-slate-400">AI calculates severity</span>
                </label>
                <select
                  id="select-hazard-type"
                  value={hazardType}
                  onChange={handleHazardChange}
                  required
                  className="w-full bg-slate-950 border-2 border-red-500/40 rounded-xl px-4 py-3 text-slate-100 font-semibold focus:border-red-500 focus:outline-none transition"
                >
                  <option value="Flood">Flood</option>
                  <option value="Fire">Fire</option>
                  <option value="Earthquake">Earthquake</option>
                  <option value="Landslide">Landslide</option>
                  <option value="Cyclone">Cyclone</option>
                  <option value="Building Collapse">Building Collapse</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* FIELD 2: RESCUE TYPE (DYNAMIC DROPDOWN) */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                  <span>2. Rescue Type *</span>
                  <span className="text-[11px] text-blue-400">Contextual to {hazardType}</span>
                </label>
                <select
                  id="select-rescue-type"
                  value={rescueType}
                  onChange={(e) => setRescueType(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 font-semibold focus:border-blue-500 focus:outline-none transition"
                >
                  {(RESCUE_OPTIONS_MAP[hazardType] || RESCUE_OPTIONS_MAP["Other"]).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* FIELD 3: LOCATION (MAP PICKER + GPS) */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    3. Location (Map Picker + GPS) *
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectGPS}
                    className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-950/60 border border-blue-600/40"
                  >
                    <Crosshair className="w-3.5 h-3.5" /> Detect My GPS
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={location.address}
                  onChange={(e) => setLocation({ ...location, address: e.target.value })}
                  placeholder="Street address, landmark, floor, or building identifier..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:border-blue-500 focus:outline-none"
                />
                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                  <span>Coordinates:</span>
                  <span className="font-mono text-slate-300">
                    {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </span>
                  <span className="text-slate-500">• (Use interactive map to refine pin)</span>
                </div>
              </div>

              {/* FIELD 4: NUMBER OF PEOPLE AFFECTED */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-400" />
                  4. Number of People Affected *
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPeopleAffected(Math.max(1, peopleAffected - 1))}
                    className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-100 font-bold border border-slate-700"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={peopleAffected}
                    onChange={(e) => setPeopleAffected(Math.max(1, Number(e.target.value)))}
                    className="w-24 text-center font-black text-xl bg-slate-950 border border-slate-700 rounded-xl py-2 text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setPeopleAffected(peopleAffected + 1)}
                    className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-100 font-bold border border-slate-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-slate-400">Total individuals requiring assistance</span>
                </div>
              </div>

              {/* FIELD 5: VULNERABLE COUNTS (PROMINENT COUNTERS) */}
              <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-950/70 border border-amber-500/30">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <label className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <HeartPulse className="w-4 h-4 text-red-400" />
                    5. Vulnerable Counts (High Priority Weight × 35) *
                  </label>
                  <span className="text-[11px] text-amber-300 font-semibold">Heavily impacts AI priority</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {/* Injured */}
                  <div className="bg-red-950/30 border border-red-500/40 rounded-xl p-2.5 flex flex-col items-center">
                    <span className="text-xs font-bold text-red-300 flex items-center gap-1">
                      <HeartPulse className="w-3.5 h-3.5 text-red-400" /> Injured
                    </span>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() =>
                          setVulnerabilities({
                            ...vulnerabilities,
                            injured: Math.max(0, vulnerabilities.injured - 1),
                          })
                        }
                        className="w-7 h-7 rounded-lg bg-red-900/60 text-white font-bold flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <span className="font-mono font-black text-lg text-white w-6 text-center">
                        {vulnerabilities.injured}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setVulnerabilities({
                            ...vulnerabilities,
                            injured: vulnerabilities.injured + 1,
                          })
                        }
                        className="w-7 h-7 rounded-lg bg-red-900/60 text-white font-bold flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Pregnant */}
                  <div className="bg-pink-950/30 border border-pink-500/40 rounded-xl p-2.5 flex flex-col items-center">
                    <span className="text-xs font-bold text-pink-300 flex items-center gap-1">
                      <Baby className="w-3.5 h-3.5 text-pink-400" /> Pregnant
                    </span>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() =>
                          setVulnerabilities({
                            ...vulnerabilities,
                            pregnant: Math.max(0, vulnerabilities.pregnant - 1),
                          })
                        }
                        className="w-7 h-7 rounded-lg bg-pink-900/60 text-white font-bold flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <span className="font-mono font-black text-lg text-white w-6 text-center">
                        {vulnerabilities.pregnant}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setVulnerabilities({
                            ...vulnerabilities,
                            pregnant: vulnerabilities.pregnant + 1,
                          })
                        }
                        className="w-7 h-7 rounded-lg bg-pink-900/60 text-white font-bold flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Kids */}
                  <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-2.5 flex flex-col items-center">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-amber-400" /> Kids (&lt;12)
                    </span>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() =>
                          setVulnerabilities({
                            ...vulnerabilities,
                            kids: Math.max(0, vulnerabilities.kids - 1),
                          })
                        }
                        className="w-7 h-7 rounded-lg bg-amber-900/60 text-white font-bold flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <span className="font-mono font-black text-lg text-white w-6 text-center">
                        {vulnerabilities.kids}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setVulnerabilities({
                            ...vulnerabilities,
                            kids: vulnerabilities.kids + 1,
                          })
                        }
                        className="w-7 h-7 rounded-lg bg-amber-900/60 text-white font-bold flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Elderly */}
                  <div className="bg-blue-950/30 border border-blue-500/40 rounded-xl p-2.5 flex flex-col items-center">
                    <span className="text-xs font-bold text-blue-300 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-blue-400" /> Elderly (60+)
                    </span>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() =>
                          setVulnerabilities({
                            ...vulnerabilities,
                            elderly: Math.max(0, vulnerabilities.elderly - 1),
                          })
                        }
                        className="w-7 h-7 rounded-lg bg-blue-900/60 text-white font-bold flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <span className="font-mono font-black text-lg text-white w-6 text-center">
                        {vulnerabilities.elderly}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setVulnerabilities({
                            ...vulnerabilities,
                            elderly: vulnerabilities.elderly + 1,
                          })
                        }
                        className="w-7 h-7 rounded-lg bg-blue-900/60 text-white font-bold flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Impaired */}
                  <div className="bg-purple-950/30 border border-purple-500/40 rounded-xl p-2.5 flex flex-col items-center col-span-2 sm:col-span-1">
                    <span className="text-xs font-bold text-purple-300 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-purple-400" /> Impaired / Mobility
                    </span>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() =>
                          setVulnerabilities({
                            ...vulnerabilities,
                            impaired: Math.max(0, vulnerabilities.impaired - 1),
                          })
                        }
                        className="w-7 h-7 rounded-lg bg-purple-900/60 text-white font-bold flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <span className="font-mono font-black text-lg text-white w-6 text-center">
                        {vulnerabilities.impaired}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setVulnerabilities({
                            ...vulnerabilities,
                            impaired: vulnerabilities.impaired + 1,
                          })
                        }
                        className="w-7 h-7 rounded-lg bg-purple-900/60 text-white font-bold flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* FIELD 6: DESCRIPTION (ADDITIONAL DETAILS) */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  6. Description (Additional Situation Details)
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe trapped location, water depth, smoke severity, structural hazards, accessibility constraints..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-100 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Optional Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Reporter Name (Optional)</label>
                  <input
                    type="text"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    placeholder="Your name or caller name"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Contact Phone (Optional)</label>
                  <input
                    type="text"
                    value={reporterContact}
                    onChange={(e) => setReporterContact(e.target.value)}
                    placeholder="Phone number for rescue team callback"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                id="btn-submit-emergency-request"
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-base shadow-lg shadow-red-600/40 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Calculating Priority & Dispatching...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5" />
                    Submit Emergency Request to AI Dispatch
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Live Map & Coordinates Pinning */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  Interactive Map Pin Picker
                </h3>
                <span className="text-[11px] text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-600/30">
                  Click map to adjust pin
                </span>
              </div>
              <div className="h-[420px]">
                <DisasterMap
                  requests={requests}
                  teams={teams}
                  hospitals={hospitals}
                  shelters={shelters}
                  roadBlocks={roadBlocks}
                  selectedLocation={location}
                  onSelectLocation={(loc) => {
                    setLocation({
                      lat: loc.lat,
                      lng: loc.lng,
                      address: `Pinned Location (${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)})`,
                    });
                    soundManager.playChime("warning");
                  }}
                  center={[location.lat, location.lng]}
                />
              </div>
            </div>

            {/* Quick Safety Checklist */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400">
              <div className="font-bold text-slate-200 mb-1 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-400" /> Immediate Safety Tips
              </div>
              <ul className="list-disc pl-4 space-y-1">
                <li>Move upward to higher floors if floodwaters are rising; do not climb into closed attics without roof access.</li>
                <li>Stay away from fallen power cables and turbulent standing flood currents.</li>
                <li>Conserve mobile phone battery and keep flashlight signaling ready.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 2. LIVE REQUEST TRACKING */}
      {activeTab === "tracking" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 flex flex-col gap-6">
            {currentRequest ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase ${
                          currentRequest.isSOS
                            ? "bg-red-600 text-white animate-pulse"
                            : "bg-blue-600 text-white"
                        }`}
                      >
                        {currentRequest.isSOS ? "SOS Beacon" : currentRequest.hazardType}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Incident #{currentRequest.id.toUpperCase()}
                      </span>
                    </div>
                    <h2 className="text-2xl font-black text-white mt-1">
                      {currentRequest.rescueType}
                    </h2>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-400" />
                      {currentRequest.location.address}
                    </p>
                  </div>

                  {/* Status badge */}
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      Current Dispatch Status
                    </span>
                    <span className="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mt-1">
                      {currentRequest.status.replace("_", " ")}
                    </span>
                  </div>
                </div>

                {/* Status Progression Stepper */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-3">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Response Progression
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                    {[
                      { key: "pending_review", label: "AI Triaged" },
                      { key: "assigned", label: "Dispatched" },
                      { key: "on_the_way", label: "En Route" },
                      { key: "arrived", label: "On Scene" },
                      { key: "completed", label: "Rescued" },
                    ].map((step, idx) => {
                      const stages = ["pending_review", "assigned", "accepted", "on_the_way", "arrived", "helping", "completed"];
                      const currentIdx = stages.indexOf(currentRequest.status);
                      const stepIdx = stages.indexOf(step.key);
                      const isDone = currentIdx >= stepIdx;
                      const isCurrent = currentRequest.status === step.key;

                      return (
                        <div
                          key={step.key}
                          className={`p-2 rounded-xl border flex flex-col items-center gap-1 ${
                            isCurrent
                              ? "bg-blue-600/30 border-blue-500 text-blue-300 font-bold animate-pulse"
                              : isDone
                              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400 font-semibold"
                              : "bg-slate-900 border-slate-800 text-slate-600"
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                              isDone ? "bg-emerald-500 text-slate-950 font-black" : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {isDone ? "✓" : idx + 1}
                          </div>
                          <span className="text-[11px]">{step.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Assigned Team & ETA Box */}
                {currentRequest.assignedTeamName ? (
                  <div className="bg-slate-950/80 border border-blue-500/40 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xl shadow-lg">
                        🚒
                      </div>
                      <div>
                        <div className="text-xs text-blue-300 uppercase tracking-wider font-semibold">
                          Assigned Rescue Unit
                        </div>
                        <div className="text-base font-black text-white">
                          {currentRequest.assignedTeamName}
                        </div>
                        {assignedTeam && (
                          <div className="text-xs text-slate-400">
                            Leader: {assignedTeam.leader} • {assignedTeam.vehicleType}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-start sm:items-end">
                      <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-emerald-400" /> Estimated Arrival
                      </div>
                      <div className="text-2xl font-black text-emerald-400">
                        ~{currentRequest.etaMinutes || 8} Mins
                      </div>
                      <div className="text-[10px] text-slate-500">Live GPS tracking active</div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-300 flex items-center gap-3">
                    <Clock className="w-5 h-5 animate-spin text-amber-400 shrink-0" />
                    <div>
                      <strong>Awaiting Control Room Dispatch Approval</strong>
                      <p className="text-slate-400 mt-0.5">
                        The AI engine has pre-matched candidate teams. A Control Room commander is authorizing dispatch.
                      </p>
                    </div>
                  </div>
                )}

                {/* Clean Citizen Operational Guidance (Clean Citizen Tracking UI) */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      Live Response Status & Guidance
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                      Active Telemetry
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Your distress broadcast and GPS coordinates are active on the central control board. Emergency responders are prioritizing your immediate safety. Please remain at your reported location if safe to do so, and use a flashlight or whistle to signal incoming crews.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400 border-t border-slate-800/80">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-400" /> Continuous Control Room Sync
                    </span>
                    <span className="flex items-center gap-1">
                      <PhoneCall className="w-3.5 h-3.5 text-red-400" /> Emergency Hotline: 112 / 911
                    </span>
                  </div>
                </div>

                {/* Target Destination (Hospital or Shelter) */}
                {currentRequest.targetDestinationName && (
                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                        Designated Safe Destination
                      </span>
                      <div className="font-bold text-slate-200 text-sm flex items-center gap-1.5 mt-0.5">
                        {currentRequest.targetDestinationType === "hospital" ? "🏥" : "⛺"}{" "}
                        {currentRequest.targetDestinationName}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-semibold capitalize">
                      {currentRequest.targetDestinationType}
                    </span>
                  </div>
                )}

                {/* Cancel Request Button */}
                {currentRequest.status !== "completed" && currentRequest.status !== "cancelled" && (
                  <div className="border-t border-slate-800 pt-4 flex justify-end">
                    <button
                      id="btn-cancel-citizen-request"
                      onClick={() => onCancelRequest(currentRequest.id)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-950/60 border border-red-500/30 transition flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancel Request (If Safe / Rescued Independently)
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400 flex flex-col items-center gap-3">
                <AlertCircle className="w-8 h-8 text-slate-500" />
                <p>No active emergency requests tracked under your current session.</p>
                <button
                  onClick={() => setActiveTab("emergency")}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold"
                >
                  Create Emergency Request
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Live Incident Tracking Map */}
          <div className="lg:col-span-5 h-[560px]">
            <DisasterMap
              requests={requests}
              teams={teams}
              hospitals={hospitals}
              shelters={shelters}
              roadBlocks={roadBlocks}
              highlightedRequestId={currentRequest?.id}
              center={
                currentRequest
                  ? [currentRequest.location.lat, currentRequest.location.lng]
                  : [13.0827, 80.265]
              }
              zoom={14}
            />
          </div>
        </div>
      )}

      {/* TAB CONTENT: TRACING ALERTS (Missing Person Matches) */}
      {activeTab === "alerts" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-teal-400" />
                Missing Person Reunion & Shelter Alerts
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Automated matching alerts when individuals reported missing are identified and accommodated in relief shelters.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-teal-950 text-teal-300 border border-teal-500/30">
              {relevantNotifications.length} Alert{relevantNotifications.length === 1 ? "" : "s"}
            </span>
          </div>

          {relevantNotifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-950/60 rounded-2xl border border-slate-800 flex flex-col items-center gap-2">
              <Search className="w-8 h-8 text-slate-600 mb-1" />
              <p className="text-sm font-semibold">No missing person matches reported yet.</p>
              <p className="text-xs text-slate-500 max-w-md">
                As relief camp workers register rescued citizens across shelters, our facial and demographic identification engine runs continuous cross-matching.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {relevantNotifications.map((notif) => (
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
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                          Match Confirmed
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
                          <strong>Accommodated at:</strong> {notif.shelterName}
                        </div>
                        <div>
                          <strong>Address:</strong> {notif.shelterAddress}
                        </div>
                        <div>
                          <strong>Physical Condition:</strong>{" "}
                          <span className="text-emerald-400 font-bold">{notif.physicalCondition}</span>
                        </div>
                        <div>
                          <strong>Camp Phone:</strong> {notif.shelterContact}
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
                      Contact Camp
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

      {/* TAB CONTENT: 3. REPORT MISSING PERSON */}
      {activeTab === "missing" && (
        <div className="max-w-2xl mx-auto w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="border-b border-slate-800 pb-4 mb-6">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-purple-400" />
              Report Missing Person
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Information is broadcast to search squads and automatically cross-matched with rescued rosters in shelters.
            </p>
          </div>

          {missingSubmitted ? (
            <div className="p-6 bg-purple-950/30 border border-purple-500/40 rounded-2xl flex flex-col items-center text-center gap-3">
              <CheckCircle2 className="w-12 h-12 text-purple-400" />
              <h3 className="text-lg font-bold text-white">Missing Person Report Logged</h3>
              <p className="text-xs text-slate-300 max-w-md">
                Our automated cross-matcher is checking shelter intake feeds. If an individual matching these features is located in any relief hub, you will be notified.
              </p>
              <button
                onClick={() => setMissingSubmitted(false)}
                className="mt-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500"
              >
                Submit Another Report
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmitMissing} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300">Person's Full Name *</label>
                  <input
                    type="text"
                    required
                    value={mpName}
                    onChange={(e) => setMpName(e.target.value)}
                    placeholder="e.g. Leo Sharma"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-300">Age *</label>
                    <input
                      type="number"
                      required
                      value={mpAge}
                      onChange={(e) => setMpAge(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="Age"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300">Gender *</label>
                    <select
                      value={mpGender}
                      onChange={(e) => setMpGender(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-purple-500 focus:outline-none"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Last Seen Location *</label>
                <input
                  type="text"
                  required
                  value={mpLastSeen}
                  onChange={(e) => setMpLastSeen(e.target.value)}
                  placeholder="e.g. Riverfront Park near playground during evacuation"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Physical Features & Clothing</label>
                <textarea
                  rows={2}
                  value={mpFeatures}
                  onChange={(e) => setMpFeatures(e.target.value)}
                  placeholder="Height, hair color, clothing, spectacles, walking aid, jacket color..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Identification Marks</label>
                <input
                  type="text"
                  value={mpMarks}
                  onChange={(e) => setMpMarks(e.target.value)}
                  placeholder="Scars, distinctive birthmarks, tattoos, medical implants..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800 pt-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">Reporter's Name *</label>
                  <input
                    type="text"
                    required
                    value={mpReporterName}
                    onChange={(e) => setMpReporterName(e.target.value)}
                    placeholder="Your Name (Parent/Relative)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Reporter Phone *</label>
                  <input
                    type="tel"
                    required
                    value={mpReporterPhone}
                    onChange={(e) => setMpReporterPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 mt-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Publish Missing Person Alert
              </button>
            </form>
          )}
        </div>
      )}

      {/* TAB CONTENT: 4. REPORT ROAD BLOCK */}
      {activeTab === "roadblock" && (
        <div className="max-w-2xl mx-auto w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="border-b border-slate-800 pb-4 mb-6">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <span>🚧</span> Report Road Block or Transit Obstruction
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Reporting impassable roads allows the AI engine to reroute ambulances and boat transports safely around bottlenecks.
            </p>
          </div>

          {roadblockSubmitted ? (
            <div className="p-6 bg-amber-950/30 border border-amber-500/40 rounded-2xl flex flex-col items-center text-center gap-3">
              <CheckCircle2 className="w-12 h-12 text-amber-400" />
              <h3 className="text-lg font-bold text-white">Road Obstruction Registered</h3>
              <p className="text-xs text-slate-300 max-w-md">
                Disaster management has flagged this segment. The AI engine is automatically rerouting rescue units.
              </p>
              <button
                onClick={() => setRoadblockSubmitted(false)}
                className="mt-2 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-500"
              >
                Report Another Road Block
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmitRoadblock} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-300">Road / Avenue Name *</label>
                <input
                  type="text"
                  required
                  value={rbRoadName}
                  onChange={(e) => setRbRoadName(e.target.value)}
                  placeholder="e.g. Grand River Expressway near Bridge"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300">Blockage Type *</label>
                  <select
                    value={rbType}
                    onChange={(e) => setRbType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="Flooded">Flooded (Standing Water)</option>
                    <option value="Debris / Rubble">Debris / Structural Rubble</option>
                    <option value="Fallen Trees">Fallen Trees</option>
                    <option value="Landslide">Landslide / Mudflow</option>
                    <option value="Collapsed Bridge">Collapsed Bridge</option>
                    <option value="Active Fire">Active Fire</option>
                    <option value="Power Lines Down">Power Lines Down</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">Your Name / Agency</label>
                  <input
                    type="text"
                    value={rbReportedBy}
                    onChange={(e) => setRbReportedBy(e.target.value)}
                    placeholder="Citizen / Volunteer / Driver"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Description of Obstruction</label>
                <textarea
                  rows={3}
                  value={rbDescription}
                  onChange={(e) => setRbDescription(e.target.value)}
                  placeholder="Water depth, impassable vehicle types, alternate dirt detour available..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 mt-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>🚧</span>}
                Broadcast Road Block to Fleet
              </button>
            </form>
          )}
        </div>
      )}

      {/* TAB CONTENT: 5. NEAREST HOSPITALS & SHELTERS */}
      {activeTab === "resources" && (
        <div className="flex flex-col gap-6">
          {/* Hospitals Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <HospIcon className="w-5 h-5 text-blue-400" />
                Nearest Hospitals & Trauma Care
              </h2>
              <span className="text-xs text-slate-400">Live Vacancy Feed</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {hospitals.map((hosp) => (
                <div
                  key={hosp.id}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-slate-700 transition"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-100 text-sm">{hosp.name}</h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          hosp.operatingStatus === "Available"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                            : "bg-red-950 text-red-300 border border-red-500/40"
                        }`}
                      >
                        {hosp.operatingStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {hosp.location.address}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-2.5 rounded-xl text-xs">
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold">Available Beds</span>
                      <div className="font-black text-emerald-400 text-base">
                        {hosp.availableBeds} <span className="text-slate-500 text-xs font-normal">/ {hosp.totalBeds}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold">ICU Vacancies</span>
                      <div className="font-black text-purple-400 text-base">{hosp.icuVacancies}</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold">Doctors</span>
                      <div className="font-semibold text-slate-200">{hosp.doctorsAvailable} On Duty</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold">Emergency</span>
                      <div className="font-semibold text-amber-400">{hosp.emergencyStatus}</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 pt-1 border-t border-slate-800/80 flex items-center justify-between">
                    <span>Emergency Hotline:</span>
                    <span className="font-mono text-slate-200">{hosp.contact}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shelters Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Tent className="w-5 h-5 text-indigo-400" />
                Nearest Relief Shelters & Evacuation Centers
              </h2>
              <span className="text-xs text-slate-400">Rations & Capacity Status</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {shelters.map((shelter) => (
                <div
                  key={shelter.id}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-slate-700 transition"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-100 text-sm">{shelter.name}</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                        {shelter.operatingStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {shelter.location.address}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-2.5 rounded-xl text-xs">
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold">Vacancies</span>
                      <div className="font-black text-emerald-400 text-base">{shelter.vacancies}</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold">Occupancy</span>
                      <div className="font-bold text-slate-300">
                        {shelter.currentOccupancy} / {shelter.totalCapacity}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold">Food Rations</span>
                      <div className="font-semibold text-amber-400">{shelter.foodDaysRemaining} Days</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold">Clean Water</span>
                      <div className="font-semibold text-blue-400">{shelter.waterSupplyLitres} Litres</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 pt-1 border-t border-slate-800/80 flex items-center justify-between">
                    <span>Relief Desk:</span>
                    <span className="font-mono text-slate-200">{shelter.contact}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
