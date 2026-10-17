import { Response } from "express";
import fs from "fs";
import path from "path";
import {
  calculateDistanceKm,
  calculatePriorityScore,
  getRequiredEquipment,
  matchBestRescueTeam,
} from "./aiEngine.js";
import {
  INITIAL_HOSPITALS,
  INITIAL_MISSING_PERSONS,
  INITIAL_OFFICIAL_UPDATES,
  INITIAL_REQUESTS,
  INITIAL_RESCUE_TEAMS,
  INITIAL_ROADBLOCKS,
  INITIAL_SHELTERS,
} from "./mockData.js";
import {
  AssignmentDocument,
  ControlRoomSummary,
  EmergencyRequest,
  EmergencyStatus,
  FailoverEvent,
  HazardType,
  Hospital,
  LocationCoords,
  MissingPerson,
  MissingPersonMatchNotification,
  OfficialUpdate,
  PlanValidityStatus,
  RescueOperationalState,
  RescueTeam,
  RescueTeamTelemetry,
  RescueUnitType,
  RescuedUnknownPerson,
  RoadBlock,
  Shelter,
  TargetedNotification,
  TeamMonitoringMetric,
  TeamStatusHistoryEntry,
  UserDocument,
  VulnerableCounts,
} from "../src/types.js";
import {
  INITIAL_HOSPITALS,
  INITIAL_MISSING_PERSONS,
  INITIAL_OFFICIAL_UPDATES,
  INITIAL_REQUESTS,
  INITIAL_RESCUE_TEAMS,
  INITIAL_ROADBLOCKS,
  INITIAL_SHELTERS,
  INITIAL_USERS,
} from "./mockData.js";

export interface ConnectedSseClient {
  res: Response;
  role?: string;
  userId?: string;
  teamId?: string;
  hospitalId?: string;
  shelterId?: string;
}

const SEED_ASSIGNMENTS: AssignmentDocument[] = [
  {
    _id: "asg-req-101",
    emergency_id: "req-101",
    primary_team: "RT12",
    backup_teams: ["RT18", "RT22"],
    active_team: "RT12",
    status: "EN_ROUTE",
    required_response_minutes: 8,
    current_eta: 6,
    predicted_eta: 6,
    plan_validity: "VALID",
    created_at: new Date(Date.now() - 600000).toISOString(),
    updated_at: new Date(Date.now() - 300000).toISOString(),
    assignment_sent_at: Date.now() - 600000,
    response_deadline_at: Date.now() - 540000,
    response_status: "ACCEPTED",
  },
];

class DisasterDataStore {
  public requests: EmergencyRequest[] = [...INITIAL_REQUESTS];
  public teams: RescueTeam[] = [...INITIAL_RESCUE_TEAMS];
  public users: UserDocument[] = [...INITIAL_USERS];
  public assignments: AssignmentDocument[] = [...SEED_ASSIGNMENTS];
  public teamLocations: Map<string, RescueTeamTelemetry> = new Map();
  public teamStatusHistory: TeamStatusHistoryEntry[] = [];
  public failoverEvents: FailoverEvent[] = [];
  public targetedNotifications: TargetedNotification[] = [];
  public hospitals: Hospital[] = [...INITIAL_HOSPITALS];
  public shelters: Shelter[] = [...INITIAL_SHELTERS];
  public roadBlocks: RoadBlock[] = [...INITIAL_ROADBLOCKS];
  public missingPersons: MissingPerson[] = [...INITIAL_MISSING_PERSONS];
  public officialUpdates: OfficialUpdate[] = [...INITIAL_OFFICIAL_UPDATES];
  public notifications: MissingPersonMatchNotification[] = [];

  // Snapshot storage file path
  private persistPath = path.resolve(process.cwd(), "data", "store_snapshot.json");

  // SSE client connections for real-time live push with role metadata
  private sseClients: ConnectedSseClient[] = [];

  constructor() {
    // Attempt to restore persistent state if snapshot exists
    this.loadPersistedState();
    // Ensure active assignment for req-101 and team status sync
    this.syncInitialState();
    // Correlate missing persons with rescued unknowns in shelters
    this.autoMatchMissingWithRescued();
    // Save current baseline
    this.persist();
  }

  // Ensure initial team RT12 and req-101 are synced
  private syncInitialState() {
    const req101 = this.requests.find((r) => r.id === "req-101");
    if (req101 && req101.status === "pending_review") {
      req101.status = "on_the_way";
      req101.assignedTeamId = "RT12";
      req101.assignedTeamName = "NDRF Squad RT12 (Water Rescue)";
      req101.etaMinutes = 6;
    }
    const rt12 = this.teams.find((t) => t.id === "RT12");
    if (rt12) {
      rt12.status = "deployed";
      rt12.operationalStatus = "EN_ROUTE";
      rt12.currentTaskId = "req-101";
      rt12.workloadCount = 1;
    }
  }

  // Load persistent snapshot from disk
  private loadPersistedState() {
    try {
      if (fs.existsSync(this.persistPath)) {
        const raw = fs.readFileSync(this.persistPath, "utf-8");
        const data = JSON.parse(raw);
        if (Array.isArray(data.requests) && data.requests.length > 0) this.requests = data.requests;
        
        // Merge loaded teams with INITIAL_RESCUE_TEAMS ensuring new teams RT12, RT18, RT22 exist
        if (Array.isArray(data.teams) && data.teams.length > 0) {
          const existingMap = new Map<string, RescueTeam>(data.teams.map((t: RescueTeam) => [t.id, t]));
          for (const t of INITIAL_RESCUE_TEAMS) {
            if (!existingMap.has(t.id)) {
              existingMap.set(t.id, t);
            }
          }
          this.teams = Array.from(existingMap.values());
        }

        // Users
        if (Array.isArray(data.users) && data.users.length > 0) {
          const userMap = new Map<string, UserDocument>(data.users.map((u: UserDocument) => [u._id, u]));
          for (const u of INITIAL_USERS) {
            if (!userMap.has(u._id)) userMap.set(u._id, u);
          }
          this.users = Array.from(userMap.values());
        }

        // Assignments
        if (Array.isArray(data.assignments) && data.assignments.length > 0) {
          this.assignments = data.assignments;
        }

        if (Array.isArray(data.failoverEvents)) this.failoverEvents = data.failoverEvents;
        if (Array.isArray(data.targetedNotifications)) this.targetedNotifications = data.targetedNotifications;
        if (Array.isArray(data.hospitals) && data.hospitals.length > 0) this.hospitals = data.hospitals;
        if (Array.isArray(data.shelters) && data.shelters.length > 0) this.shelters = data.shelters;
        if (Array.isArray(data.roadBlocks) && data.roadBlocks.length > 0) this.roadBlocks = data.roadBlocks;
        if (Array.isArray(data.missingPersons) && data.missingPersons.length > 0) this.missingPersons = data.missingPersons;
        if (Array.isArray(data.officialUpdates) && data.officialUpdates.length > 0) this.officialUpdates = data.officialUpdates;
        if (Array.isArray(data.notifications)) this.notifications = data.notifications;
      }
    } catch (e) {
      console.warn("Notice: Starting with in-memory baseline store:", e);
    }
  }

