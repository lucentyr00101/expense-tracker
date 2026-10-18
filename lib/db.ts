import "server-only";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set");

// One client per process: survives hot reloads in development, and in production the page and route
// handler bundles each evaluate this module, so without it they would each open their own pool.
const globalForMongo = globalThis as unknown as { _mongoClient?: MongoClient };

export const client = (globalForMongo._mongoClient ??= new MongoClient(uri));

/**
 * The driver connects lazily, but if that first connect fails it keeps the closed topology and every
 * later operation throws "Topology is closed". An explicit connect() builds a fresh topology instead,
 * and returns at once when already connected.
 */
export async function connectDb(): Promise<void> {
  await client.connect();
}

export const db = client.db(process.env.MONGODB_DB ?? "expense-tracker");
