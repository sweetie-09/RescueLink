export type UserRole = 'citizen' | 'rescue' | 'rescue_team' | 'hospital' | 'shelter' | 'admin';

export type HazardType =
  | 'Flood'
  | 'Fire'
  | 'Earthquake'
  | 'Landslide'
  | 'Cyclone'
  | 'Building Collapse'
  | 'Other';

export interface LocationCoords {
  lat: number;
  lng: number;
  address: string;
}

export interface VulnerableCounts {
  elderly: number;
  pregnant: number;
  impaired: number;
  kids: number;
  injured: number;
}

export interface PriorityScoreBreakdown {
  vulnerabilityScore: number;
  peopleAffectedScore: number;
  medicalUrgencyScore: number;
  hazardSeverityScore: number;
  timeCriticalityScore: number;
  accessibilityPenalty: number;
  resourceBonus: number;
  totalScore: number;
  explanation: string;
  aiTriageSummary?: string;
  // Aliases for visualization
  vulnerabilityFactor?: number;
  medicalFactor?: number;
  hazardFactor?: number;
  peopleFactor?: number;
}

export type EmergencyStatus =
  | 'pending_review'
  | 'assigned'
  | 'accepted'
  | 'on_the_way'
  | 'arrived'
  | 'helping'
  | 'completed'
  | 'withdrawn'
  | 'cancelled';

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  actor: string;
  action: string;
  note: string;
  details?: string;
}

export interface ReassignmentRecord {
  timestamp: number;
  previousTeamId: string;
  previousTeamName: string;
  newTeamId?: string;
  newTeamName?: string;
  reason: string;
  aiRecommendation: string;
}

export interface EmergencyRequest {
  id: string;
  isSOS: boolean;
  hazardType: HazardType;
  rescueType: string;
  location: LocationCoords;
  peopleAffected: number;
  vulnerabilities: VulnerableCounts;
  description: string;
  status: EmergencyStatus;
  reportedAt: number;
  reporterContact?: string;
  reporterName?: string;
  priorityScore: number;
  scoreBreakdown: PriorityScoreBreakdown;
  assignedTeamId?: string;
  assignedTeamName?: string;
  recommendedTeamId?: string;
  recommendedTeamName?: string;
  teamMatchingExplanation?: string;
  targetDestinationId?: string;
  targetDestinationName?: string;
  targetDestinationType?: 'hospital' | 'shelter';
  etaMinutes?: number;
  requiredEquipment: string[];
  reassignmentHistory?: ReassignmentRecord[];
  auditLogs: AuditLogEntry[];
}

export interface EquipmentItem {
  name: string;
  quantity: number;
  ready: boolean;
}

export type RescueTeamStatus = 'available' | 'busy' | 'offline' | 'deployed';

export type RescueUnitType =
  | 'NDRF'
  | 'Task Force'
  | 'Paramedic'
  | 'Fire & Hazmat'
  | 'Water Rescue'
  | 'Quick Response'
  | 'Quick Reaction Team'
  | 'Army/Military Support';

export type RescueOperationalState =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'EN_ROUTE'
  | 'STUCK'
  | 'DELAYED'
  | 'ARRIVED'
  | 'HELPING'
  | 'COMPLETED'
  | 'FAILED'
  | 'OFFLINE'
  | 'UNREACHABLE';

export type PlanValidityStatus = 'VALID' | 'AT_RISK' | 'INVALID';

export interface RescueTeamTelemetry {
  team_id: string;
  vehicle_id?: string;
  latitude: number;
  longitude: number;
  speed: number; // km/h
  heading: number; // degrees
  gps_accuracy: number; // meters
  current_road?: string;
  current_assignment?: string;
  connectivity_status: 'ONLINE' | 'OFFLINE' | 'POOR';
  battery?: number;
  vehicle_status?: string;
  timestamp: number;
}

export interface TeamStatusHistoryEntry {
  team_id: string;
  old_status: string;
  new_status: string;
  reason: string;
  timestamp: number;
}

