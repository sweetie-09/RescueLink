import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  EmergencyRequest,
  Hospital,
  LocationCoords,
  RescueTeam,
  RoadBlock,
  Shelter,
} from "../types";
import { Filter, Layers, Navigation } from "lucide-react";

// Fix standard Leaflet default icon path issues in bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface DisasterMapProps {
  requests?: EmergencyRequest[];
  teams?: RescueTeam[];
  hospitals?: Hospital[];
  shelters?: Shelter[];
  roadBlocks?: RoadBlock[];
  selectedLocation?: { lat: number; lng: number } | null;
  onSelectLocation?: (loc: { lat: number; lng: number }) => void;
  center?: [number, number];
  zoom?: number;
  highlightedRequestId?: string;
}

export const DisasterMap: React.FC<DisasterMapProps> = ({
  requests = [],
  teams = [],
  hospitals = [],
  shelters = [],
  roadBlocks = [],
  selectedLocation,
  onSelectLocation,
  center = [13.0827, 80.265],
  zoom = 13,
  highlightedRequestId,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const tempMarkerRef = useRef<L.Marker | null>(null);

  const [visibleLayers, setVisibleLayers] = useState({
    incidents: true,
    teams: true,
    hospitals: true,
    shelters: true,
    roadBlocks: true,
  });

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center,
      zoom,
      zoomControl: true,
    });

    // OpenStreetMap background tiles (no CARTO API key required)
    L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        maxZoom: 19,
      }
    ).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    // Click handler for location picker
    if (onSelectLocation) {
      map.on("click", (e: L.LeafletMouseEvent) => {
        onSelectLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
    }

    // Force map dimensions recalculation
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update center when center prop shifts
  useEffect(() => {
    if (mapInstanceRef.current && center) {
      mapInstanceRef.current.setView(center, zoom);
    }
  }, [center[0], center[1], zoom]);

  // Render Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;
    const lg = layerGroupRef.current;
    lg.clearLayers();

    // 1. Render Roadblocks (hazard circles & barriers)
    if (visibleLayers.roadBlocks) {
      for (const rb of roadBlocks) {
        if (rb.status !== "active") continue;

        const barrierIcon = L.divIcon({
          className: "custom-roadblock-marker",
          html: `
            <div class="relative flex items-center justify-center">
              <div class="w-8 h-8 rounded-full bg-amber-600 border-2 border-white shadow-lg flex items-center justify-center text-white font-black text-xs">
                🚧
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([rb.location.lat, rb.location.lng], {
          icon: barrierIcon,
        });

        marker.bindPopup(`
          <div class="p-2 text-slate-900 font-sans">
            <div class="font-bold text-sm text-red-600 flex items-center gap-1">
              🚧 Roadblock: ${rb.blockageType}
            </div>
            <div class="font-semibold text-xs mt-1">${rb.roadName}</div>
            <div class="text-xs text-slate-600 mt-1">${rb.description}</div>
            <div class="mt-2 text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded inline-block">
              Severity: ${rb.severity.replace("_", " ")}
            </div>
          </div>
        `);

        // Draw danger zone radius
        const dangerCircle = L.circle([rb.location.lat, rb.location.lng], {
          radius: 350,
          color: "#f59e0b",
          fillColor: "#fbbf24",
          fillOpacity: 0.25,
          weight: 1.5,
          dashArray: "4, 4",
        });

        lg.addLayer(dangerCircle);
        lg.addLayer(marker);
      }
    }

    // 2. Render Hospitals
    if (visibleLayers.hospitals) {
      for (const hosp of hospitals) {
        const isFull = hosp.operatingStatus === "Full" || hosp.availableBeds === 0;
        const colorClass = isFull ? "bg-red-600" : "bg-emerald-600";

        const hospIcon = L.divIcon({
          className: "custom-hosp-marker",
          html: `
            <div class="w-8 h-8 rounded-xl ${colorClass} border-2 border-white shadow-lg flex items-center justify-center text-white font-black text-sm">
              🏥
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([hosp.location.lat, hosp.location.lng], {
          icon: hospIcon,
        });

        marker.bindPopup(`
          <div class="p-2 text-slate-900 font-sans">
            <div class="font-bold text-sm text-blue-700">🏥 ${hosp.name}</div>
            <div class="text-xs text-slate-600 mt-0.5">${hosp.location.address}</div>
            <div class="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-200 text-xs">
              <div>Available Beds: <strong class="text-emerald-700">${hosp.availableBeds}</strong> / ${hosp.totalBeds}</div>
              <div>ICU Vacancies: <strong class="text-purple-700">${hosp.icuVacancies}</strong></div>
              <div>Doctors on Duty: <strong>${hosp.doctorsAvailable}</strong></div>
              <div>Emergency: <strong class="${isFull ? "text-red-600" : "text-emerald-600"}">${hosp.emergencyStatus}</strong></div>
            </div>
            <div class="mt-2 text-xs text-slate-500">📞 ${hosp.contact}</div>
          </div>
        `);

        lg.addLayer(marker);
      }
    }

    // 3. Render Shelters
    if (visibleLayers.shelters) {
      for (const shelter of shelters) {
        const shelterIcon = L.divIcon({
          className: "custom-shelter-marker",
          html: `
            <div class="w-8 h-8 rounded-xl bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center text-white font-black text-sm">
              ⛺
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([shelter.location.lat, shelter.location.lng], {
          icon: shelterIcon,
        });

        marker.bindPopup(`
          <div class="p-2 text-slate-900 font-sans">
            <div class="font-bold text-sm text-indigo-700">⛺ ${shelter.name}</div>
            <div class="text-xs text-slate-600 mt-0.5">${shelter.location.address}</div>
            <div class="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-200 text-xs">
              <div>Capacity: <strong>${shelter.currentOccupancy} / ${shelter.totalCapacity}</strong></div>
              <div>Vacancies: <strong class="text-emerald-700">${shelter.vacancies}</strong></div>
              <div>Food Supply: <strong>${shelter.foodDaysRemaining} days</strong></div>
              <div>Water: <strong>${shelter.waterSupplyLitres} L</strong></div>
            </div>
            <div class="mt-2 text-xs text-slate-500">📞 ${shelter.contact}</div>
          </div>
        `);

        lg.addLayer(marker);
      }
    }

    // 4. Render Rescue Teams
    if (visibleLayers.teams) {
      for (const team of teams) {
        const isAvail = team.status === "available";
        const isOffline = team.status === "offline";
        const bg = isAvail
          ? "bg-emerald-500"
          : isOffline
          ? "bg-slate-500"
          : "bg-blue-600";

        const teamIcon = L.divIcon({
          className: "custom-team-marker",
          html: `
            <div class="relative flex items-center justify-center">
              <div class="w-9 h-9 rounded-2xl ${bg} border-2 border-white shadow-xl flex items-center justify-center text-white font-black text-sm">
                🚒
              </div>
              <span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                isAvail ? "bg-emerald-400" : isOffline ? "bg-slate-400" : "bg-amber-400"
              }"></span>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker([team.location.lat, team.location.lng], {
          icon: teamIcon,
        });

        marker.bindPopup(`
          <div class="p-2 text-slate-900 font-sans">
            <div class="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <span>🚒</span> ${team.name}
            </div>
            <div class="text-xs text-slate-600 mt-0.5">Leader: ${team.leader} | ${team.vehicleType}</div>
            <div class="mt-2 text-xs flex items-center gap-2">
              <span class="px-2 py-0.5 rounded font-bold uppercase text-[10px] text-white ${bg}">
                ${team.status.toUpperCase()}
              </span>
              <span class="text-slate-600">Active Tasks: <strong>${team.workloadCount}</strong></span>
            </div>
            <div class="mt-1.5 text-xs text-slate-700">
              Specialization: <em>${team.specialization.join(", ")}</em>
            </div>
            <div class="mt-2 text-xs text-slate-500">📞 ${team.contact}</div>
          </div>
        `);

        lg.addLayer(marker);
      }
    }

    // 5. Render Emergency Incidents & SOS
    if (visibleLayers.incidents) {
      for (const req of requests) {
        if (req.status === "completed" || req.status === "cancelled") continue;

        const isSOS = req.isSOS;
        const isHighlighted = highlightedRequestId === req.id;

        const incidentIcon = L.divIcon({
          className: "custom-incident-marker",
          html: `
            <div class="relative flex items-center justify-center cursor-pointer">
              ${
                isSOS
                  ? '<span class="absolute w-12 h-12 rounded-full bg-red-500 opacity-75 animate-ping"></span>'
                  : ""
              }
              <div class="w-9 h-9 rounded-full ${
                isSOS ? "bg-red-600 animate-bounce" : "bg-red-500"
              } ${
            isHighlighted ? "ring-4 ring-yellow-400" : ""
          } border-2 border-white shadow-xl flex items-center justify-center text-white font-black text-sm">
                ${isSOS ? "🚨" : "⚠️"}
              </div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker([req.location.lat, req.location.lng], {
          icon: incidentIcon,
        });

        marker.bindPopup(`
          <div class="p-2 text-slate-900 font-sans max-w-xs">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                isSOS ? "bg-red-600 text-white" : "bg-amber-500 text-white"
              }">
                ${isSOS ? "SOS EMERGENCY" : req.hazardType}
              </span>
              <span class="text-xs font-bold text-red-600">Score: ${req.priorityScore}/100</span>
            </div>
            <div class="font-bold text-sm text-slate-900 mt-1">${req.rescueType}</div>
            <div class="text-xs text-slate-600 mt-0.5">${req.location.address}</div>
            <div class="mt-2 text-xs bg-slate-100 p-1.5 rounded text-slate-700">
              <strong>${req.peopleAffected} People Affected</strong>
              (${req.vulnerabilities.injured} injured, ${req.vulnerabilities.kids} kids, ${req.vulnerabilities.elderly} elderly)
            </div>
            <div class="mt-2 text-xs text-slate-800">
              Status: <strong class="uppercase text-blue-600">${req.status.replace("_", " ")}</strong>
            </div>
            ${
              req.assignedTeamName
                ? `<div class="mt-1 text-xs text-emerald-700">Assigned: <strong>${req.assignedTeamName}</strong> (~${
                    req.etaMinutes || 8
                  }m)</div>`
                : `<div class="mt-1 text-xs text-amber-700 italic">Awaiting dispatch approval</div>`
            }
          </div>
        `);

        lg.addLayer(marker);
      }
    }

    // 6. Selected Location Pin (For user location picking)
    if (selectedLocation) {
      if (tempMarkerRef.current) {
        lg.removeLayer(tempMarkerRef.current);
      }

      const pickIcon = L.divIcon({
        className: "custom-pick-marker",
        html: `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-8 h-8 rounded-full bg-blue-500 opacity-60 animate-ping"></span>
            <div class="w-8 h-8 rounded-full bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center text-white font-bold text-xs">
              📍
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const pickMarker = L.marker([selectedLocation.lat, selectedLocation.lng], {
        icon: pickIcon,
      }).bindPopup("Selected Incident Coordinates");

      lg.addLayer(pickMarker);
      tempMarkerRef.current = pickMarker;
    }
  }, [
    requests,
    teams,
    hospitals,
    shelters,
    roadBlocks,
    visibleLayers,
    selectedLocation,
    highlightedRequestId,
  ]);

  return (
    <div className="relative w-full h-full min-h-[380px] rounded-2xl overflow-hidden border border-slate-700/80 shadow-inner bg-slate-950">
      {/* Map Element */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[380px] z-10" />

      {/* Layer Filter Controls Overlay */}
      <div className="absolute top-3 right-3 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl p-2.5 shadow-xl text-xs text-slate-200 flex flex-col gap-1.5">
        <div className="font-bold text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-700">
          <Layers className="w-3.5 h-3.5 text-blue-400" /> Map Layers
        </div>

        <label className="flex items-center gap-2 cursor-pointer hover:text-white">
          <input
            type="checkbox"
            checked={visibleLayers.incidents}
            onChange={(e) =>
              setVisibleLayers({ ...visibleLayers, incidents: e.target.checked })
            }
            className="rounded text-red-500 focus:ring-0"
          />
          <span>🚨 Incidents ({requests.length})</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer hover:text-white">
          <input
            type="checkbox"
            checked={visibleLayers.teams}
            onChange={(e) =>
              setVisibleLayers({ ...visibleLayers, teams: e.target.checked })
            }
            className="rounded text-emerald-500 focus:ring-0"
          />
          <span>🚒 Rescue Teams ({teams.length})</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer hover:text-white">
          <input
            type="checkbox"
            checked={visibleLayers.hospitals}
            onChange={(e) =>
              setVisibleLayers({ ...visibleLayers, hospitals: e.target.checked })
            }
            className="rounded text-blue-500 focus:ring-0"
          />
          <span>🏥 Hospitals ({hospitals.length})</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer hover:text-white">
          <input
            type="checkbox"
            checked={visibleLayers.shelters}
            onChange={(e) =>
              setVisibleLayers({ ...visibleLayers, shelters: e.target.checked })
            }
            className="rounded text-indigo-500 focus:ring-0"
          />
          <span>⛺ Shelters ({shelters.length})</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer hover:text-white">
          <input
            type="checkbox"
            checked={visibleLayers.roadBlocks}
            onChange={(e) =>
              setVisibleLayers({ ...visibleLayers, roadBlocks: e.target.checked })
            }
            className="rounded text-amber-500 focus:ring-0"
          />
          <span>🚧 Roadblocks ({roadBlocks.filter((r) => r.status === "active").length})</span>
        </label>
      </div>

      {/* Helper Legend / Instructions */}
      {onSelectLocation && (
        <div className="absolute bottom-3 left-3 z-20 bg-slate-900/90 backdrop-blur-md border border-blue-500/50 rounded-xl py-1.5 px-3 shadow-lg text-xs text-blue-300 flex items-center gap-2">
          <Navigation className="w-3.5 h-3.5 animate-pulse text-blue-400" />
          <span>Click anywhere on the map to pin incident location</span>
        </div>
      )}
    </div>
  );
};
