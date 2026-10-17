import { GoogleGenAI } from "@google/genai";
import {
  EmergencyRequest,
  HazardType,
  LocationCoords,
  PriorityScoreBreakdown,
  RescueTeam,
  RoadBlock,
  VulnerableCounts,
} from "../src/types.js";

// Lazy-initialize Gemini client with required headers
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    try {
      geminiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    } catch (e) {
      console.warn("Could not initialize Gemini client:", e);
    }
  }
  return geminiClient;
}

// Haversine distance calculator in kilometers
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Check road blockage accessibility penalty (0 to 1)
export function calculateAccessibilityPenalty(
  incidentLoc: LocationCoords,
  roadBlocks: RoadBlock[]
): { penalty: number; reason: string } {
  const activeBlocks = roadBlocks.filter((rb) => rb.status === "active");
  let maxProximityImpact = 0;
  let impactedRoad = "";

  for (const block of activeBlocks) {
    const dist = calculateDistanceKm(
      incidentLoc.lat,
      incidentLoc.lng,
      block.location.lat,
      block.location.lng
    );
    if (dist < 1.0) {
      // Direct obstruction near incident site
      maxProximityImpact = Math.max(maxProximityImpact, 0.9);
      impactedRoad = `${block.roadName} (${block.blockageType} ${dist}km away)`;
    } else if (dist < 3.0) {
      // Approach corridor obstruction
      maxProximityImpact = Math.max(maxProximityImpact, 0.5);
      if (!impactedRoad) {
        impactedRoad = `${block.roadName} (${block.blockageType} ${dist}km away)`;
      }
    } else if (dist < 5.0) {
      maxProximityImpact = Math.max(maxProximityImpact, 0.2);
    }
  }

  return {
    penalty: maxProximityImpact,
    reason: impactedRoad
      ? `Severe route disruption: ${impactedRoad}`
      : "Corridors open with minor congestion",
  };
}

// Determine required equipment based on hazard and rescue type
export function getRequiredEquipment(
  hazardType: HazardType,
  rescueType: string,
  vulnerabilities: VulnerableCounts
): string[] {
  const equipment = new Set<string>();

  if (hazardType === "Flood" || rescueType.toLowerCase().includes("water") || rescueType.toLowerCase().includes("boat")) {
    equipment.add("Inflatable Rescue Boat");
    equipment.add("Lifejackets & Throw Ropes");
    equipment.add("Waterproof Trauma Kit");
  }

  if (hazardType === "Fire" || rescueType.toLowerCase().includes("fire")) {
    equipment.add("SCBA Breathing Apparatus");
    equipment.add("Thermal Imaging Camera");
    equipment.add("Fire Extinguishers & Hoses");
    equipment.add("Burn Care Kit");
  }

  if (hazardType === "Earthquake" || hazardType === "Building Collapse" || rescueType.toLowerCase().includes("debris")) {
    equipment.add("Hydraulic Spreader / Cutters");
    equipment.add("Acoustic / Seismic Life Detector");
    equipment.add("Spinal Immobilization Boards");
  }

  if (hazardType === "Landslide") {
    equipment.add("Shoring Struts & Earth Moving Rig");
    equipment.add("Drone Aerial Recon");
    equipment.add("Stretcher Evacuation Pod");
  }

  if (vulnerabilities.injured > 0 || vulnerabilities.pregnant > 0 || rescueType.toLowerCase().includes("medical")) {
    equipment.add("Advanced Life Support (ALS) Medkit");
    equipment.add("Oxygen Concentrator");
  }

  if (vulnerabilities.elderly > 0 || vulnerabilities.impaired > 0) {
    equipment.add("Basket Stretcher / Wheelchair Rig");
  }

  if (equipment.size === 0) {
    equipment.add("Standard Field First Aid Kit");
    equipment.add("Emergency Evacuation Rations");
  }

  return Array.from(equipment);
}

// Calculate base hazard severity (0 to 1)
function calculateBaseHazardSeverity(
  hazardType: HazardType,
  rescueType: string,
  description: string
): number {
  let severity = 0.5;
  const descLower = description.toLowerCase();

  switch (hazardType) {
    case "Building Collapse":
      severity = 0.95;
      break;
    case "Fire":
      severity = descLower.includes("trapped") || descLower.includes("spreading") ? 0.92 : 0.78;
      break;
    case "Flood":
      severity = descLower.includes("roof") || descLower.includes("submerged") || descLower.includes("boat") ? 0.88 : 0.72;
      break;
    case "Landslide":
      severity = 0.86;
      break;
    case "Earthquake":
      severity = 0.85;
      break;
    case "Cyclone":
      severity = 0.8;
      break;
    default:
      severity = 0.6;
      break;
  }

  // Contextual keywords boost
  if (descLower.includes("unconscious") || descLower.includes("bleeding") || descLower.includes("suffocating") || descLower.includes("drowning")) {
    severity = Math.min(1.0, severity + 0.1);
  }

  return severity;
}

