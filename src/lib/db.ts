import Dexie, { type EntityTable } from "dexie";
import type { BpNote } from "./types";

export const db = new Dexie("bp-weekly-dashboard") as Dexie & { notes: EntityTable<BpNote, "id"> };
db.version(1).stores({ notes: "id, projectKey, week, editor, updatedAt" });

