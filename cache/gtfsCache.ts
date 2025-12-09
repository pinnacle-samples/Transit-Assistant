import Database from 'better-sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { StopData } from '../lib/transit/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class GTFSCache {
  private db: Database.Database | null = null;

  async initialize(): Promise<GTFSCache> {
    if (this.db) {
      return this;
    }

    const dbPath = path.join(__dirname, 'gtfs.db');
    this.db = new Database(dbPath, { readonly: true });

    return this;
  }

  // Calculate distance between two coordinates using Haversine formula
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  // Find nearby stops within a radius
  findNearbyStops(
    userLat: number,
    userLon: number,
    radiusMeters: number = 2000,
    maxResults?: number,
  ): StopData[] {
    if (!this.db) {
      throw new Error('[GTFSCache] Cache not initialized. Call initialize() first.');
    }

    // Bounding box optimization (rough filter before distance calculation)
    // 1 degree latitude ≈ 111km, 1 degree longitude ≈ 111km * cos(latitude)
    const latOffset = (radiusMeters / 111000) * 1.5; // 1.5x for safety margin
    const lonOffset = (radiusMeters / (111000 * Math.cos((userLat * Math.PI) / 180))) * 1.5;

    const [minLat, maxLat] = [userLat - latOffset, userLat + latOffset];
    const [minLon, maxLon] = [userLon - lonOffset, userLon + lonOffset];

    // Query database with bounding box
    const stops = this.db
      .prepare(
        `
      SELECT stop_id as stopId, stop_name as stopName, stop_code as stopCode,
             stop_lat as lat, stop_lon as lon, agency
      FROM stops
      WHERE stop_lat BETWEEN ? AND ?
        AND stop_lon BETWEEN ? AND ?
    `,
      )
      .all(minLat, maxLat, minLon, maxLon) as StopData[];

    // Calculate distances and filter by radius
    const nearbyStops: StopData[] = [];
    for (const stop of stops) {
      const distance = this.calculateDistance(userLat, userLon, stop.lat, stop.lon);
      if (distance <= radiusMeters) {
        stop.distance = distance;
        nearbyStops.push(stop);
      }
    }

    // Sort by distance
    nearbyStops.sort((a, b) => (a.distance || 0) - (b.distance || 0));

    const results = maxResults ? nearbyStops.slice(0, maxResults) : nearbyStops;

    return results;
  }

  getStop(stopId: string): StopData | undefined {
    if (!this.db) {
      throw new Error('[GTFSCache] Cache not initialized. Call initialize() first.');
    }

    const stop = this.db
      .prepare(
        `
      SELECT stop_id as stopId, stop_name as stopName, stop_code as stopCode,
             stop_lat as lat, stop_lon as lon, agency
      FROM stops
      WHERE stop_id = ?
    `,
      )
      .get(stopId) as StopData | undefined;

    return stop;
  }

  // Search stops by stop_id or stop_code (exact match only)
  searchStops(query: string, maxResults: number = 10): StopData[] {
    if (!this.db) {
      throw new Error('[GTFSCache] Cache not initialized. Call initialize() first.');
    }

    const normalizedQuery = query.toLowerCase().trim();

    if (normalizedQuery.length < 2) {
      return [];
    }

    // Search for exact matches on stop_id or stop_code only
    // Filter out stops with agency starting with "mtc:"
    const matches = this.db
      .prepare(
        `
      SELECT stop_id as stopId, stop_name as stopName, stop_code as stopCode,
             stop_lat as lat, stop_lon as lon, agency
      FROM stops
      WHERE (LOWER(stop_id) = ? OR LOWER(stop_code) = ?)
        AND (agency NOT LIKE 'mtc:%' OR agency IS NULL)
      LIMIT ?
    `,
      )
      .all(normalizedQuery, normalizedQuery, maxResults) as StopData[];

    return matches;
  }

  // Find route by short name (e.g., "K", "38", "BART")
  findRoute(
    routeQuery: string,
  ):
    | { route_id: string; route_short_name: string; route_long_name: string; agency_id: string }
    | undefined {
    if (!this.db) {
      throw new Error('[GTFSCache] Cache not initialized. Call initialize() first.');
    }

    const normalizedQuery = routeQuery.toUpperCase().trim();

    const route = this.db
      .prepare(
        `
      SELECT route_id, route_short_name, route_long_name, agency_id
      FROM routes
      WHERE UPPER(route_short_name) = ?
      LIMIT 1
    `,
      )
      .get(normalizedQuery) as
      | { route_id: string; route_short_name: string; route_long_name: string; agency_id: string }
      | undefined;

    return route;
  }

  // Check if a stop serves a specific route
  stopHasRoute(stopId: string, routeId: string): boolean {
    if (!this.db) {
      throw new Error('[GTFSCache] Cache not initialized. Call initialize() first.');
    }

    const result = this.db
      .prepare(
        `
      SELECT 1 FROM stop_routes
      WHERE stop_id = ? AND route_id = ?
      LIMIT 1
    `,
      )
      .get(stopId, routeId);

    return result !== undefined;
  }
}

// Singleton instance
export const gtfsCache = new GTFSCache();