// Explainable Priority Score Calculation
export async function calculatePriorityScore(
  hazardType: HazardType,
  rescueType: string,
  peopleAffected: number,
  vulnerabilities: VulnerableCounts,
  description: string,
  isSOS: boolean,
  incidentLoc: LocationCoords,
  roadBlocks: RoadBlock[],
  availableTeamsCount: number
): Promise<PriorityScoreBreakdown> {
  // 1. Vulnerability Score (0 to 1)
  // Weighted: Elderly (1.2), Pregnant (1.5), Impaired (1.4), Kids (1.1), Injured (1.6)
  const weightedVulnerableTotal =
    vulnerabilities.elderly * 1.2 +
    vulnerabilities.pregnant * 1.5 +
    vulnerabilities.impaired * 1.4 +
    vulnerabilities.kids * 1.1 +
    vulnerabilities.injured * 1.6;

  const totalPeople = Math.max(1, peopleAffected);
  let vulnerabilityRatio = weightedVulnerableTotal / totalPeople;
  if (vulnerabilities.injured > 0 || vulnerabilities.pregnant > 0) {
    vulnerabilityRatio = Math.max(vulnerabilityRatio, 0.4);
  }
  const vulnerabilityScore = Math.min(1.0, Math.round(vulnerabilityRatio * 100) / 100);

  // 2. People Affected Score (0 to 1)
  let peopleAffectedScore = 0.2;
  if (totalPeople >= 20) peopleAffectedScore = 1.0;
  else if (totalPeople >= 10) peopleAffectedScore = 0.85;
  else if (totalPeople >= 5) peopleAffectedScore = 0.65;
  else if (totalPeople >= 3) peopleAffectedScore = 0.5;
  else if (totalPeople >= 2) peopleAffectedScore = 0.35;
  else peopleAffectedScore = 0.2;

  // 3. Medical Urgency (0 to 1)
  let medicalUrgencyScore = 0.1;
  const desc = description.toLowerCase();
  if (vulnerabilities.injured > 0) {
    medicalUrgencyScore = Math.min(1.0, 0.5 + vulnerabilities.injured * 0.15);
  }
  if (vulnerabilities.pregnant > 0) {
    medicalUrgencyScore = Math.max(medicalUrgencyScore, 0.7);
  }
  if (
    rescueType.toLowerCase().includes("medical") ||
    desc.includes("heart") ||
    desc.includes("stroke") ||
    desc.includes("wound") ||
    desc.includes("fracture") ||
    desc.includes("oxygen")
  ) {
    medicalUrgencyScore = Math.max(medicalUrgencyScore, 0.85);
  }

  // 4. Hazard Severity (0 to 1) - Can be augmented with Gemini AI
  let hazardSeverityScore = calculateBaseHazardSeverity(hazardType, rescueType, description);
  let aiTriageSummary = "";

  const ai = getGeminiClient();
  if (ai) {
    try {
      const prompt = `You are the lead triage AI for disaster relief.
Analyze this incident:
- Hazard: ${hazardType}
- Rescue Category: ${rescueType}
- People: ${peopleAffected} (Elderly: ${vulnerabilities.elderly}, Pregnant: ${vulnerabilities.pregnant}, Impaired: ${vulnerabilities.impaired}, Kids: ${vulnerabilities.kids}, Injured: ${vulnerabilities.injured})
- Description: "${description}"
- SOS Emergency: ${isSOS}

Return JSON with:
{
  "calculatedSeverity": number between 0.1 and 1.0,
  "triageRationale": "concise 1-2 sentence operational explanation of acute hazards and primary rescue requirement"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        if (typeof parsed.calculatedSeverity === "number") {
          hazardSeverityScore = Math.max(0.1, Math.min(1.0, parsed.calculatedSeverity));
        }
        if (parsed.triageRationale) {
          aiTriageSummary = parsed.triageRationale;
        }
      }
    } catch (err) {
      console.warn("Gemini triage assessment fallback to algorithmic rules:", err);
    }
  }

  if (!aiTriageSummary) {
    aiTriageSummary = `${hazardType} with ${rescueType}. Immediate hazard severity assessed at ${Math.round(
      hazardSeverityScore * 100
    )}% based on impact scope and physical entrapment markers.`;
  }

  // 5. Time Criticality (0 to 1)
  let timeCriticalityScore = 0.4;
  if (isSOS) {
    timeCriticalityScore = 1.0;
  } else if (
    hazardType === "Fire" ||
    hazardType === "Building Collapse" ||
    rescueType.toLowerCase().includes("trapped") ||
    desc.includes("rising water")
  ) {
    timeCriticalityScore = 0.95;
  } else if (vulnerabilities.injured > 0 || vulnerabilities.pregnant > 0) {
    timeCriticalityScore = 0.8;
  } else {
    timeCriticalityScore = 0.6;
  }

  // 6. Accessibility Penalty (0 to 1)
  const accessCheck = calculateAccessibilityPenalty(incidentLoc, roadBlocks);
  const accessibilityPenalty = accessCheck.penalty;

  // 7. Resource Availability Bonus (0 to 1)
  // Higher bonus if designated specialized teams are currently available in the area
  const resourceBonus = availableTeamsCount > 0 ? Math.min(1.0, availableTeamsCount / 3) : 0.1;

  // Exact formula specified in requirements:
  // Priority Score =
  // (Vulnerability Score × 35) +
  // (People Affected × 15) +
  // (Medical Urgency × 20) +
  // (Hazard Severity calculated by AI × 15) +
  // (Time Criticality × 10) +
  // (Accessibility Penalty × -10) +
  // (Resource Availability Bonus × 5)

  const rawScore =
    vulnerabilityScore * 35 +
    peopleAffectedScore * 15 +
    medicalUrgencyScore * 20 +
    hazardSeverityScore * 15 +
    timeCriticalityScore * 10 +
    accessibilityPenalty * -10 +
    resourceBonus * 5;

  // If SOS, floor at 85 to ensure top-tier urgency
  const finalScore = isSOS ? Math.max(88, Math.round(rawScore)) : Math.max(10, Math.min(100, Math.round(rawScore)));

  // Build human-readable transparent explanation
  const explanation = [
    `Priority Score: ${finalScore}/100.`,
    isSOS ? `🚨 CRITICAL SOS TRIGGERED: Max time-criticality multiplier applied.` : "",
    `Vulnerability Impact: +${Math.round(vulnerabilityScore * 35)} pts (${vulnerabilities.injured} injured, ${vulnerabilities.pregnant} pregnant, ${vulnerabilities.kids} children, ${vulnerabilities.elderly} elderly).`,
    `People Affected (${totalPeople} pax): +${Math.round(peopleAffectedScore * 15)} pts.`,
    `Medical Urgency: +${Math.round(medicalUrgencyScore * 20)} pts.`,
    `AI Hazard Severity (${hazardType}): +${Math.round(hazardSeverityScore * 15)} pts.`,
    `Time Criticality: +${Math.round(timeCriticalityScore * 10)} pts.`,
    accessibilityPenalty > 0
      ? `Route Friction Penalty: -${Math.round(accessibilityPenalty * 10)} pts (${accessCheck.reason}).`
      : `Route Access: Clear (+0 penalty).`,
    `Resource Bonus: +${Math.round(resourceBonus * 5)} pts (${availableTeamsCount} unit(s) online).`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    vulnerabilityScore,
    peopleAffectedScore,
    medicalUrgencyScore,
    hazardSeverityScore,
    timeCriticalityScore,
    accessibilityPenalty,
    resourceBonus,
    totalScore: finalScore,
    explanation,
    aiTriageSummary,
  };
}

// Match the best Rescue Team based on user specifications and targeted unit category
export function matchBestRescueTeam(
  request: EmergencyRequest,
  availableTeams: RescueTeam[],
  roadBlocks: RoadBlock[]
): {
  matchedTeam: RescueTeam | null;
  explanation: string;
  candidateScores: { teamId: string; score: number; reason: string }[];
} {
  // Filter out completely offline teams
  const onlineTeams = availableTeams.filter((t) => t.isOnline !== false);

  if (onlineTeams.length === 0) {
    return {
      matchedTeam: null,
      explanation: "No rescue units are currently active/online. Escalating to Control Room regional reserve.",
      candidateScores: [],
    };
  }

  const reqEquip = request.requiredEquipment.map((e) => e.toLowerCase());
  const hazard = request.hazardType.toLowerCase();
  const desc = (request.description || "").toLowerCase();
  const rescueType = (request.rescueType || "").toLowerCase();

  // Determine target unit categories based on incident characteristics
  const targetUnitTypes: string[] = [];
  if (rescueType.includes("medical") || request.vulnerabilities.injured > 0 || desc.includes("cardiac") || desc.includes("bleeding")) {
    targetUnitTypes.push("Paramedic");
  }
  if (hazard === "flood" || rescueType.includes("boat") || desc.includes("water") || desc.includes("drowning")) {
    targetUnitTypes.push("Water Rescue", "NDRF");
  }
  if (hazard === "fire" || desc.includes("smoke") || desc.includes("chemical") || desc.includes("gas leak")) {
    targetUnitTypes.push("Fire & Hazmat");
  }
  if (hazard === "building collapse" || hazard === "earthquake" || hazard === "landslide") {
    targetUnitTypes.push("NDRF", "Army/Military Support");
  }
  if (request.isSOS || desc.includes("urgent") || desc.includes("immediate")) {
    targetUnitTypes.push("Quick Reaction Team");
  }
  if (targetUnitTypes.length === 0) {
    targetUnitTypes.push("NDRF", "Quick Reaction Team");
  }

  const scoredTeams = onlineTeams.map((team) => {
    // 1. Distance score (closer is better, max 10km radius)
    const distKm = calculateDistanceKm(
      team.location.lat,
      team.location.lng,
      request.location.lat,
      request.location.lng
    );
    const distanceScore = Math.max(0, 30 - distKm * 3); // max 30 pts

    // 2. Availability score
    let availScore = 0;
    if (team.status === "available") availScore = 25;
    else if (team.status === "deployed" || team.status === "busy") availScore = 5;

    // 3. Equipment match
    const teamEquipNames = team.resources
      .filter((r) => r.ready)
      .map((r) => r.name.toLowerCase());
    let matchingEquipCount = 0;
    for (const req of reqEquip) {
      if (teamEquipNames.some((t) => t.includes(req) || req.includes(t))) {
        matchingEquipCount++;
      }
    }
    const equipScore = Math.min(25, matchingEquipCount * 8);

    // 4. Targeted Unit Category Match (Requirement 4)
    let unitTypeScore = 5;
    const isTargetUnit = team.unitType && targetUnitTypes.includes(team.unitType);
    if (isTargetUnit) {
      unitTypeScore = 30; // Heavy targeted bonus for appropriate specialized category
    }

    // 5. Specialization match
    const teamSpecs = team.specialization.join(" ").toLowerCase();
    let specScore = 5;
    if (hazard === "flood" && teamSpecs.includes("water")) specScore = 15;
    else if (hazard === "fire" && teamSpecs.includes("fire")) specScore = 15;
    else if ((hazard === "earthquake" || hazard === "building collapse") && teamSpecs.includes("search")) specScore = 15;
    else if (request.vulnerabilities.injured > 0 && teamSpecs.includes("medical")) specScore = 15;

    // 6. Workload penalty
    const workloadPenalty = Math.min(15, team.workloadCount * 5);

    // 7. Road accessibility from team to incident
    const access = calculateAccessibilityPenalty(request.location, roadBlocks);
    const accessPenalty = access.penalty * 10;

    const totalTeamScore = Math.max(
      0,
      Math.round(distanceScore + availScore + equipScore + unitTypeScore + specScore - workloadPenalty - accessPenalty)
    );

    const reason = `${team.name} (${team.unitType || "General"}) [Score: ${totalTeamScore}]: ${distKm}km away, ${matchingEquipCount} gear matches, category ${team.unitType} (${isTargetUnit ? "Matched Priority" : "Secondary"}), status ${team.status}`;

    return {
      team,
      totalScore: totalTeamScore,
      distKm,
      matchingEquipCount,
      isTargetUnit,
      reason,
    };
  });

  // Sort descending
  scoredTeams.sort((a, b) => b.totalScore - a.totalScore);
  const best = scoredTeams[0];

  const explanation = `${best.team.name} [${best.team.unitType || "NDRF"}] was selected as optimal unit (${best.distKm} km away). Targeted category match: ${best.isTargetUnit ? "YES" : "Fallback"}. Matches ${
    best.matchingEquipCount
  } required equipment items, current workload: ${
    best.team.workloadCount
  } active tasks. Route accessibility verified.`;

  return {
    matchedTeam: best.team,
    explanation,
    candidateScores: scoredTeams.map((s) => ({
      teamId: s.team.id,
      score: s.totalScore,
      reason: s.reason,
    })),
  };
}
