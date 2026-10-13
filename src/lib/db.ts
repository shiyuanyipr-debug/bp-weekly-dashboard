import Dexie, { type EntityTable } from "dexie";
import type { BpNote, DashboardSettings } from "./types";

export const db = new Dexie("bp-weekly-dashboard") as Dexie & { notes: EntityTable<BpNote, "id">; settings: EntityTable<DashboardSettings, "id"> };
db.version(1).stores({ notes: "id, projectKey, week, editor, updatedAt" });
db.version(2).stores({ notes: "id, projectKey, week, editor, updatedAt", settings: "id, activeReceiptMonth, updatedAt" });