export interface TeamMonitoringMetric {
  team_id: string;
  team_name: string;
  vehicle_id?: string;
  emergency_id?: string;
  operational_status: RescueOperationalState;
  stuck_probability: number;
  failure_probability: number;
  progress_percentage: number;
  distance_remaining_km: number;
  time_since_last_movement_seconds: number;
  eta_change_minutes: number;
  route_risk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  communication_age_seconds: number;
  gps_age_seconds: number;
  speed_kmh: number;
  reasons: string[];
  plan_validity: PlanValidityStatus;
  original_eta_minutes: number;
  predicted_eta_minutes: number;
  required_response_minutes: number;
  recommended_backup?: {
    team_id: string;
    team_name: string;
    predicted_eta: number;
    distance_km: number;
    equipment_match: boolean;
    specialization_match: boolean;
    road_risk: string;
    workload: number;
    score: number;
    reason: string;
  };
}

export interface AssignmentDocument {
  _id: string;
  emergency_id: string;
  primary_team: string; // team_id
  backup_teams: string[]; // [team_id, ...]
  active_team: string; // team_id
  status:
    | 'PENDING'
    | 'ACCEPTED'
    | 'REJECTED'
    | 'EN_ROUTE'
    | 'STUCK'
    | 'AT_RISK'
    | 'FAILOVER_RESERVED'
    | 'FAILOVER_ACTIVE'
    | 'COMPLETED'
    | 'CANCELLED';
  required_response_minutes: number;
  current_eta: number;
  predicted_eta: number;
  plan_validity: PlanValidityStatus;
  reason?: string;
  created_at: string;
  updated_at: string;
  assignment_sent_at: number;
  response_deadline_at: number;
  response_status: 'WAITING' | 'ACCEPTED' | 'REJECTED' | 'NO_RESPONSE';
}

export interface FailoverEvent {
  id: string;
  emergency_id: string;
  timestamp: number;
  from_team: string;
  from_team_name: string;
  to_team: string;
  to_team_name: string;
  action: 'RESERVE' | 'ACTIVATE' | 'REASSIGN';
  reason: string;
  predicted_eta_original: number;
  predicted_eta_backup: number;
  response_threshold: number;
  actor: string;
}

export interface TargetedNotification {
  id: string;
  recipient_type: 'ADMIN' | 'RESCUE_TEAM' | 'CITIZEN' | 'HOSPITAL' | 'SHELTER';
  recipient_id: string; // "admin_room" or team_id or user_id
  event_type: string;
  emergency_id?: string;
  title: string;
  message: string;
  priority: 'CRITICAL' | 'URGENT' | 'STANDARD' | 'INFO';
  read: boolean;
  created_at: number;
  metadata?: Record<string, any>;
}

export interface UserDocument {
  _id: string;
  name: string;
  email: string;
  phone: string;
  password_hash: string;
  role: 'CITIZEN' | 'RESCUE' | 'HOSPITAL' | 'SHELTER' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  last_login?: string;
  device_id?: string;
  last_seen?: string;
  // Rescue team attributes
  team_id?: string;
  team_name?: string;
  specialization?: string[];
  vehicle_id?: string;
  resource_types?: string[];
  current_location?: LocationCoords;
  availability?: RescueOperationalState;
  connectivity_status?: 'ONLINE' | 'OFFLINE' | 'POOR';
  // Hospital / Shelter
  hospital_id?: string;
  shelter_id?: string;
}

export interface RescueTeam {
  id: string;
  name: string;
  code: string;
  unitType: RescueUnitType;
  status: RescueTeamStatus;
  operationalStatus?: RescueOperationalState;
  isOnline?: boolean;
  specialization: string[];
  resources: EquipmentItem[];
  equipment?: string[];
  capacity?: number;
  location: LocationCoords;
  currentTaskId?: string;
  workloadCount: number;
  contact: string;
  leader: string;
  vehicleType: string;
  vehicleId?: string;
  speed?: number;
  heading?: number;
  gpsAccuracy?: number;
  lastHeartbeat?: number;
  lastGpsUpdate?: number;
  currentRoad?: string;
  batteryLevel?: number;
}

export interface AuthUser {
  id: string;
  role: UserRole;
  name: string;
  email?: string;
  identifier: string;
  contact?: string;
  token?: string;
  unitType?: RescueUnitType;
  teamId?: string;
  vehicleId?: string;
  facilityId?: string;
  facilityName?: string;
  loginTime: number;
  status?: string;
}

export interface MissingPersonMatchNotification {
  id: string;
  timestamp: number;
  missingPersonId: string;
  missingPersonName: string;
  reporterName: string;
  reporterPhone: string;
  shelterId: string;
  shelterName: string;
  shelterAddress: string;
  shelterContact: string;
  physicalCondition: string;
  foundLocation: string;
  photoUrl?: string;
  read?: boolean;
}

