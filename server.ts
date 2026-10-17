import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { store } from "./server/store.js";

const PORT = 3000;

async function startServer() {
  const app = express();

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  // Health endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "RescueLink Core",
      timestamp: Date.now(),
    });
  });

  // Real-time Server-Sent Events (SSE) Stream
  app.get("/api/stream", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    // Initial ping
    res.write(`event: connected\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);

    store.addSseClient(res);
  });

  // Control Room Summary KPIs
  app.get("/api/summary", (_req: Request, res: Response) => {
    res.json(store.getSummary());
  });

  // Emergency Requests endpoints
  app.get("/api/requests", (_req: Request, res: Response) => {
    res.json(store.requests);
  });

  // Citizen SOS Trigger
  app.post("/api/requests/sos", async (req: Request, res: Response) => {
    try {
      const sos = await store.createSosAlert(req.body);
      res.status(201).json(sos);
    } catch (err: any) {
      console.error("SOS generation error:", err);
      res.status(500).json({ error: err.message || "Failed to trigger SOS" });
    }
  });

  // Citizen Emergency Request Form
  app.post("/api/requests", async (req: Request, res: Response) => {
    try {
      const {
        hazardType,
        rescueType,
        location,
        peopleAffected,
        vulnerabilities,
        description,
        reporterName,
        reporterContact,
      } = req.body;

      if (!hazardType || !rescueType || !location) {
        res.status(400).json({ error: "Missing required fields: hazardType, rescueType, or location" });
        return;
      }

      const request = await store.createEmergencyRequest({
        hazardType,
        rescueType,
        location,
        peopleAffected: Number(peopleAffected) || 1,
        vulnerabilities: vulnerabilities || {
          elderly: 0,
          pregnant: 0,
          impaired: 0,
          kids: 0,
          injured: 0,
        },
        description: description || "",
        reporterName,
        reporterContact,
      });

      res.status(201).json(request);
    } catch (err: any) {
      console.error("Emergency request creation error:", err);
      res.status(500).json({ error: err.message || "Failed to process emergency request" });
    }
  });

  // Control Room: Approve AI Recommendation
  app.post("/api/requests/:id/approve", (req: Request, res: Response) => {
    const updated = store.approveAssignment(req.params.id, req.body.actor || "Control Room Authority");
    if (!updated) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    res.json(updated);
  });

  // Control Room: Reassign Task
  app.post("/api/requests/:id/reassign", (req: Request, res: Response) => {
    const { newTeamId, reason, actor } = req.body;
    if (!newTeamId || !reason) {
      res.status(400).json({ error: "newTeamId and reason are required for task reassignment" });
      return;
    }
    const updated = store.reassignTask(req.params.id, newTeamId, reason, actor);
    if (!updated) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    res.json(updated);
  });

  // Rescue Team: Status Progression
  app.post("/api/requests/:id/status", (req: Request, res: Response) => {
    const { teamId, status, note } = req.body;
    if (!teamId || !status) {
      res.status(400).json({ error: "teamId and status are required" });
      return;
    }
    const updated = store.updateRescueTeamStatus(req.params.id, teamId, status, note);
    if (!updated) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    res.json(updated);
  });

  // Citizen: Cancel Request
  app.post("/api/requests/:id/cancel", (req: Request, res: Response) => {
    const updated = store.cancelEmergencyRequest(req.params.id, req.body.reason);
    if (!updated) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    res.json(updated);
  });

  // Rescue Teams
  app.get("/api/teams", (_req: Request, res: Response) => {
    res.json(store.teams);
  });

  // Dynamic Rescue Team Registration
  app.post("/api/teams/register", (req: Request, res: Response) => {
    try {
      const { name, unitType, leader, contact, vehicleType, location, specialization, resources } = req.body;
      if (!name || !leader) {
        res.status(400).json({ error: "name and leader are required to register rescue unit" });
        return;
      }
      const newTeam = store.registerRescueTeam({
        name,
        unitType: unitType || "NDRF",
        leader,
        contact: contact || "+1 (555) 019-9000",
        vehicleType: vehicleType || "Tactical Disaster Vehicle",
        location,
        specialization,
        resources,
      });
      res.status(201).json(newTeam);
    } catch (err: any) {
      console.error("Team registration error:", err);
      res.status(500).json({ error: err.message || "Failed to register rescue team" });
    }
  });

  app.post("/api/teams/:id/status", (req: Request, res: Response) => {
    const { status } = req.body;
    if (!status) {
      res.status(400).json({ error: "status is required" });
      return;
    }
    const updated = store.toggleTeamStatus(req.params.id, status);
    if (!updated) {
      res.status(404).json({ error: "Team not found" });
      return;
    }
    res.json(updated);
  });

  // Hospitals
  app.get("/api/hospitals", (_req: Request, res: Response) => {
    res.json(store.hospitals);
  });

  app.put("/api/hospitals/:id", (req: Request, res: Response) => {
    const updated = store.updateHospitalStatus(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: "Hospital not found" });
      return;
    }
    res.json(updated);
  });

  // Shelters
  app.get("/api/shelters", (_req: Request, res: Response) => {
    res.json(store.shelters);
  });

  app.put("/api/shelters/:id", (req: Request, res: Response) => {
    const updated = store.updateShelterStatus(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: "Shelter not found" });
      return;
    }
    res.json(updated);
  });

  // Shelter: Intake Rescued Person
  app.post("/api/shelters/:id/rescued", (req: Request, res: Response) => {
    const person = store.registerRescuedPerson(req.params.id, req.body);
    if (!person) {
      res.status(404).json({ error: "Shelter not found" });
      return;
    }
    res.status(201).json(person);
  });

  // Missing Persons
  app.get("/api/missing-persons", (_req: Request, res: Response) => {
    res.json(store.missingPersons);
  });

  app.post("/api/missing-persons", (req: Request, res: Response) => {
    const person = store.reportMissingPerson(req.body);
    res.status(201).json(person);
  });

  // Missing Person Match Notifications
  app.get("/api/notifications", (req: Request, res: Response) => {
    const phone = req.query.reporterPhone as string | undefined;
    res.json(store.getNotifications(phone));
  });

  app.post("/api/notifications/:id/read", (req: Request, res: Response) => {
    store.markNotificationRead(req.params.id);
    res.json({ success: true });
  });

  // Road Blocks
  app.get("/api/roadblocks", (_req: Request, res: Response) => {
    res.json(store.roadBlocks);
  });

  app.post("/api/roadblocks", async (req: Request, res: Response) => {
    const block = await store.reportRoadBlock(req.body);
    res.status(201).json(block);
  });

  app.post("/api/roadblocks/:id/clear", async (req: Request, res: Response) => {
    const cleared = await store.clearRoadBlock(req.params.id, req.body.actor);
    if (!cleared) {
      res.status(404).json({ error: "Road block not found" });
      return;
    }
    res.json(cleared);
  });

  // Official Updates Feed
  app.get("/api/updates", (_req: Request, res: Response) => {
    res.json(store.officialUpdates);
  });

  app.post("/api/updates", (req: Request, res: Response) => {
    const update = store.postOfficialUpdate(req.body);
    res.status(201).json(update);
  });

  // Manual / Simulation Trigger for Dynamic Reassessment Loop
  app.post("/api/reassessment/trigger", async (req: Request, res: Response) => {
    const reason = req.body.reason || "Manual Control Room Re-evaluation Demand";
    await store.triggerDynamicReassessmentLoop(reason);
    res.json({ success: true, message: `Reassessment completed: ${reason}` });
  });

  // Vite middleware or Static production serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`RescueLink Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal server start error:", err);
});
