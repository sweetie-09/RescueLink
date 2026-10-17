import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { EmergencyRequest, LocationCoords, RescueTeam, RoadBlock } from "../types";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  MapPin,
  Navigation,
  Shield,
  Truck,
} from "lucide-react";

interface RescueNavigationRouteProps {
  team: RescueTeam;
  request: EmergencyRequest;
  roadBlocks: RoadBlock[];
  onAdvanceStatus?: (status: EmergencyRequest["status"], note?: string) => void;
}

export const RescueNavigationRoute: React.FC<RescueNavigationRouteProps> = ({
  team,
  request,
  roadBlocks,
  onAdvanceStatus,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const startCoord: [number, number] = [team.location.lat, team.location.lng];
  const endCoord: [number, number] = [request.location.lat, request.location.lng];

  // Calculate distance in km
  const distanceKm = Math.max(
    0.6,
    Number(
      (
        Math.sqrt(
          Math.pow((endCoord[0] - startCoord[0]) * 111, 2) +
            Math.pow((endCoord[1] - startCoord[1]) * 111 * Math.cos((startCoord[0] * Math.PI) / 180), 2)
        )
      ).toFixed(1)
    )
  );

  const etaMins = request.etaMinutes || Math.max(3, Math.round(distanceKm * 2.6));

  // Detect nearby roadblocks
  const nearbyRoadblocks = roadBlocks.filter((rb) => {
    if (rb.status !== "active") return false;
    const midLat = (startCoord[0] + endCoord[0]) / 2;
    const midLng = (startCoord[1] + endCoord[1]) / 2;
    const dist = Math.sqrt(
      Math.pow((rb.location.lat - midLat) * 111, 2) +
        Math.pow((rb.location.lng - midLng) * 111, 2)
    );
    return dist < 3.5;
  });

  // Turn-by-turn simulated routing steps
  const routeSteps = [
    {
      instruction: `Depart staging depot at ${team.location.address || "Sector Base"}`,
      distance: "0.4 km",
      time: "1 min",
      type: "depart",
    },
    {
      instruction: `Proceed along Main Access Corridor toward Sector 3 junction`,
      distance: `${(distanceKm * 0.45).toFixed(1)} km`,
      time: `${Math.round(etaMins * 0.4)} mins`,
      type: "continue",
    },
    ...(nearbyRoadblocks.length > 0
      ? [
          {
            instruction: `REROUTE ADVISORY: Detour around ${nearbyRoadblocks[0].roadName} (${nearbyRoadblocks[0].blockageType}) via elevated relief flyover`,
            distance: "0.9 km",
            time: "2 mins",
            type: "warning",
          },
        ]
      : []),
    {
      instruction: `Take tactical access lane toward ${request.location.address}`,
      distance: `${(distanceKm * 0.35).toFixed(1)} km`,
      time: `${Math.round(etaMins * 0.3)} mins`,
      type: "turn",
    },
    {
      instruction: `Arrive at citizen incident site: ${request.rescueType} (${request.peopleAffected} persons affected)`,
      distance: "At destination",
      time: "Immediate",
      type: "arrive",
    },
  ];

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    // Compute route waypoints (introducing slight natural curvature or detour if roadblock exists)
    const midLat = (startCoord[0] + endCoord[0]) / 2 + (nearbyRoadblocks.length > 0 ? 0.003 : 0.001);
    const midLng = (startCoord[1] + endCoord[1]) / 2 + (nearbyRoadblocks.length > 0 ? 0.004 : -0.001);

    const latlngs: [number, number][] = [startCoord, [midLat, midLng], endCoord];

    // Glow background line
    L.polyline(latlngs, {
      color: "#2563eb",
      weight: 8,
      opacity: 0.35,
    }).addTo(map);

    // Dynamic pulsating route polyline
    L.polyline(latlngs, {
      color: "#3b82f6",
      weight: 4,
      dashArray: "8, 8",
    }).addTo(map);

    // Start Team Icon
    const teamIcon = L.divIcon({
      className: "custom-nav-marker",
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-10 h-10 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-600/50 flex items-center justify-center text-lg border-2 border-white ring-4 ring-blue-500/30">
            🚒
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    // End Incident Icon
    const incidentIcon = L.divIcon({
      className: "custom-nav-marker",
      html: `
        <div class="relative flex items-center justify-center">
          <span class="absolute w-12 h-12 rounded-full bg-red-500/40 animate-ping"></span>
          <div class="w-10 h-10 rounded-2xl bg-red-600 text-white shadow-xl shadow-red-600/50 flex items-center justify-center text-lg border-2 border-white relative z-10 font-bold">
            🚨
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    L.marker(startCoord, { icon: teamIcon })
      .bindPopup(
        `<div class="p-1 font-sans text-xs"><strong>${team.name}</strong><br/>Unit: ${team.unitType || "Field Squad"}<br/>Departing origin</div>`
      )
      .addTo(map);

    L.marker(endCoord, { icon: incidentIcon })
      .bindPopup(
        `<div class="p-1 font-sans text-xs"><strong>Target: ${request.rescueType}</strong><br/>${request.location.address}<br/>${request.peopleAffected} People Affected</div>`
      )
      .addTo(map);

    // Render any nearby roadblock markers
    nearbyRoadblocks.forEach((rb) => {
      const rbIcon = L.divIcon({
        className: "custom-nav-marker",
        html: `
          <div class="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center text-xs font-bold border-2 border-white shadow-md">
            🚧
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker([rb.location.lat, rb.location.lng], { icon: rbIcon })
        .bindPopup(
          `<div class="p-1 font-sans text-xs text-amber-600 font-bold">Road Blocked: ${rb.roadName}<br/>(${rb.blockageType})</div>`
        )
        .addTo(map);
    });

    // Fit bounds
    const bounds = L.latLngBounds([startCoord, endCoord, ...nearbyRoadblocks.map((r) => [r.location.lat, r.location.lng] as [number, number])]);
    map.fitBounds(bounds, { padding: [40, 40] });

    mapInstanceRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [team.id, request.id]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
      {/* HUD Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-400">
            <Compass className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
              Live Tactical GPS Navigation
            </span>
            <h4 className="text-base font-black text-white flex items-center gap-2">
              Route to {request.rescueType}
              <span className="text-xs font-medium text-slate-400">
                (Task #{request.id.slice(-6).toUpperCase()})
              </span>
            </h4>
          </div>
        </div>

        {/* ETA & Distance Telemetry */}
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Distance</span>
            <span className="text-sm font-black text-white">{distanceKm} KM</span>
          </div>
          <div className="bg-emerald-950/60 border border-emerald-500/30 px-3.5 py-1.5 rounded-xl text-center">
            <span className="text-[10px] uppercase font-bold text-emerald-400 block">ETA</span>
            <span className="text-base font-black text-emerald-300">~{etaMins} MINS</span>
          </div>
        </div>
      </div>

      {/* Roadblock Warning if applicable */}
      {nearbyRoadblocks.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-3.5 flex items-center gap-3 text-xs text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <strong>Tactical Detour Active:</strong> Roadblock detected on{" "}
            <span className="text-amber-100 font-bold">{nearbyRoadblocks[0].roadName}</span> (
            {nearbyRoadblocks[0].blockageType}). Route automatically bypasses affected sector.
          </div>
        </div>
      )}

      {/* Interactive Leaflet Route Map */}
      <div className="w-full h-72 sm:h-80 rounded-2xl overflow-hidden border border-slate-800 relative z-10">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* Turn-by-Turn Guidance Steps & Action Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Step list */}
        <div className="md:col-span-8 bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-blue-400" />
            Turn-by-Turn Route Guidance
          </h5>
          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {routeSteps.map((step, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-xl border flex items-start gap-3 text-xs ${
                  step.type === "warning"
                    ? "bg-amber-950/40 border-amber-500/40 text-amber-300"
                    : step.type === "arrive"
                    ? "bg-red-950/40 border-red-500/40 text-red-300 font-bold"
                    : "bg-slate-900 border-slate-800/80 text-slate-300"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                    step.type === "warning"
                      ? "bg-amber-500 text-slate-950"
                      : step.type === "arrive"
                      ? "bg-red-500 text-white"
                      : "bg-blue-600 text-white"
                  }`}
                >
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <p>{step.instruction}</p>
                  <span className="text-[10px] text-slate-400 mt-0.5 inline-block">
                    Leg: {step.distance} • Est. {step.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Tactical Actions for Team */}
        <div className="md:col-span-4 bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3">
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Mission Status Control
            </h5>
            <p className="text-xs text-slate-400 mb-3">
              Advance your squad's status to broadcast real-time telemetry to the Control Room and citizen.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {request.status !== "on_the_way" && request.status !== "arrived" && request.status !== "helping" && (
              <button
                type="button"
                onClick={() => onAdvanceStatus?.("on_the_way", "Squad dispatched and navigating to site")}
                className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30"
              >
                <Truck className="w-4 h-4" />
                Commence Navigation (En Route)
              </button>
            )}

            {request.status === "on_the_way" && (
              <button
                type="button"
                onClick={() => onAdvanceStatus?.("arrived", "Arrived at GPS coordinates")}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30"
              >
                <MapPin className="w-4 h-4" />
                Arrived On Scene
              </button>
            )}

            {(request.status === "arrived" || request.status === "helping") && (
              <button
                type="button"
                onClick={() => onAdvanceStatus?.("completed", "Extraction and field stabilization completed")}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
              >
                <CheckCircle2 className="w-4 h-4" />
                Complete Extraction & Rescue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