export interface HospitalReferral {
  requestId: string;
  patientCount: number;
  urgency: 'critical' | 'moderate' | 'routine';
  etaMinutes: number;
  assignedTeamName: string;
  timestamp: number;
}

export type HospitalEmergencyStatus = 'Normal' | 'Critical Surge' | 'Diverting';
export type HospitalOperatingStatus = 'Available' | 'Full' | 'Damaged' | 'Closed';

export interface Hospital {
  id: string;
  name: string;
  location: LocationCoords;
  totalBeds: number;
  availableBeds: number;
  icuVacancies: number;
  icuAvailable?: number;
  doctorsAvailable: number;
  emergencyStatus: HospitalEmergencyStatus;
  operatingStatus: HospitalOperatingStatus;
  contact: string;
  incomingReferrals: HospitalReferral[];
}

export interface ShelterReferral {
  requestId: string;
  peopleCount: number;
  etaMinutes: number;
  assignedTeamName: string;
  timestamp: number;
}

export type ShelterOperatingStatus = 'Available' | 'Full' | 'Damaged' | 'Closed';

export interface RescuedUnknownPerson {
  id: string;
  name?: string;
  approximateAge?: number;
  gender: string;
  foundLocation: string;
  physicalFeatures: string;
  identificationMarks: string;
  healthCondition: 'Good' | 'Minor Injuries' | 'Need Hospital Care' | 'Critical' | 'Stable' | 'Injured' | 'Dehydrated';
  intakeTimestamp: number;
  matchedMissingPersonId?: string;
  photoUrl?: string;
}

export type RescuedPerson = RescuedUnknownPerson;

export interface Shelter {
  id: string;
  name: string;
  location: LocationCoords;
  totalCapacity: number;
  currentOccupancy: number;
  vacancies: number;
  operatingStatus: ShelterOperatingStatus;
  foodDaysRemaining: number;
  waterSupplyLitres: number;
  waterFoodSupplyDays?: number;
  contact: string;
  incomingReferrals: ShelterReferral[];
  rescuedPersons: RescuedUnknownPerson[];
}

export interface MissingPerson {
  id: string;
  name: string;
  fullName?: string;
  age: number;
  gender: string;
  lastSeenLocation: string;
  lastSeenCoordinates?: { lat: number; lng: number };
  physicalFeatures?: string;
  identificationMarks?: string;
  photoUrl?: string;
  reporterName: string;
  reporterPhone: string;
  reportedBy?: { name: string; phone: string };
  status: 'missing' | 'located_in_shelter' | 'reunited' | 'in_hospital';
  matchStatus?: 'pending' | 'matched';
  matchedShelterId?: string;
  matchedShelterName?: string;
  matchedShelterContact?: string;
  matchedCondition?: string;
  reportedAt: number;
}

export interface RoadBlock {
  id: string;
  roadName: string;
  location: { lat: number; lng: number };
  blockageType:
    | 'Flooded'
    | 'Debris / Rubble'
    | 'Fallen Trees'
    | 'Landslide'
    | 'Collapsed Bridge'
    | 'Active Fire'
    | 'Power Lines Down';
  description: string;
  severity: 'partial' | 'complete_closure';
  reportedBy: string;
  reportedAt: number;
  status: 'active' | 'cleared';
}

export interface OfficialUpdate {
  id: string;
  title: string;
  content: string;
  priority: 'critical' | 'advisory' | 'info';
  issuedBy: string;
  author?: string;
  source?: string;
  timestamp: number;
}

export interface ControlRoomSummary {
  totalPeopleAffected: number;
  totalVulnerablePeople: number;
  totalVulnerable?: number;
  activeIncidentsCount: number;
  activeEmergencies?: number;
  sosAlertsCount: number;
  sosAlertsActive?: number;
  availableRescueTeams: number;
  rescueTeamsDeployed?: number;
  totalRescueTeams: number;
  totalHospitalBedsAvailable: number;
  hospitalBedsFree?: number;
  totalShelterVacancies: number;
  shelterVacancies?: number;
  activeRoadblocksCount: number;
  activeRoadBlocks?: number;
  missingPersonsCount: number;
  locatedPersonsCount: number;
  activeOnlineUnitsCount?: number;
  onlineUnitsByType?: Record<string, number>;
}