  // Persist current state to disk
  public persist() {
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        requests: this.requests,
        teams: this.teams,
        users: this.users,
        assignments: this.assignments,
        failoverEvents: this.failoverEvents,
        targetedNotifications: this.targetedNotifications,
        hospitals: this.hospitals,
        shelters: this.shelters,
        roadBlocks: this.roadBlocks,
        missingPersons: this.missingPersons,
        officialUpdates: this.officialUpdates,
        notifications: this.notifications,
        savedAt: Date.now(),
      };
      fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.warn("Warning: Failed to save store snapshot:", e);
    }
  }

  // Subscribe an SSE response with client metadata
  public addSseClient(
    res: Response,
    info?: { role?: string; userId?: string; teamId?: string; hospitalId?: string; shelterId?: string }
  ) {
    const client: ConnectedSseClient = {
      res,
      role: info?.role ? info.role.toLowerCase() : undefined,
      userId: info?.userId,
      teamId: info?.teamId,
      hospitalId: info?.hospitalId,
      shelterId: info?.shelterId,
    };
    this.sseClients.push(client);
    res.on("close", () => {
      this.sseClients = this.sseClients.filter((c) => c !== client);
    });
  }

  // Emit event to a targeted logical room:
  // - "admin_room": All administrators
  // - "rescue_team_${teamId}": Specific rescue team and admin room
  // - "citizen_${userId}": Specific citizen and admin room
  // - "hospital_${hospId}": Specific hospital and admin room
  // - "shelter_${shelterId}": Specific shelter and admin room
  public emitTargeted(room: string, type: string, data: any) {
    this.persist();
    const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const client of this.sseClients) {
      let shouldSend = false;

      if (room === "admin_room") {
        shouldSend = client.role === "admin";
      } else if (room.startsWith("rescue_team_")) {
        const targetTeamId = room.replace("rescue_team_", "");
        // Only deliver to the targeted rescue team, and control room admin
        shouldSend = (client.role === "rescue" && client.teamId === targetTeamId) || client.role === "admin";
      } else if (room.startsWith("citizen_")) {
        const targetUserId = room.replace("citizen_", "");
        shouldSend = client.userId === targetUserId || client.role === "admin";
      } else if (room.startsWith("hospital_")) {
        const hospId = room.replace("hospital_", "");
        shouldSend = client.hospitalId === hospId || client.role === "admin";
      } else if (room.startsWith("shelter_")) {
        const shelterId = room.replace("shelter_", "");
        shouldSend = client.shelterId === shelterId || client.role === "admin";
      } else {
        shouldSend = true;
      }

      if (shouldSend) {
        try {
          client.res.write(payload);
        } catch {
          // Closed
        }
      }
    }
  }

  // Broadcast event to ALL listening clients (SSE) and write-through to persistent storage
  public broadcast(type: string, data: any) {
    this.persist();
    const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.res.write(payload);
      } catch {
        // Ignored
      }
    }
  }

  // Create and record a targeted notification
  public createTargetedNotification(
    data: Omit<TargetedNotification, "id" | "created_at" | "read">
  ): TargetedNotification {
    const notif: TargetedNotification = {
      id: `tnotif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...data,
      read: false,
      created_at: Date.now(),
    };
    this.targetedNotifications.unshift(notif);
    this.emitTargeted(data.recipient_id, "targeted_notification", notif);
    return notif;
  }

  // Helper to cross-reference reported missing persons with rescued individuals in shelters
  public autoMatchMissingWithRescued() {
    for (const shelter of this.shelters) {
      for (const rescued of shelter.rescuedPersons) {
        for (const missing of this.missingPersons) {
          if (missing.status === "missing") {
            // Check matching name, age range, gender, or distinctive marks
            const nameMatch = Boolean(
              rescued.name &&
              missing.name &&
              (rescued.name.toLowerCase().trim() === missing.name.toLowerCase().trim() ||
                rescued.name.toLowerCase().includes(missing.name.toLowerCase()) ||
                missing.name.toLowerCase().includes(rescued.name.toLowerCase()))
            );

            const genderMatch =
              rescued.gender.toLowerCase() === missing.gender.toLowerCase();
            const ageMatch =
              rescued.approximateAge &&
              Math.abs(rescued.approximateAge - missing.age) <= 2;
            const marksMatch = Boolean(
              rescued.identificationMarks &&
              missing.identificationMarks &&
              (rescued.identificationMarks.toLowerCase().includes("birthmark") ||
                rescued.identificationMarks.toLowerCase().includes("scar") ||
                missing.identificationMarks.toLowerCase().includes("birthmark") ||
                missing.identificationMarks.toLowerCase().includes("scar"))
            );

            if (nameMatch || (genderMatch && (ageMatch || marksMatch))) {
              rescued.matchedMissingPersonId = missing.id;
              missing.status = "located_in_shelter";
              missing.matchedShelterId = shelter.id;
              missing.matchedShelterName = shelter.name;

              // Check if notification already exists for this missing person
              const exists = this.notifications.some(
                (n) => n.missingPersonId === missing.id && n.shelterId === shelter.id
              );

              if (!exists) {
                const notif: MissingPersonMatchNotification = {
                  id: `notif-${missing.id}-${Date.now()}`,
                  timestamp: Date.now(),
                  missingPersonId: missing.id,
                  missingPersonName: missing.name,
                  reporterName: missing.reporterName,
                  reporterPhone: missing.reporterPhone,
                  shelterId: shelter.id,
                  shelterName: shelter.name,
                  shelterAddress: shelter.location?.address || "Designated Emergency Relief Facility",
                  shelterContact: shelter.contact,
                  physicalCondition: rescued.healthCondition || "Stable & Receiving Care",
                  foundLocation: rescued.foundLocation || shelter.location?.address || "Field rescue staging",
                  photoUrl: rescued.photoUrl || missing.photoUrl,
                  read: false,
                };
                this.notifications.unshift(notif);
                this.broadcast("missing_person_match", notif);
                this.broadcast("notifications_updated", this.notifications);
              }

              this.addAuditLog(
                "System Cross-Matcher",
                "Automated Missing Person Identification",
                `Identified match for missing person "${missing.name}" at ${shelter.name}. Citizen ${missing.reporterName} (${missing.reporterPhone}) notified.`
              );
            }
          }
        }
      }
    }
  }

  public addAuditLog(actor: string, action: string, note: string, reqId?: string) {
    const entry = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now(),
      actor,
      action,
      note,
    };
    if (reqId) {
      const target = this.requests.find((r) => r.id === reqId);
      if (target) {
        target.auditLogs.unshift(entry);
      }
    }
    this.broadcast("audit_log", entry);
    return entry;
  }

  // Calculate summary metrics for Control Room
  public getSummary(): ControlRoomSummary {
    let totalPeopleAffected = 0;
    let totalVulnerablePeople = 0;

    for (const r of this.requests) {
      if (r.status !== "completed" && r.status !== "cancelled") {
        totalPeopleAffected += r.peopleAffected;
        totalVulnerablePeople +=
          r.vulnerabilities.elderly +
          r.vulnerabilities.pregnant +
          r.vulnerabilities.impaired +
          r.vulnerabilities.kids +
          r.vulnerabilities.injured;
      }
    }

    const activeIncidentsCount = this.requests.filter(
      (r) => r.status !== "completed" && r.status !== "cancelled"
    ).length;

    const sosAlertsCount = this.requests.filter(
      (r) => r.isSOS && r.status !== "completed" && r.status !== "cancelled"
    ).length;

    const availableRescueTeams = this.teams.filter(
      (t) => t.status === "available"
    ).length;

    let totalHospitalBedsAvailable = 0;
    for (const h of this.hospitals) {
      if (h.operatingStatus !== "Closed" && h.operatingStatus !== "Damaged") {
        totalHospitalBedsAvailable += h.availableBeds;
      }
    }

    let totalShelterVacancies = 0;
    for (const s of this.shelters) {
      if (s.operatingStatus !== "Closed" && s.operatingStatus !== "Damaged") {
        totalShelterVacancies += s.vacancies;
      }
    }

    const activeRoadblocksCount = this.roadBlocks.filter(
      (rb) => rb.status === "active"
    ).length;

    const missingPersonsCount = this.missingPersons.filter(
      (m) => m.status === "missing"
    ).length;

    const locatedPersonsCount = this.missingPersons.filter(
      (m) => m.status === "located_in_shelter" || m.status === "reunited"
    ).length;

    // Real-time count of active online units categorized by type (NDRF, Paramedic, etc.)
    const onlineTeams = this.teams.filter(
      (t) => t.status !== "offline" && t.isOnline !== false
    );
    const onlineUnitsByType: Record<string, number> = {};
    for (const t of onlineTeams) {
      const type = t.unitType || "Other";
      onlineUnitsByType[type] = (onlineUnitsByType[type] || 0) + 1;
    }

    return {
      totalPeopleAffected,
      totalVulnerablePeople,
      activeIncidentsCount,
      sosAlertsCount,
      availableRescueTeams,
      totalRescueTeams: this.teams.length,
      activeOnlineUnitsCount: onlineTeams.length,
      onlineUnitsByType,
      totalHospitalBedsAvailable,
      totalShelterVacancies,
      activeRoadblocksCount,
      missingPersonsCount,
      locatedPersonsCount,
    };
  }

  // Register New Rescue Team dynamically
  public registerRescueTeam(data: {
    name: string;
    unitType: RescueUnitType;
    leader: string;
    contact: string;
    vehicleType: string;
    location?: LocationCoords;
    specialization?: string[];
    resources?: any[];
  }): RescueTeam {
    const unitType = data.unitType || "NDRF";
    const newTeam: RescueTeam = {
      id: `team-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: data.name,
      code: `${unitType.replace(/[^A-Za-z]/g, "").toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      unitType,
      status: "available",
      isOnline: true,
      specialization:
        data.specialization && data.specialization.length > 0
          ? data.specialization
          : [`${unitType} Emergency Operations`, "Field Search & Rescue"],
      resources:
        data.resources && data.resources.length > 0
          ? data.resources
          : [
              { name: "Field First Aid & Extraction Rig", quantity: 4, ready: true },
              { name: "Satellite VHF Radio Unit", quantity: 4, ready: true },
              { name: "Emergency Floodlights & Power Rig", quantity: 2, ready: true },
            ],
      location: data.location || {
        lat: 13.0827 + (Math.random() - 0.5) * 0.04,
        lng: 80.2707 + (Math.random() - 0.5) * 0.04,
        address: `Field Deployment Base, Sector ${Math.floor(1 + Math.random() * 8)}`,
      },
      workloadCount: 0,
      contact: data.contact || "+1 (555) 019-9000",
      leader: data.leader || "Squad Leader",
      vehicleType: data.vehicleType || "Tactical Disaster Vehicle",
    };

    this.teams.push(newTeam);
    this.addAuditLog(
      "Control Room System",
      "Dynamic Rescue Unit Registration",
      `Registered active unit ${newTeam.name} [${newTeam.unitType}] under leader ${newTeam.leader}.`
    );

    this.broadcast("team_registered", newTeam);
    this.broadcast("teams_updated", this.teams);
    this.triggerDynamicReassessmentLoop(`New unit ${newTeam.name} (${newTeam.unitType}) came online`);
    return newTeam;
  }

  // Get notifications (filter by citizen phone if provided)
  public getNotifications(reporterPhone?: string) {
    if (!reporterPhone) return this.notifications;
    const cleanPhone = reporterPhone.replace(/\D/g, "");
    return this.notifications.filter((n) => {
      const targetPhone = (n.reporterPhone || "").replace(/\D/g, "");
      return targetPhone === cleanPhone || targetPhone.includes(cleanPhone) || cleanPhone.includes(targetPhone);
    });
  }

  public markNotificationRead(id: string) {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) {
      notif.read = true;
      this.broadcast("notifications_updated", this.notifications);
    }
  }

  // Create or Trigger SOS Alert
  public async createSosAlert(payload: {
    location?: LocationCoords;
    reporterContact?: string;
    description?: string;
  }): Promise<EmergencyRequest> {
    const defaultLoc: LocationCoords = payload.location || {
      lat: 13.0827,
      lng: 80.2707,
      address: "GPS Auto-Detected Immediate Distress Location",
    };

    const vulnerabilities: VulnerableCounts = {
      elderly: 1,
      pregnant: 0,
      impaired: 0,
      kids: 1,
      injured: 1,
    };

    const reqEquip = getRequiredEquipment("Other", "Critical SOS Extraction", vulnerabilities);
    const availableTeams = this.teams.filter((t) => t.status === "available" && t.isOnline !== false);

    const scoreBreakdown = await calculatePriorityScore(
      "Other",
      "Immediate SOS Distress",
      3,
      vulnerabilities,
      payload.description || "CITIZEN PRESSED EMERGENCY SOS BUTTON! Immediate high-priority life safety distress.",
      true,
      defaultLoc,
      this.roadBlocks,
      availableTeams.length
    );

    const newRequest: EmergencyRequest = {
      id: `sos-${Date.now()}`,
      isSOS: true,
      hazardType: "Other",
      rescueType: "Immediate Rescue",
      location: defaultLoc,
      peopleAffected: 3,
      vulnerabilities,
      description: payload.description || "CRITICAL SOS TRANSMISSION. High-urgency alert broadcast to Control Room.",
      status: "pending_review",
      reportedAt: Date.now(),
      reporterContact: payload.reporterContact || "Citizen App GPS Link",
      priorityScore: scoreBreakdown.totalScore,
      scoreBreakdown,
      requiredEquipment: reqEquip,
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          actor: "Citizen SOS Beacon",
          action: "Triggered Emergency SOS",
          note: "Real-time red alert issued with maximum time-criticality multiplier.",
        },
      ],
    };

    // AI recommendation for team (handling 0 available teams gracefully)
    const match = matchBestRescueTeam(newRequest, availableTeams, this.roadBlocks);
    if (match.matchedTeam) {
      newRequest.assignedTeamId = match.matchedTeam.id;
      newRequest.assignedTeamName = match.matchedTeam.name;
      newRequest.teamMatchingExplanation = match.explanation;
      newRequest.etaMinutes = Math.max(
        4,
        Math.round(
          calculateDistanceKm(
            match.matchedTeam.location.lat,
            match.matchedTeam.location.lng,
            defaultLoc.lat,
            defaultLoc.lng
          ) * 2.5
        )
      );
    } else {
      newRequest.assignedTeamId = undefined;
      newRequest.assignedTeamName = undefined;
      newRequest.teamMatchingExplanation =
        match.explanation || "No rescue teams are currently online or available. SOS held in priority reserve.";
      newRequest.auditLogs.push({
        id: `log-${Date.now()}-unassigned`,
        timestamp: Date.now(),
        actor: "AI Triage System",
        action: "Regional Standby Hold",
        note: "Zero available rescue teams online. Emergency held for incoming squad availability.",
      });
    }

    // Destination suggestion
    const nearestHosp = this.findNearestHospital(defaultLoc);
    if (nearestHosp) {
      newRequest.targetDestinationId = nearestHosp.id;
      newRequest.targetDestinationName = nearestHosp.name;
      newRequest.targetDestinationType = "hospital";
    }

    this.requests.unshift(newRequest);

    // Broadcast instant SOS to all roles (Control Room overlay triggers immediately!)
    this.broadcast("sos_alert", newRequest);
    this.broadcast("request_created", newRequest);

    // Trigger Dynamic Reassessment Loop for any lower priority requests if team was drafted
    this.triggerDynamicReassessmentLoop("New SOS Distress Alert arrived");

    return newRequest;
  }

  // Create Standard Emergency Request Form
  public async createEmergencyRequest(data: {
    hazardType: HazardType;
    rescueType: string;
    location: LocationCoords;
    peopleAffected: number;
    vulnerabilities: VulnerableCounts;
    description: string;
    reporterName?: string;
    reporterContact?: string;
  }): Promise<EmergencyRequest> {
    const availableTeams = this.teams.filter((t) => t.status === "available" && t.isOnline !== false);
    const reqEquip = getRequiredEquipment(
      data.hazardType,
      data.rescueType,
      data.vulnerabilities
    );

    const scoreBreakdown = await calculatePriorityScore(
      data.hazardType,
      data.rescueType,
      data.peopleAffected,
      data.vulnerabilities,
      data.description,
      false,
      data.location,
      this.roadBlocks,
      availableTeams.length
    );

    const newRequest: EmergencyRequest = {
      id: `req-${Date.now()}`,
      isSOS: false,
      hazardType: data.hazardType,
      rescueType: data.rescueType,
      location: data.location,
      peopleAffected: data.peopleAffected,
      vulnerabilities: data.vulnerabilities,
      description: data.description,
      status: "pending_review",
      reportedAt: Date.now(),
      reporterName: data.reporterName || "Anonymous Citizen",
      reporterContact: data.reporterContact || "Not provided",
      priorityScore: scoreBreakdown.totalScore,
      scoreBreakdown,
      requiredEquipment: reqEquip,
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          actor: "Citizen Portal",
          action: "Submitted Emergency Request",
          note: `Hazard: ${data.hazardType} | Rescue: ${data.rescueType} | People: ${data.peopleAffected}`,
        },
      ],
    };

    // AI Team matching recommendation (handling 0 available teams gracefully)
    const match = matchBestRescueTeam(newRequest, availableTeams, this.roadBlocks);
    if (match.matchedTeam) {
      newRequest.assignedTeamId = match.matchedTeam.id;
      newRequest.assignedTeamName = match.matchedTeam.name;
      newRequest.teamMatchingExplanation = match.explanation;
      newRequest.etaMinutes = Math.max(
        5,
        Math.round(
          calculateDistanceKm(
            match.matchedTeam.location.lat,
            match.matchedTeam.location.lng,
            data.location.lat,
            data.location.lng
          ) * 2.8
        )
      );
    } else {
      newRequest.assignedTeamId = undefined;
      newRequest.assignedTeamName = undefined;
      newRequest.teamMatchingExplanation =
        match.explanation || "No rescue teams currently online or available. Request placed on reserve standby.";
      newRequest.auditLogs.push({
        id: `log-${Date.now()}-unassigned`,
        timestamp: Date.now(),
        actor: "AI Triage System",
        action: "Regional Standby Hold",
        note: "Zero available rescue teams online. Incident queued for incoming squad check-in.",
      });
    }

    // Destination suggestion (Hospital if injured or medical, otherwise Shelter)
    if (
      data.vulnerabilities.injured > 0 ||
      data.vulnerabilities.pregnant > 0 ||
      data.rescueType.toLowerCase().includes("medical")
    ) {
      const nearestHosp = this.findNearestHospital(data.location);
      if (nearestHosp) {
        newRequest.targetDestinationId = nearestHosp.id;
        newRequest.targetDestinationName = nearestHosp.name;
        newRequest.targetDestinationType = "hospital";
      }
    } else {
      const nearestShelter = this.findNearestShelter(data.location);
      if (nearestShelter) {
        newRequest.targetDestinationId = nearestShelter.id;
        newRequest.targetDestinationName = nearestShelter.name;
        newRequest.targetDestinationType = "shelter";
      }
    }

    this.requests.unshift(newRequest);
    this.broadcast("request_created", newRequest);

    return newRequest;
  }

  // Find Nearest Hospital
  public findNearestHospital(loc: LocationCoords): Hospital | null {
    const valid = this.hospitals.filter(
      (h) => h.operatingStatus === "Available" && h.availableBeds > 0
    );
    if (valid.length === 0) return this.hospitals[0] || null;

    return valid.reduce((closest, curr) => {
      const d1 = calculateDistanceKm(
        loc.lat,
        loc.lng,
        closest.location.lat,
        closest.location.lng
      );
      const d2 = calculateDistanceKm(
        loc.lat,
        loc.lng,
        curr.location.lat,
        curr.location.lng
      );
      return d2 < d1 ? curr : closest;
    }, valid[0]);
  }

  // Find Nearest Shelter
  public findNearestShelter(loc: LocationCoords): Shelter | null {
    const valid = this.shelters.filter(
      (s) => s.operatingStatus === "Available" && s.vacancies > 0
    );
    if (valid.length === 0) return this.shelters[0] || null;

    return valid.reduce((closest, curr) => {
      const d1 = calculateDistanceKm(
        loc.lat,
        loc.lng,
        closest.location.lat,
        closest.location.lng
      );
      const d2 = calculateDistanceKm(
        loc.lat,
        loc.lng,
        curr.location.lat,
        curr.location.lng
      );
      return d2 < d1 ? curr : closest;
    }, valid[0]);
  }

  // Control Room Action: Approve AI Assignment
  public approveAssignment(requestId: string, actor: string = "Control Room Authority"): EmergencyRequest | null {
    const req = this.requests.find((r) => r.id === requestId);
    if (!req) return null;

    if (!req.assignedTeamId) {
      const available = this.teams.filter((t) => t.status === "available");
      const match = matchBestRescueTeam(req, available, this.roadBlocks);
      if (match.matchedTeam) {
        req.assignedTeamId = match.matchedTeam.id;
        req.assignedTeamName = match.matchedTeam.name;
        req.teamMatchingExplanation = match.explanation;
      }
    }

    if (req.assignedTeamId) {
      const team = this.teams.find((t) => t.id === req.assignedTeamId);
      if (team) {
        team.status = "deployed";
        team.currentTaskId = req.id;
        team.workloadCount += 1;
      }
    }

    req.status = "assigned";
    this.addAuditLog(
      actor,
      "Approved Mission Dispatch",
      `Dispatched task to ${req.assignedTeamName || "Rescue Team"} with ETA: ${req.etaMinutes || 10} mins.`,
      req.id
    );

    // Register incoming referral if target hospital/shelter is assigned
    if (req.targetDestinationType === "hospital" && req.targetDestinationId) {
      const hosp = this.hospitals.find((h) => h.id === req.targetDestinationId);
      if (hosp) {
        hosp.incomingReferrals.unshift({
          requestId: req.id,
          patientCount: Math.max(1, req.vulnerabilities.injured || 1),
          urgency: req.priorityScore > 80 ? "critical" : "moderate",
          etaMinutes: req.etaMinutes || 15,
          assignedTeamName: req.assignedTeamName || "Rescue Squad",
          timestamp: Date.now(),
        });
      }
    } else if (req.targetDestinationType === "shelter" && req.targetDestinationId) {
      const shelter = this.shelters.find((s) => s.id === req.targetDestinationId);
      if (shelter) {
        shelter.incomingReferrals.unshift({
          requestId: req.id,
          peopleCount: req.peopleAffected,
          etaMinutes: req.etaMinutes || 20,
          assignedTeamName: req.assignedTeamName || "Rescue Squad",
          timestamp: Date.now(),
        });
      }
    }

    this.broadcast("request_updated", req);
    this.broadcast("teams_updated", this.teams);
    return req;
  }

  // Control Room Action: Reassign or Modify Task
  public reassignTask(
    requestId: string,
    newTeamId: string,
    reason: string,
    actor: string = "Control Room Authority"
  ): EmergencyRequest | null {
    const req = this.requests.find((r) => r.id === requestId);
    if (!req) return null;

    const oldTeamId = req.assignedTeamId;
    const oldTeam = this.teams.find((t) => t.id === oldTeamId);
    const newTeam = this.teams.find((t) => t.id === newTeamId);

    if (oldTeam) {
      oldTeam.status = "available";
      oldTeam.currentTaskId = undefined;
      oldTeam.workloadCount = Math.max(0, oldTeam.workloadCount - 1);
    }

    if (newTeam) {
      newTeam.status = "deployed";
      newTeam.currentTaskId = req.id;
      newTeam.workloadCount += 1;
    }

    const aiRecommendation = `AI Reassignment approved: Transferred from ${
      oldTeam?.name || "Unassigned"
    } to ${newTeam?.name || "New Team"}. Reason: ${reason}.`;

    if (!req.reassignmentHistory) req.reassignmentHistory = [];
    req.reassignmentHistory.unshift({
      timestamp: Date.now(),
      previousTeamId: oldTeamId || "none",
      previousTeamName: oldTeam?.name || "None",
      newTeamId: newTeam?.id,
      newTeamName: newTeam?.name,
      reason,
      aiRecommendation,
    });

    req.assignedTeamId = newTeam?.id;
    req.assignedTeamName = newTeam?.name;
    req.status = "assigned";

    this.addAuditLog(
      actor,
      "Manual Task Reassignment",
      `Task reassigned to ${newTeam?.name}. Reason: ${reason}`,
      req.id
    );

    this.broadcast("request_updated", req);
    this.broadcast("teams_updated", this.teams);
    return req;
  }

  // Rescue Team Status Progression
  public updateRescueTeamStatus(
    requestId: string,
    teamId: string,
    newStatus: EmergencyStatus,
    note?: string
  ): EmergencyRequest | null {
    const req = this.requests.find((r) => r.id === requestId);
    if (!req) return null;

    const team = this.teams.find((t) => t.id === teamId);

    req.status = newStatus;

    if (newStatus === "accepted") {
      if (team) team.status = "deployed";
      this.addAuditLog(team?.name || "Rescue Team", "Mission Accepted", note || "Team acknowledged dispatch.", req.id);
    } else if (newStatus === "on_the_way") {
      if (team) team.status = "deployed";
      this.addAuditLog(team?.name || "Rescue Team", "En Route to Incident Site", note || "Navigating towards incident location.", req.id);
    } else if (newStatus === "arrived") {
      this.addAuditLog(team?.name || "Rescue Team", "Arrived on Scene", note || "Commencing perimeter assessment and extraction.", req.id);
    } else if (newStatus === "helping") {
      this.addAuditLog(team?.name || "Rescue Team", "Extraction / Triage in Progress", note || "Administering medical care / stabilization.", req.id);
    } else if (newStatus === "completed") {
      if (team) {
        team.status = "available";
        team.currentTaskId = undefined;
        team.workloadCount = Math.max(0, team.workloadCount - 1);
      }
      this.addAuditLog(team?.name || "Rescue Team", "Mission Successfully Completed", note || "Survivors stabilized and evacuated.", req.id);

      // Trigger dynamic reassessment to allocate now-available team
      this.triggerDynamicReassessmentLoop(`${team?.name || "Rescue Team"} completed task and is now available`);
    } else if (newStatus === "withdrawn") {
      if (team) {
        team.status = "available";
        team.currentTaskId = undefined;
        team.workloadCount = Math.max(0, team.workloadCount - 1);
      }
      this.addAuditLog(
        team?.name || "Rescue Team",
        "Task Withdrawn / Rejected",
        note || "Team unable to proceed. Dynamic re-evaluation triggered.",
        req.id
      );

      // Trigger automatic re-evaluation and recommendation
      this.handleTeamWithdrawal(req, teamId, note || "Team rejected or became unavailable");
    }

    this.broadcast("request_updated", req);
    this.broadcast("teams_updated", this.teams);
    return req;
  }

  // Handle Team Withdrawal or Offline status
  private async handleTeamWithdrawal(req: EmergencyRequest, teamId: string, reason: string) {
    const availableTeams = this.teams.filter(
      (t) => t.id !== teamId && t.status === "available"
    );

    const match = matchBestRescueTeam(req, availableTeams, this.roadBlocks);
    req.status = "pending_review";

    const aiRec = match.matchedTeam
      ? `AI Dynamic Re-evaluation: Recommend immediate reassignment to ${match.matchedTeam.name} (${match.explanation}).`
      : "AI Escalation: No alternate rescue units immediately available. Escalating to regional reserve / mutual aid.";

    if (!req.reassignmentHistory) req.reassignmentHistory = [];
    req.reassignmentHistory.unshift({
      timestamp: Date.now(),
      previousTeamId: teamId,
      previousTeamName: this.teams.find((t) => t.id === teamId)?.name || "Previous Team",
      newTeamId: match.matchedTeam?.id,
      newTeamName: match.matchedTeam?.name,
      reason,
      aiRecommendation: aiRec,
    });

    req.assignedTeamId = match.matchedTeam?.id;
    req.assignedTeamName = match.matchedTeam?.name;
    req.teamMatchingExplanation = match.explanation;

    this.addAuditLog(
      "AI Dynamic Reassessment",
      "Automatic Team Fallback Triggered",
      `Team withdrew (${reason}). ${aiRec}`,
      req.id
    );

    this.broadcast("request_updated", req);
    this.broadcast("system_alert", {
      type: "team_withdrawn",
      message: `Team withdrew from task #${req.id}. AI generated alternate dispatch recommendation.`,
      requestId: req.id,
    });
  }

  // Citizen Cancels Request
  public cancelEmergencyRequest(requestId: string, reason: string = "Citizen cancelled"): EmergencyRequest | null {
    const req = this.requests.find((r) => r.id === requestId);
    if (!req) return null;

    req.status = "cancelled";

    if (req.assignedTeamId) {
      const team = this.teams.find((t) => t.id === req.assignedTeamId);
      if (team) {
        team.status = "available";
        team.currentTaskId = undefined;
        team.workloadCount = Math.max(0, team.workloadCount - 1);
      }
    }

    this.addAuditLog("Citizen", "Cancelled Emergency Request", `Reason: ${reason}`, req.id);
    this.broadcast("request_updated", req);
    this.broadcast("teams_updated", this.teams);

    // Freeing up team might allow reallocating to other queued requests
    this.triggerDynamicReassessmentLoop("Task cancelled, freed rescue unit");
    return req;
  }

  // Report Missing Person
  public reportMissingPerson(data: {
    name: string;
    age: number;
    gender: string;
    lastSeenLocation: string;
    lastSeenCoordinates?: { lat: number; lng: number };
    physicalFeatures: string;
    identificationMarks: string;
    photoUrl?: string;
    reporterName: string;
    reporterPhone: string;
  }): MissingPerson {
    const newPerson: MissingPerson = {
      id: `mp-${Date.now()}`,
      ...data,
      status: "missing",
      reportedAt: Date.now(),
    };

    this.missingPersons.unshift(newPerson);
    this.addAuditLog(
      `Citizen (${data.reporterName})`,
      "Reported Missing Person",
      `Missing: ${data.name}, Age ${data.age}, ${data.gender}. Last seen: ${data.lastSeenLocation}`
    );

    // Cross-check immediately against all shelter rescued rosters
    this.autoMatchMissingWithRescued();

    this.broadcast("missing_person_added", newPerson);
    return newPerson;
  }

  // Report Road Block
  public async reportRoadBlock(data: {
    roadName: string;
    location: { lat: number; lng: number };
    blockageType: RoadBlock["blockageType"];
    description: string;
    severity?: "partial" | "complete_closure";
    reportedBy: string;
  }): Promise<RoadBlock> {
    const newBlock: RoadBlock = {
      id: `rb-${Date.now()}`,
      roadName: data.roadName,
      location: data.location,
      blockageType: data.blockageType,
      description: data.description,
      severity: data.severity || "complete_closure",
      reportedBy: data.reportedBy,
      reportedAt: Date.now(),
      status: "active",
    };

    this.roadBlocks.unshift(newBlock);
    this.addAuditLog(
      data.reportedBy,
      "Reported Road Obstruction",
      `${data.roadName} blocked due to ${data.blockageType}.`
    );

    // Dynamic Reassessment: Re-evaluate any active routes or incident accessibility
    await this.triggerDynamicReassessmentLoop(`Road block reported on ${data.roadName}`);

    this.broadcast("roadblock_added", newBlock);
    return newBlock;
  }

  // Clear Road Block
  public async clearRoadBlock(id: string, actor: string = "Control Room Authority"): Promise<RoadBlock | null> {
    const block = this.roadBlocks.find((b) => b.id === id);
    if (!block) return null;

    block.status = "cleared";
    this.addAuditLog(actor, "Road Blockage Cleared", `${block.roadName} cleared and reopened to transit.`);

    await this.triggerDynamicReassessmentLoop(`Road reopened: ${block.roadName}`);
    this.broadcast("roadblock_updated", block);
    return block;
  }

  // Shelter: Rescued / Unknown Person Intake
  public registerRescuedPerson(
    shelterId: string,
    person: Omit<RescuedUnknownPerson, "id" | "intakeTimestamp">
  ): RescuedUnknownPerson | null {
    const shelter = this.shelters.find((s) => s.id === shelterId);
    if (!shelter) return null;

    const newRescued: RescuedUnknownPerson = {
      id: `rp-${Date.now()}`,
      ...person,
      intakeTimestamp: Date.now(),
    };

    shelter.rescuedPersons.unshift(newRescued);
    shelter.currentOccupancy += 1;
    shelter.vacancies = Math.max(0, shelter.totalCapacity - shelter.currentOccupancy);

    this.addAuditLog(
      `Shelter (${shelter.name})`,
      "Rescued Individual Intake",
      `Intake logged: ${person.name || "Unknown"} found at ${person.foundLocation}`
    );

    // Cross reference against missing persons list!
    this.autoMatchMissingWithRescued();

    this.broadcast("shelter_updated", shelter);
    this.broadcast("missing_persons_updated", this.missingPersons);
    return newRescued;
  }

  // Hospital: Update Capacity & Emergency Status
  public updateHospitalStatus(
    id: string,
    data: {
      availableBeds?: number;
      icuVacancies?: number;
      doctorsAvailable?: number;
      emergencyStatus?: Hospital["emergencyStatus"];
      operatingStatus?: Hospital["operatingStatus"];
      contact?: string;
    }
  ): Hospital | null {
    const hosp = this.hospitals.find((h) => h.id === id);
    if (!hosp) return null;

    if (data.availableBeds !== undefined) hosp.availableBeds = data.availableBeds;
    if (data.icuVacancies !== undefined) hosp.icuVacancies = data.icuVacancies;
    if (data.doctorsAvailable !== undefined) hosp.doctorsAvailable = data.doctorsAvailable;
    if (data.emergencyStatus !== undefined) hosp.emergencyStatus = data.emergencyStatus;
    if (data.operatingStatus !== undefined) hosp.operatingStatus = data.operatingStatus;
    if (data.contact !== undefined) hosp.contact = data.contact;

    this.addAuditLog(
      `Hospital (${hosp.name})`,
      "Capacity / Status Update",
      `Operating Status: ${hosp.operatingStatus} | Available Beds: ${hosp.availableBeds} | ICU: ${hosp.icuVacancies}`
    );

    // If hospital reached full or damaged, trigger dynamic reassessment
    if (hosp.operatingStatus === "Full" || hosp.operatingStatus === "Damaged" || hosp.availableBeds === 0) {
      this.handleHospitalCapacityExhaustion(hosp);
    }

    this.broadcast("hospital_updated", hosp);
    return hosp;
  }

  // Handle hospital diverted / full
  private handleHospitalCapacityExhaustion(hosp: Hospital) {
    const affectedReqs = this.requests.filter(
      (r) =>
        r.targetDestinationId === hosp.id &&
        (r.status === "assigned" || r.status === "accepted" || r.status === "on_the_way")
    );

    for (const req of affectedReqs) {
      const alternate = this.hospitals.find(
        (h) => h.id !== hosp.id && h.operatingStatus === "Available" && h.availableBeds > 5
      );
      if (alternate) {
        req.targetDestinationId = alternate.id;
        req.targetDestinationName = alternate.name;
        this.addAuditLog(
          "AI Dynamic Reassessment",
          "Hospital Re-routing",
          `${hosp.name} reported ${hosp.operatingStatus}. Re-routed transport for Incident #${req.id} to ${alternate.name}.`,
          req.id
        );
        this.broadcast("request_updated", req);
      }
    }
  }

  // Shelter: Update Capacity, Food & Water
  public updateShelterStatus(
    id: string,
    data: {
      currentOccupancy?: number;
      operatingStatus?: Shelter["operatingStatus"];
      foodDaysRemaining?: number;
      waterSupplyLitres?: number;
      contact?: string;
    }
  ): Shelter | null {
    const shelter = this.shelters.find((s) => s.id === id);
    if (!shelter) return null;

    if (data.currentOccupancy !== undefined) {
      shelter.currentOccupancy = data.currentOccupancy;
      shelter.vacancies = Math.max(0, shelter.totalCapacity - shelter.currentOccupancy);
    }
    if (data.operatingStatus !== undefined) shelter.operatingStatus = data.operatingStatus;
    if (data.foodDaysRemaining !== undefined) shelter.foodDaysRemaining = data.foodDaysRemaining;
    if (data.waterSupplyLitres !== undefined) shelter.waterSupplyLitres = data.waterSupplyLitres;
    if (data.contact !== undefined) shelter.contact = data.contact;

    this.addAuditLog(
      `Shelter (${shelter.name})`,
      "Capacity / Logistics Update",
      `Occupancy: ${shelter.currentOccupancy}/${shelter.totalCapacity} | Food Days: ${shelter.foodDaysRemaining}`
    );

    this.broadcast("shelter_updated", shelter);
    return shelter;
  }

  // Toggle Team Status (e.g. going offline / available)
  public toggleTeamStatus(
    teamId: string,
    status: RescueTeam["status"]
  ): RescueTeam | null {
    const team = this.teams.find((t) => t.id === teamId);
    if (!team) return null;

    team.status = status;
    this.addAuditLog(
      team.name,
      "Team Status Change",
      `Status changed to ${status.toUpperCase()}`
    );

    // If team had an active assignment and went offline, trigger reassignment!
    if ((status === "offline" || status === "busy") && team.currentTaskId) {
      const activeReq = this.requests.find((r) => r.id === team.currentTaskId);
      if (activeReq && activeReq.status !== "completed") {
        team.currentTaskId = undefined;
        this.handleTeamWithdrawal(
          activeReq,
          team.id,
          `Team transitioned to ${status.toUpperCase()} during mission`
        );
      }
    }

    this.broadcast("teams_updated", this.teams);
    return team;
  }

  // Publish Official Advisory
  public postOfficialUpdate(data: {
    title: string;
    content: string;
    priority: OfficialUpdate["priority"];
    issuedBy: string;
  }): OfficialUpdate {
    const update: OfficialUpdate = {
      id: `up-${Date.now()}`,
      ...data,
      timestamp: Date.now(),
    };

    this.officialUpdates.unshift(update);
    this.addAuditLog(
      data.issuedBy,
      "Issued Public Advisory",
      `[${data.priority.toUpperCase()}] ${data.title}`
    );

    this.broadcast("official_update_added", update);
    return update;
  }

  // Dynamic Reassessment Loop Trigger
  public async triggerDynamicReassessmentLoop(triggerReason: string) {
    const availableTeams = this.teams.filter((t) => t.status === "available");
    const pendingReqs = this.requests.filter((r) => r.status === "pending_review");

    for (const req of pendingReqs) {
      const prevScore = req.priorityScore;
      const newScore = await calculatePriorityScore(
        req.hazardType,
        req.rescueType,
        req.peopleAffected,
        req.vulnerabilities,
        req.description,
        req.isSOS,
        req.location,
        this.roadBlocks,
        availableTeams.length
      );

      req.priorityScore = newScore.totalScore;
      req.scoreBreakdown = newScore;

      // Re-evaluate team match if unassigned or if better team became free
      const match = matchBestRescueTeam(req, availableTeams, this.roadBlocks);
      if (match.matchedTeam && match.matchedTeam.id !== req.assignedTeamId) {
        req.assignedTeamId = match.matchedTeam.id;
        req.assignedTeamName = match.matchedTeam.name;
        req.teamMatchingExplanation = match.explanation;
      }

      if (Math.abs(newScore.totalScore - prevScore) >= 5) {
        this.addAuditLog(
          "AI Dynamic Reassessment Loop",
          "Recalculated Incident Priority",
          `Score adjusted from ${prevScore} to ${newScore.totalScore} due to: ${triggerReason}`,
          req.id
        );
      }
    }

    // Sort pending requests by highest priority first
    this.requests.sort((a, b) => {
      // Keep active before completed
      const activeA = a.status !== "completed" && a.status !== "cancelled" ? 1 : 0;
      const activeB = b.status !== "completed" && b.status !== "cancelled" ? 1 : 0;
      if (activeA !== activeB) return activeB - activeA;
      // High priority first
      return b.priorityScore - a.priorityScore;
    });

    this.broadcast("dynamic_reassessment_completed", {
      reason: triggerReason,
      timestamp: Date.now(),
    });
    this.broadcast("requests_batch_update", this.requests);
  }

  // --- RESCUE TEAM & TELEMETRY SUBSYSTEM ---

  public recordStatusHistory(teamId: string, oldStatus: string, newStatus: string, reason: string) {
    const entry: TeamStatusHistoryEntry = {
      team_id: teamId,
      old_status: oldStatus,
      new_status: newStatus,
      reason,
      timestamp: Date.now(),
    };
    this.teamStatusHistory.unshift(entry);
    return entry;
  }

  // Get assignments strictly for an authenticated rescue team
  public getAssignmentsForTeam(teamId: string): AssignmentDocument[] {
    return this.assignments.filter(
      (a) =>
        a.active_team === teamId ||
        a.primary_team === teamId ||
        (a.backup_teams && a.backup_teams.includes(teamId))
    );
  }

  // Create Assignment Document with targeted notification (Control Room -> specific Rescue Team)
  public createAssignment(
    emergencyId: string,
    primaryTeamId: string,
    backupTeamIds?: string[]
  ): AssignmentDocument {
    const req = this.requests.find((r) => r.id === emergencyId);
    const primaryTeam = this.teams.find((t) => t.id === primaryTeamId);
    if (!req || !primaryTeam) {
      throw new Error("Emergency request or primary team not found");
    }

    // Auto-calculate candidate backup teams if not explicitly provided
    let backups = backupTeamIds || [];
    if (backups.length === 0) {
      const candidates = this.teams.filter(
        (t) => t.id !== primaryTeamId && t.status !== "offline" && t.operationalStatus !== "STUCK"
      );
      backups = candidates.slice(0, 2).map((c) => c.id);
    }

    const assignment: AssignmentDocument = {
      _id: `asg-${emergencyId}-${Date.now()}`,
      emergency_id: emergencyId,
      primary_team: primaryTeamId,
      backup_teams: backups,
      active_team: primaryTeamId,
      status: "PENDING",
      required_response_minutes: req.priorityScore > 85 ? 8 : 12,
      current_eta: req.etaMinutes || 8,
      predicted_eta: req.etaMinutes || 8,
      plan_validity: "VALID",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assignment_sent_at: Date.now(),
      response_deadline_at: Date.now() + 60000, // 60s response window
      response_status: "WAITING",
    };

    this.assignments.unshift(assignment);

    // Update emergency request state
    req.assignedTeamId = primaryTeamId;
    req.assignedTeamName = primaryTeam.name;
    req.status = "assigned";

    // Update team
    primaryTeam.status = "deployed";
    primaryTeam.operationalStatus = "ASSIGNED";
    primaryTeam.currentTaskId = emergencyId;
    primaryTeam.workloadCount += 1;
    this.recordStatusHistory(primaryTeam.id, "AVAILABLE", "ASSIGNED", `Dispatched to incident #${emergencyId}`);

    // TARGETED NOTIFICATION: Only to rescue_team_${primaryTeamId} and admin_room!
    // Control Room MUST NOT broadcast every emergency to every rescue team.
    this.emitTargeted(`rescue_team_${primaryTeamId}`, "TASK_ASSIGNED", {
      assignment,
      emergency: req,
      message: `Direct Mission Assignment: ${req.rescueType} at ${req.location.address}`,
    });

    this.createTargetedNotification({
      recipient_type: "RESCUE_TEAM",
      recipient_id: `rescue_team_${primaryTeamId}`,
      event_type: "TASK_ASSIGNED",
      emergency_id: emergencyId,
      title: `Mission Assignment #${req.id}`,
      message: `Dispatched to ${req.rescueType} (${req.peopleAffected} survivors). Priority Score: ${req.priorityScore}/100.`,
      priority: "CRITICAL",
      metadata: { assignmentId: assignment._id, etaMinutes: req.etaMinutes },
    });

    // Notify admin room
    this.emitTargeted("admin_room", "assignment_created", {
      assignment,
      emergency: req,
      primaryTeam,
    });

    // Notify citizen if contact is present
    if (req.reporterContact) {
      this.emitTargeted(`citizen_${req.reporterContact}`, "status_update", {
        status: "assigned",
        assignedTeamName: primaryTeam.name,
        etaMinutes: req.etaMinutes,
        message: `Rescue team ${primaryTeam.name} has been assigned to your emergency report.`,
      });
    }

    this.addAuditLog(
      "Control Room Authority",
      "Mission Assigned (Targeted)",
      `Assigned task #${req.id} to ${primaryTeam.name}. Standby backups: ${backups.join(", ") || "None"}.`,
      req.id
    );

    this.broadcast("request_updated", req);
    this.broadcast("teams_updated", this.teams);
    this.persist();
    return assignment;
  }

  // Rescue Team accepts assignment
  public acceptAssignment(
    assignmentId: string,
    teamId: string,
    note?: string
  ): AssignmentDocument | null {
    const asg = this.assignments.find((a) => a._id === assignmentId || a.emergency_id === assignmentId);
    if (!asg) return null;
    const team = this.teams.find((t) => t.id === teamId);
    const req = this.requests.find((r) => r.id === asg.emergency_id);

    asg.status = "ACCEPTED";
    asg.response_status = "ACCEPTED";
    asg.updated_at = new Date().toISOString();

    if (team) {
      this.recordStatusHistory(team.id, team.operationalStatus || "ASSIGNED", "ACCEPTED", note || "Team acknowledged dispatch");
      team.operationalStatus = "ACCEPTED";
      team.status = "deployed";
    }

    if (req) {
      req.status = "accepted";
      this.broadcast("request_updated", req);
    }

    this.emitTargeted("admin_room", "TASK_ACCEPTED", {
      assignment: asg,
      teamId,
      teamName: team?.name,
      timestamp: Date.now(),
    });

    this.emitTargeted(`rescue_team_${teamId}`, "TASK_STATUS_UPDATED", {
      assignment: asg,
      status: "ACCEPTED",
    });

    if (req?.reporterContact) {
      this.emitTargeted(`citizen_${req.reporterContact}`, "status_update", {
        status: "accepted",
        teamName: team?.name,
        message: `Rescue team ${team?.name} accepted your mission and is initiating departure.`,
      });
    }

    this.addAuditLog(
      team?.name || "Rescue Team",
      "Mission Dispatch Accepted",
      note || "Team acknowledged assignment within response window.",
      req?.id
    );

    this.persist();
    return asg;
  }

  // Rescue Team rejects assignment
  public rejectAssignment(
    assignmentId: string,
    teamId: string,
    reason: string
  ): AssignmentDocument | null {
    const asg = this.assignments.find((a) => a._id === assignmentId || a.emergency_id === assignmentId);
    if (!asg) return null;
    const team = this.teams.find((t) => t.id === teamId);
    const req = this.requests.find((r) => r.id === asg.emergency_id);

    asg.status = "REJECTED";
    asg.response_status = "REJECTED";
    asg.reason = reason;
    asg.plan_validity = "INVALID";
    asg.updated_at = new Date().toISOString();

    if (team) {
      this.recordStatusHistory(team.id, team.operationalStatus || "ASSIGNED", "REJECTED", reason);
      team.operationalStatus = "AVAILABLE";
      team.status = "available";
      team.currentTaskId = undefined;
      team.workloadCount = Math.max(0, team.workloadCount - 1);
    }

    if (req) {
      req.status = "pending_review";
    }

    // Evaluate failover candidate immediately
    const failover = this.evaluateFailover(asg._id);

    this.emitTargeted("admin_room", "TASK_REJECTED", {
      assignment: asg,
      teamId,
      teamName: team?.name,
      reason,
      failoverRecommendation: failover,
    });

    this.createTargetedNotification({
      recipient_type: "ADMIN",
      recipient_id: "admin_room",
      event_type: "TASK_REJECTED",
      emergency_id: asg.emergency_id,
      title: `URGENT: ${team?.name || teamId} Rejected Dispatch`,
      message: `Squad rejected task #${asg.emergency_id} (${reason}). AI recommends activating ${failover.recommendedBackup?.name || "Standby unit"}.`,
      priority: "CRITICAL",
      metadata: { assignmentId: asg._id, failover },
    });

    this.addAuditLog(
      team?.name || "Rescue Team",
      "Rejected Mission Dispatch",
      `Reason: ${reason}`,
      req?.id
    );

    this.broadcast("teams_updated", this.teams);
    this.persist();
    return asg;
  }

  // Rescue Team reports stuck (in water, debris, mechanical failure)
  public reportStuck(
    assignmentId: string,
    teamId: string,
    reason: string
  ): AssignmentDocument | null {
    const asg = this.assignments.find((a) => a._id === assignmentId || a.emergency_id === assignmentId);
    if (!asg) return null;
    const team = this.teams.find((t) => t.id === teamId);
    const req = this.requests.find((r) => r.id === asg.emergency_id);

    asg.status = "STUCK";
    asg.plan_validity = "INVALID";
    asg.reason = reason;
    asg.predicted_eta = Math.max(16, asg.current_eta + 10);
    asg.updated_at = new Date().toISOString();

    if (team) {
      this.recordStatusHistory(team.id, team.operationalStatus || "EN_ROUTE", "STUCK", reason);
      team.operationalStatus = "STUCK";
      team.speed = 0;
    }

    const failover = this.evaluateFailover(asg._id);

    this.emitTargeted("admin_room", "TEAM_STUCK_ALERT", {
      assignment: asg,
      teamId,
      teamName: team?.name,
      vehicleId: team?.vehicleId,
      reason,
      failoverRecommendation: failover,
    });

    this.createTargetedNotification({
      recipient_type: "ADMIN",
      recipient_id: "admin_room",
      event_type: "TEAM_STUCK_ALERT",
      emergency_id: asg.emergency_id,
      title: `CRITICAL ALERT: Squad ${team?.name || teamId} is STUCK`,
      message: `Squad immobilized on ${team?.currentRoad || "route"}: ${reason}. Plan validity INVALID. Failover recommended: ${failover.recommendedBackup?.name || "RT18"}.`,
      priority: "CRITICAL",
      metadata: { assignmentId: asg._id, teamId, failover },
    });

    this.emitTargeted(`rescue_team_${teamId}`, "STUCK_ACKNOWLEDGED", {
      assignment: asg,
      message: "Control Room notified of vehicle immobilization. Contingency backup is being mobilized.",
    });

    this.addAuditLog(
      team?.name || "Rescue Team",
      "Vehicle Immobilized / Stuck",
      reason,
      req?.id
    );

    this.broadcast("teams_updated", this.teams);
    this.persist();
    return asg;
  }

  // Rescue Team reports failure
  public reportFailure(
    assignmentId: string,
    teamId: string,
    reason: string
  ): AssignmentDocument | null {
    const asg = this.assignments.find((a) => a._id === assignmentId || a.emergency_id === assignmentId);
    if (!asg) return null;
    const team = this.teams.find((t) => t.id === teamId);
    const req = this.requests.find((r) => r.id === asg.emergency_id);

    asg.status = "AT_RISK";
    asg.plan_validity = "INVALID";
    asg.reason = `Vehicle Failure: ${reason}`;
    asg.updated_at = new Date().toISOString();

    if (team) {
      this.recordStatusHistory(team.id, team.operationalStatus || "EN_ROUTE", "FAILED", reason);
      team.operationalStatus = "FAILED";
      team.speed = 0;
    }

    const failover = this.evaluateFailover(asg._id);

    this.emitTargeted("admin_room", "TEAM_FAILURE_ALERT", {
      assignment: asg,
      teamId,
      teamName: team?.name,
      reason,
      failoverRecommendation: failover,
    });

    this.createTargetedNotification({
      recipient_type: "ADMIN",
      recipient_id: "admin_room",
      event_type: "TEAM_FAILURE_ALERT",
      emergency_id: asg.emergency_id,
      title: `ALERT: Mechanical/Equipment Failure on Squad ${team?.name || teamId}`,
      message: `Squad reported failure: ${reason}. Automated backup recommended.`,
      priority: "CRITICAL",
      metadata: { assignmentId: asg._id, teamId, failover },
    });

    this.addAuditLog(team?.name || "Rescue Team", "Equipment / Vehicle Failure", reason, req?.id);
    this.broadcast("teams_updated", this.teams);
    this.persist();
    return asg;
  }

  // Control Room Action: Reserve Backup Team
  public reserveBackup(
    assignmentId: string,
    backupTeamId: string,
    actor: string = "Control Room Officer"
  ): AssignmentDocument | null {
    const asg = this.assignments.find((a) => a._id === assignmentId || a.emergency_id === assignmentId);
    if (!asg) return null;
    const backupTeam = this.teams.find((t) => t.id === backupTeamId);
    const originalTeam = this.teams.find((t) => t.id === asg.active_team);
    if (!backupTeam) return null;

    if (!asg.backup_teams.includes(backupTeamId)) {
      asg.backup_teams.push(backupTeamId);
    }
    asg.status = "FAILOVER_RESERVED";
    asg.updated_at = new Date().toISOString();

    const backupDist = calculateDistanceKm(backupTeam.location.lat, backupTeam.location.lng, 13.084, 80.263);
    const backupEta = Math.max(3, Math.round(backupDist * 2.5));

    const failoverEvent: FailoverEvent = {
      id: `fo-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      emergency_id: asg.emergency_id,
      timestamp: Date.now(),
      from_team: originalTeam?.id || asg.active_team,
      from_team_name: originalTeam?.name || "Primary Team",
      to_team: backupTeam.id,
      to_team_name: backupTeam.name,
      action: "RESERVE",
      reason: "Placed on standby contingency reserve for at-risk primary unit",
      predicted_eta_original: asg.predicted_eta,
      predicted_eta_backup: backupEta,
      response_threshold: asg.required_response_minutes,
      actor,
    };
    this.failoverEvents.unshift(failoverEvent);

    // Targeted notification strictly to the backup team
    this.emitTargeted(`rescue_team_${backupTeamId}`, "BACKUP_RESERVED", {
      assignment: asg,
      failoverEvent,
      message: `STANDBY ALERT: You have been placed on high-priority reserve for Incident #${asg.emergency_id}. Stand by for dispatch.`,
    });

    this.createTargetedNotification({
      recipient_type: "RESCUE_TEAM",
      recipient_id: `rescue_team_${backupTeamId}`,
      event_type: "BACKUP_RESERVED",
      emergency_id: asg.emergency_id,
      title: `STANDBY: Reserved as Backup Squad`,
      message: `You are designated standby reserve for emergency #${asg.emergency_id} if lead unit experiences impediments.`,
      priority: "URGENT",
    });

    this.emitTargeted("admin_room", "failover_event", failoverEvent);
    this.addAuditLog(
      actor,
      "Contingency Backup Reserved",
      `Reserved ${backupTeam.name} for Task #${asg.emergency_id} (Contingency ETA: ~${backupEta}m).`,
      asg.emergency_id
    );

    this.persist();
    return asg;
  }

  // Control Room Action: Activate Backup Team (Predictive Failover)
  public activateBackup(
    assignmentId: string,
    backupTeamId: string,
    reason: string,
    actor: string = "Control Room Officer"
  ): AssignmentDocument | null {
    const asg = this.assignments.find((a) => a._id === assignmentId || a.emergency_id === assignmentId);
    if (!asg) return null;
    const oldTeamId = asg.active_team;
    const oldTeam = this.teams.find((t) => t.id === oldTeamId);
    const newTeam = this.teams.find((t) => t.id === backupTeamId);
    const req = this.requests.find((r) => r.id === asg.emergency_id);

    if (!newTeam) return null;

    const oldEta = asg.predicted_eta;
    const newEta = Math.max(
      3,
      Math.round(
        calculateDistanceKm(
          newTeam.location.lat,
          newTeam.location.lng,
          req?.location.lat || 13.084,
          req?.location.lng || 80.263
        ) * 2.4
      )
    );

    // Update assignment
    asg.active_team = backupTeamId;
    asg.status = "FAILOVER_ACTIVE";
    asg.plan_validity = "VALID";
    asg.current_eta = newEta;
    asg.predicted_eta = newEta;
    asg.updated_at = new Date().toISOString();

    // Update teams
    if (oldTeam) {
      if (oldTeam.operationalStatus !== "STUCK" && oldTeam.operationalStatus !== "FAILED") {
        oldTeam.operationalStatus = "AVAILABLE";
        oldTeam.status = "available";
        oldTeam.currentTaskId = undefined;
        oldTeam.workloadCount = Math.max(0, oldTeam.workloadCount - 1);
      }
    }

    newTeam.operationalStatus = "ASSIGNED";
    newTeam.status = "deployed";
    newTeam.currentTaskId = asg.emergency_id;
    newTeam.workloadCount += 1;

    if (req) {
      req.assignedTeamId = newTeam.id;
      req.assignedTeamName = newTeam.name;
      req.etaMinutes = newEta;
      req.status = "assigned";

      if (!req.reassignmentHistory) req.reassignmentHistory = [];
      req.reassignmentHistory.unshift({
        timestamp: Date.now(),
        previousTeamId: oldTeamId,
        previousTeamName: oldTeam?.name || "Previous Team",
        newTeamId: newTeam.id,
        newTeamName: newTeam.name,
        reason,
        aiRecommendation: `Predictive Failover Activated: Primary unit ${oldTeam?.name || oldTeamId} blocked or delayed (${reason}). Mission transferred to backup squad ${newTeam.name}.`,
      });
    }

    // Create Failover Event
    const failoverEvent: FailoverEvent = {
      id: `fo-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      emergency_id: asg.emergency_id,
      timestamp: Date.now(),
      from_team: oldTeamId,
      from_team_name: oldTeam?.name || "Old Team",
      to_team: newTeam.id,
      to_team_name: newTeam.name,
      action: "ACTIVATE",
      reason,
      predicted_eta_original: oldEta,
      predicted_eta_backup: newEta,
      response_threshold: asg.required_response_minutes,
      actor,
    };
    this.failoverEvents.unshift(failoverEvent);

    // TARGETED NOTIFICATIONS:
    // 1. New team: receives TASK_ASSIGNED / BACKUP_ACTIVATED
    this.emitTargeted(`rescue_team_${newTeam.id}`, "TASK_ASSIGNED", {
      assignment: asg,
      emergency: req,
      failoverEvent,
      isFailover: true,
      message: `MISSION ACTIVATION: You are now active lead squad for Incident #${asg.emergency_id}. Proceed immediately.`,
    });

    this.createTargetedNotification({
      recipient_type: "RESCUE_TEAM",
      recipient_id: `rescue_team_${newTeam.id}`,
      event_type: "TASK_ASSIGNED",
      emergency_id: asg.emergency_id,
      title: `MISSION ACTIVATION: Incident #${asg.emergency_id}`,
      message: `You are now designated primary unit for ${req?.rescueType || "Rescue"}. Target ETA: ~${newEta} mins.`,
      priority: "CRITICAL",
      metadata: { assignmentId: asg._id, etaMinutes: newEta },
    });

    // 2. Old team: receives TASK_WITHDRAWN / TASK_REASSIGNED
    this.emitTargeted(`rescue_team_${oldTeamId}`, "TASK_REASSIGNED", {
      assignment: asg,
      failoverEvent,
      message: `Mission #${asg.emergency_id} reassigned to ${newTeam.name} due to ${reason}.`,
    });

    this.createTargetedNotification({
      recipient_type: "RESCUE_TEAM",
      recipient_id: `rescue_team_${oldTeamId}`,
      event_type: "TASK_REASSIGNED",
      emergency_id: asg.emergency_id,
      title: `Mission Reassigned: Incident #${asg.emergency_id}`,
      message: `Mission transferred to ${newTeam.name}. Reason: ${reason}.`,
      priority: "STANDARD",
    });

    // 3. Citizen: receives updated status
    if (req?.reporterContact) {
      this.emitTargeted(`citizen_${req.reporterContact}`, "status_update", {
        status: "assigned",
        assignedTeamName: newTeam.name,
        etaMinutes: newEta,
        message: `Rescue team reassigned to ${newTeam.name} to avoid route delay. New estimated arrival: ~${newEta} mins.`,
      });
    }

    // 4. Admin room receives failover event
    this.emitTargeted("admin_room", "failover_event", failoverEvent);

    this.addAuditLog(
      actor,
      "Predictive Failover Activated",
      `Mission #${asg.emergency_id} transferred from ${oldTeam?.name} to ${newTeam.name}. Reason: ${reason}`,
      req?.id
    );

    this.broadcast("request_updated", req);
    this.broadcast("teams_updated", this.teams);
    this.persist();
    return asg;
  }

  // Ingest Heartbeat from Rescue Team
  public ingestHeartbeat(
    teamId: string,
    vehicleId?: string,
    battery?: number
  ): { status: string; timestamp: number } {
    const team = this.teams.find((t) => t.id === teamId);
    const now = Date.now();
    if (team) {
      team.lastHeartbeat = now;
      if (battery !== undefined) team.batteryLevel = battery;
      if (vehicleId) team.vehicleId = vehicleId;
      team.isOnline = true;
    }
    return { status: "acknowledged", timestamp: now };
  }

  // Ingest GPS Telemetry from Rescue Team
  public ingestLocation(telemetry: RescueTeamTelemetry): TeamMonitoringMetric {
    this.teamLocations.set(telemetry.team_id, telemetry);

    const team = this.teams.find((t) => t.id === telemetry.team_id);
    if (team) {
      team.location = {
        lat: telemetry.latitude,
        lng: telemetry.longitude,
        address: telemetry.current_road || team.location.address,
      };
      team.speed = telemetry.speed;
      team.heading = telemetry.heading;
      team.gpsAccuracy = telemetry.gps_accuracy;
      if (telemetry.current_road) team.currentRoad = telemetry.current_road;
      if (telemetry.battery !== undefined) team.batteryLevel = telemetry.battery;
      team.lastGpsUpdate = telemetry.timestamp || Date.now();
      team.lastHeartbeat = Date.now();
      team.isOnline = true;
    }

    const metric = this.calculateTeamMonitoring(telemetry.team_id);

    // If team has active assignment, update predicted ETA and plan validity
    const asg = this.assignments.find((a) => a.active_team === telemetry.team_id && a.status !== "COMPLETED");
    if (asg) {
      asg.predicted_eta = metric.predicted_eta_minutes;
      asg.plan_validity = metric.plan_validity;
      asg.updated_at = new Date().toISOString();
    }

    this.emitTargeted("admin_room", "telemetry_updated", {
      telemetry,
      metric,
    });

    this.emitTargeted(`rescue_team_${telemetry.team_id}`, "telemetry_ack", {
      status: "synced",
      metric,
    });

    return metric;
  }

  // Calculate Comprehensive Team Monitoring Metrics (Stuck Probability, Failure Probability, Plan Validity)
  public calculateTeamMonitoring(teamId: string): TeamMonitoringMetric {
    const team = this.teams.find((t) => t.id === teamId);
    const asg = this.assignments.find(
      (a) => a.active_team === teamId && a.status !== "COMPLETED" && a.status !== "CANCELLED"
    );
    const req = asg ? this.requests.find((r) => r.id === asg.emergency_id) : undefined;
    const telemetry = this.teamLocations.get(teamId);

    const lat = telemetry?.latitude ?? team?.location.lat ?? 13.0827;
    const lng = telemetry?.longitude ?? team?.location.lng ?? 80.2707;
    const speed = telemetry?.speed ?? team?.speed ?? 0;
    const battery = telemetry?.battery ?? team?.batteryLevel ?? 92;
    const currentRoad = telemetry?.current_road ?? team?.currentRoad ?? "Marina Expressway Corridor";

    const targetLat = req?.location.lat ?? lat;
    const targetLng = req?.location.lng ?? lng;
    const distanceRemaining = calculateDistanceKm(lat, lng, targetLat, targetLng);

    const baselineDist = 4.0;
    const progressPercentage = Math.min(100, Math.max(0, Math.round((1 - distanceRemaining / baselineDist) * 100)));

    const now = Date.now();
    const commAge = team?.lastHeartbeat ? Math.round((now - team.lastHeartbeat) / 1000) : 8;
    const gpsAge = team?.lastGpsUpdate ? Math.round((now - team.lastGpsUpdate) / 1000) : 12;

    // Check route risk against roadblocks
    let routeRisk: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" = "LOW";
    const activeBlocks = this.roadBlocks.filter((rb) => rb.status === "active");
    for (const rb of activeBlocks) {
      const distToBlock = calculateDistanceKm(lat, lng, rb.location.lat, rb.location.lng);
      if (distToBlock < 0.6 || (currentRoad && currentRoad.toLowerCase().includes(rb.roadName.toLowerCase()))) {
        routeRisk = rb.severity === "complete_closure" ? "CRITICAL" : "HIGH";
        break;
      } else if (distToBlock < 1.6) {
        routeRisk = "MODERATE";
      }
    }

    // Stuck probability & Failure probability
    let stuckProb = 0.04;
    const reasons: string[] = [];

    if (team?.operationalStatus === "STUCK") {
      stuckProb = 1.0;
      reasons.push("Vehicle officially reported immobilized / submerged in water");
    } else if (asg && asg.status === "EN_ROUTE" && speed < 3) {
      stuckProb = 0.88;
      reasons.push("Stationary alert: vehicle speed near zero while active on emergency corridor");
    }

    if (routeRisk === "CRITICAL") {
      stuckProb = Math.max(stuckProb, 0.94);
      reasons.push(`Impassable obstruction detected on active route: ${currentRoad}`);
    } else if (routeRisk === "HIGH") {
      stuckProb = Math.max(stuckProb, 0.65);
      reasons.push(`High route congestion and hazard debris on ${currentRoad}`);
    }

    if (commAge > 90) {
      reasons.push(`Heartbeat delay: ${commAge}s without telemetry beacon`);
    }

    let failProb = stuckProb * 0.7;
    if (battery < 25) {
      failProb += 0.25;
      reasons.push(`Critical battery warning: ${battery}%`);
    }

    // Predicted ETA
    let predictedEta = asg?.current_eta || 8;
    if (speed === 0 && asg) {
      predictedEta = Math.max(predictedEta + 8, 16);
      reasons.push(`Zero velocity: estimated arrival stretched to ${predictedEta} min`);
    } else if (speed > 5) {
      predictedEta = Math.max(2, Math.round(distanceRemaining / (speed / 60)));
    }

    const requiredResponse = asg?.required_response_minutes || 8;
    const etaChange = asg ? predictedEta - requiredResponse : 0;

    // Plan validity calculation
    let planValidity: PlanValidityStatus = "VALID";
    if (
      stuckProb >= 0.75 ||
      predictedEta > requiredResponse + 4 ||
      routeRisk === "CRITICAL" ||
      team?.operationalStatus === "STUCK" ||
      team?.operationalStatus === "FAILED"
    ) {
      planValidity = "INVALID";
    } else if (stuckProb >= 0.4 || predictedEta > requiredResponse || routeRisk === "HIGH") {
      planValidity = "AT_RISK";
    }

    // Recommended backup calculation if plan is AT_RISK or INVALID
    let recommendedBackup: TeamMonitoringMetric["recommended_backup"] = undefined;
    if (asg && (planValidity === "INVALID" || planValidity === "AT_RISK")) {
      const backupEval = this.evaluateFailover(asg._id);
      if (backupEval.recommendedBackup) {
        const bTeam = backupEval.recommendedBackup;
        const bDist = calculateDistanceKm(bTeam.location.lat, bTeam.location.lng, targetLat, targetLng);
        const bEta = Math.max(3, Math.round(bDist * 2.4));
        recommendedBackup = {
          team_id: bTeam.id,
          team_name: bTeam.name,
          predicted_eta: bEta,
          distance_km: Math.round(bDist * 10) / 10,
          equipment_match: true,
          specialization_match: true,
          road_risk: "LOW",
          workload: bTeam.workloadCount,
          score: 95,
          reason: backupEval.reason,
        };
      }
    }

    return {
      team_id: teamId,
      team_name: team?.name || teamId,
      vehicle_id: team?.vehicleId || "MDT-01",
      emergency_id: asg?.emergency_id,
      operational_status: team?.operationalStatus || "AVAILABLE",
      stuck_probability: Math.min(1, Math.round(stuckProb * 100) / 100),
      failure_probability: Math.min(1, Math.round(failProb * 100) / 100),
      progress_percentage: progressPercentage,
      distance_remaining_km: Math.round(distanceRemaining * 10) / 10,
      time_since_last_movement_seconds: speed === 0 ? 190 : 0,
      eta_change_minutes: etaChange,
      route_risk: routeRisk,
      communication_age_seconds: commAge,
      gps_age_seconds: gpsAge,
      speed_kmh: speed,
      reasons,
      plan_validity: planValidity,
      original_eta_minutes: asg?.current_eta || 8,
      predicted_eta_minutes: predictedEta,
      required_response_minutes: requiredResponse,
      recommended_backup: recommendedBackup,
    };
  }

  // Get monitoring metrics for all teams
  public getAllTeamsMonitoring(): TeamMonitoringMetric[] {
    return this.teams.map((t) => this.calculateTeamMonitoring(t.id));
  }

  // Multi-criteria evaluation of backup rescue teams for an emergency
  public evaluateFailover(
    assignmentId: string
  ): { recommendedBackup: RescueTeam | null; candidates: any[]; reason: string } {
    const asg = this.assignments.find((a) => a._id === assignmentId || a.emergency_id === assignmentId);
    const req = asg ? this.requests.find((r) => r.id === asg.emergency_id) : undefined;
    if (!asg || !req) {
      return { recommendedBackup: null, candidates: [], reason: "Assignment not found" };
    }

    const availableTeams = this.teams.filter(
      (t) =>
        t.id !== asg.active_team &&
        t.status !== "offline" &&
        t.operationalStatus !== "STUCK" &&
        t.operationalStatus !== "FAILED"
    );

    const targetLoc = req.location;
    const isFlood = req.hazardType === "Flood" || req.rescueType.toLowerCase().includes("water");

    const scored = availableTeams.map((team) => {
      const dist = calculateDistanceKm(team.location.lat, team.location.lng, targetLoc.lat, targetLoc.lng);
      const eta = Math.max(3, Math.round(dist * 2.4));

      const hasBoat =
        team.resources.some((r) => r.name.toLowerCase().includes("boat")) ||
        (team.equipment && team.equipment.some((e) => e.toLowerCase().includes("boat"))) ||
        team.specialization.some((s) => s.toLowerCase().includes("water"));

      const isAvailable = team.status === "available" || team.operationalStatus === "AVAILABLE";

      let score = 100 - eta * 3 - dist * 5;
      if (isFlood && hasBoat) score += 45;
      if (isFlood && !hasBoat) score -= 55; // Strict equipment penalty
      if (isAvailable) score += 20;
      if (team.workloadCount > 0) score -= team.workloadCount * 15;

      return {
        team,
        distanceKm: Math.round(dist * 10) / 10,
        predictedEta: eta,
        hasRequiredEquipment: isFlood ? hasBoat : true,
        score: Math.max(0, Math.round(score)),
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    const reason = best
      ? `Selected ${best.team.name}: ETA ~${best.predictedEta}m (${best.distanceKm}km). Equipped with ${
          best.hasRequiredEquipment ? "Zodiac boat and flood rescue systems" : "standard extraction kits"
        }. High readiness score: ${best.score}/100.`
      : "No suitable alternative teams currently in range.";

    return {
      recommendedBackup: best ? best.team : null,
      candidates: scored,
      reason,
    };
  }

  // Simulation: Trigger Road Deterioration
  public simulateRoadDeterioration(
    roadName: string = "Marina Expressway Corridor R12",
    severity: "critical" | "blocked" = "blocked"
  ) {
    let block = this.roadBlocks.find((b) => b.roadName.toLowerCase().includes(roadName.toLowerCase()));
    if (!block) {
      block = {
        id: `rb-sim-${Date.now()}`,
        roadName,
        location: { lat: 13.0845, lng: 80.264 },
        blockageType: "Flooded",
        description: "Flash flood breach: 4.5ft of turbulent water across all lanes. Complete impassable closure.",
        severity: "complete_closure",
        reportedBy: "Road Telemetry Sensor S-12",
        reportedAt: Date.now(),
        status: "active",
      };
      this.roadBlocks.unshift(block);
    } else {
      block.status = "active";
      block.severity = "complete_closure";
    }

    // Check active team on that road (e.g. RT12)
    const affectedTeam = this.teams.find(
      (t) => t.id === "RT12" || (t.currentRoad && t.currentRoad.toLowerCase().includes("marina"))
    );
    if (affectedTeam) {
      affectedTeam.speed = 0;
      const monitoring = this.calculateTeamMonitoring(affectedTeam.id);

      this.emitTargeted("admin_room", "ROAD_DETERIORATION_ALERT", {
        roadBlock: block,
        affectedTeam: affectedTeam.name,
        monitoring,
        message: `CRITICAL: Embankment breached on ${roadName}. Squad ${affectedTeam.name} blocked. Plan validity: INVALID.`,
      });
    }

    this.broadcast("roadblock_added", block);
    this.broadcast("roadblocks_updated", this.roadBlocks);
    this.persist();
    return block;
  }

  // Simulation: Trigger Team Stuck
  public simulateTeamStuck(teamId: string = "RT12") {
    const team = this.teams.find((t) => t.id === teamId);
    if (!team) return null;

    team.operationalStatus = "STUCK";
    team.speed = 0;
    team.currentRoad = "Marina Expressway Corridor R12 (Flooded & Debris Impassable)";

    const asg = this.assignments.find((a) => a.active_team === teamId);
    if (asg) {
      asg.status = "STUCK";
      asg.plan_validity = "INVALID";
      asg.reason = "Vehicle caught in rapid flash flood current; water above chassis line.";
      asg.predicted_eta = 18;
      asg.updated_at = new Date().toISOString();
    }

    const monitoring = this.calculateTeamMonitoring(teamId);
    const failover = asg ? this.evaluateFailover(asg._id) : null;

    this.emitTargeted("admin_room", "TEAM_STUCK_ALERT", {
      teamId,
      teamName: team.name,
      vehicleId: team.vehicleId,
      monitoring,
      failoverRecommendation: failover,
      message: `CRITICAL: ${team.name} reported STUCK on ${team.currentRoad}. Plan INVALID. Predictive failover recommended!`,
    });

    this.createTargetedNotification({
      recipient_type: "ADMIN",
      recipient_id: "admin_room",
      event_type: "TEAM_STUCK_ALERT",
      emergency_id: asg?.emergency_id,
      title: `CRITICAL: ${team.name} Immobilized / Stuck`,
      message: `Squad vehicle ${team.vehicleId || "rig"} stalled on flooded corridor. AI recommends activating backup unit ${failover?.recommendedBackup?.name || "RT18"}.`,
      priority: "CRITICAL",
      metadata: { teamId, assignmentId: asg?._id, failover },
    });

    this.broadcast("teams_updated", this.teams);
    if (asg) this.broadcast("assignment_updated", asg);
    this.persist();
    return { team, monitoring, failover };
  }
}

// Global Singleton Instance
export const store = new DisasterDataStore();

