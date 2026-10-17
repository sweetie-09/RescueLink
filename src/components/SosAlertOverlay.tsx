import React, { useEffect, useState } from "react";
import { AlertTriangle, BellOff, CheckCircle2, Flame, MapPin, Radio, ShieldAlert, Users, Volume2 } from "lucide-react";
import { EmergencyRequest } from "../types";
import { soundManager } from "../utils/audioAlert";

interface SosAlertOverlayProps {
  activeSos: EmergencyRequest | null;
  onAcknowledge: (reqId: string) => void;
  onQuickDispatch: (reqId: string) => void;
  onDismiss: () => void;
}

export const SosAlertOverlay: React.FC<SosAlertOverlayProps> = ({
  activeSos,
  onAcknowledge,
  onQuickDispatch,
  onDismiss,
}) => {
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (activeSos) {
      setIsMuted(false);
      // Start siren sound loop automatically
      soundManager.startSiren();
    }
    return () => {
      soundManager.stopSiren();
    };
  }, [activeSos]);

  if (!activeSos) return null;

  const toggleMute = () => {
    if (isMuted) {
      soundManager.startSiren();
      setIsMuted(false);
    } else {
      soundManager.stopSiren();
      setIsMuted(true);
    }
  };

  const handleAcknowledge = () => {
    soundManager.stopSiren();
    setIsMuted(true);
    onAcknowledge(activeSos.id);
  };

  const handleDispatch = () => {
    soundManager.stopSiren();
    setIsMuted(true);
    onQuickDispatch(activeSos.id);
  };

  return (
    <div
      id="sos-red-alert-overlay"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-6 bg-red-950/95 backdrop-blur-md animate-pulse border-8 border-red-600 shadow-[0_0_120px_rgba(239,68,68,0.8)] overflow-y-auto"
    >
      {/* Top Warning Banner */}
      <div className="w-full max-w-4xl bg-red-600 text-white font-black py-2 px-4 rounded-t-xl text-center text-sm sm:text-base uppercase tracking-widest flex items-center justify-center gap-3 animate-bounce">
        <Radio className="w-5 h-5 animate-spin" />
        CRITICAL PRIORITY-1 EMERGENCY DISTRESS TRANSMISSION
        <Radio className="w-5 h-5 animate-spin" />
      </div>

      <div className="w-full max-w-4xl bg-slate-900/95 border-x-4 border-b-4 border-red-600 rounded-b-2xl p-6 sm:p-8 shadow-2xl text-slate-100 flex flex-col gap-6">
        {/* Header Alert Title */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-red-800/60 pb-5">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="w-16 h-16 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-600/50 animate-ping">
              <ShieldAlert className="w-10 h-10" />
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-red-500 text-white tracking-wider">
                  Live SOS Alert
                </span>
                <span className="text-xs text-red-300 font-mono">
                  ID: #{activeSos.id.toUpperCase()}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-red-500 tracking-tight mt-1">
                CITIZEN LIFE SAFETY DISTRESS
              </h1>
            </div>
          </div>

          {/* Sound Toggle Button */}
          <button
            id="btn-toggle-siren-sound"
            onClick={toggleMute}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors border ${
              isMuted
                ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                : "bg-red-600 hover:bg-red-700 text-white border-red-400 shadow-md shadow-red-600/40"
            }`}
          >
            {isMuted ? (
              <>
                <BellOff className="w-4 h-4 text-amber-400" />
                Alarm Muted (Resume)
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 animate-bounce" />
                Mute Continuous Siren
              </>
            )}
          </button>
        </div>

        {/* Incident Summary Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-800/80 border border-red-500/30 rounded-xl p-4 flex flex-col gap-1">
            <div className="text-xs text-red-300 uppercase tracking-wider font-semibold flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-red-400" /> Location / GPS
            </div>
            <div className="font-bold text-slate-100 text-base line-clamp-2">
              {activeSos.location.address}
            </div>
            <div className="text-xs font-mono text-slate-400 mt-1">
              {activeSos.location.lat.toFixed(4)}, {activeSos.location.lng.toFixed(4)}
            </div>
          </div>

          <div className="bg-slate-800/80 border border-red-500/30 rounded-xl p-4 flex flex-col gap-1">
            <div className="text-xs text-red-300 uppercase tracking-wider font-semibold flex items-center gap-1.5">
              <Users className="w-4 h-4 text-red-400" /> People at Risk
            </div>
            <div className="text-2xl font-black text-white">
              {activeSos.peopleAffected} <span className="text-sm font-normal text-slate-300">affected</span>
            </div>
            <div className="text-xs text-amber-300 flex flex-wrap gap-1 mt-1 font-medium">
              {activeSos.vulnerabilities.injured > 0 && (
                <span className="bg-red-950/80 border border-red-500/40 px-1.5 py-0.5 rounded text-red-300">
                  {activeSos.vulnerabilities.injured} Injured
                </span>
              )}
              {activeSos.vulnerabilities.kids > 0 && (
                <span className="bg-amber-950/80 border border-amber-500/40 px-1.5 py-0.5 rounded text-amber-300">
                  {activeSos.vulnerabilities.kids} Children
                </span>
              )}
              {activeSos.vulnerabilities.elderly > 0 && (
                <span className="bg-blue-950/80 border border-blue-500/40 px-1.5 py-0.5 rounded text-blue-300">
                  {activeSos.vulnerabilities.elderly} Elderly
                </span>
              )}
            </div>
          </div>

          <div className="bg-slate-800/80 border border-red-500/30 rounded-xl p-4 flex flex-col gap-1">
            <div className="text-xs text-red-300 uppercase tracking-wider font-semibold flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-red-400" /> AI Urgency Priority
            </div>
            <div className="text-2xl font-black text-red-400 flex items-center gap-2">
              {activeSos.priorityScore} / 100
              <span className="text-xs font-semibold px-2 py-0.5 bg-red-600 text-white rounded">
                MAX CRITICAL
              </span>
            </div>
            <div className="text-xs text-slate-300 line-clamp-2 mt-1">
              {activeSos.scoreBreakdown.aiTriageSummary || "Instantaneous high-threat life safety trigger"}
            </div>
          </div>
        </div>

        {/* AI Recommendation Box */}
        <div className="bg-red-950/40 border border-red-500/40 rounded-xl p-4 text-sm text-slate-200">
          <div className="font-bold text-red-300 mb-1 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            AI Dispatch Recommendation:
          </div>
          <p className="text-slate-200 text-sm">
            {activeSos.teamMatchingExplanation ||
              "Immediate dispatch recommended to closest rapid response unit with trauma medical equipment."}
          </p>
          {activeSos.assignedTeamName && (
            <div className="mt-2 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1.5 rounded-lg inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Target Unit: {activeSos.assignedTeamName} (Est. Arrival: ~{activeSos.etaMinutes || 6} mins)
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          <button
            id="btn-sos-mute-ack"
            onClick={handleAcknowledge}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition"
          >
            Acknowledge & Mute Alarm
          </button>

          <button
            id="btn-sos-quick-dispatch"
            onClick={handleDispatch}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-extrabold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/50 transition flex items-center justify-center gap-2"
          >
            <ShieldAlert className="w-5 h-5" />
            Approve & Dispatch Unit Now
          </button>

          <button
            id="btn-sos-dismiss"
            onClick={onDismiss}
            className="text-xs text-slate-400 hover:text-slate-200 underline px-2 py-1"
          >
            Dismiss Overlay
          </button>
        </div>
      </div>
    </div>
  );
};
