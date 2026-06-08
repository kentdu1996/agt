import Dexie, { type EntityTable } from "dexie";

// Example data model — rename/extend for your project ({{idea}}).
interface Item {
  id: number;
  title: string;
  createdAt: number;
}

const db = new Dexie("{{slug}}") as Dexie & {
  items: EntityTable<Item, "id">;
};

db.version(1).stores({
  items: "++id, title, createdAt",
});

export type { Item };
export { db };
