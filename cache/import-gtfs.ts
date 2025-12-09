import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = __dirname;
const DB_PATH = path.join(CACHE_DIR, 'gtfs.db');

// Parse CSV line (handles quoted fields)
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);

  return fields;
}

// Import CSV file into database
function importCSV(
  db: Database.Database,
  tableName: string,
  filePath: string,
  columnMapping: Record<string, string>,
) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n');

  // Parse header
  const header = parseCSVLine(lines[0]);
  const columnIndexes: Record<string, number> = {};

  // Map CSV columns to DB columns
  for (const [dbCol, csvCol] of Object.entries(columnMapping)) {
    const index = header.indexOf(csvCol);
    if (index !== -1) {
      columnIndexes[dbCol] = index;
    }
  }

  // Prepare insert statement
  const columns = Object.keys(columnIndexes);
  const placeholders = columns.map(() => '?').join(', ');
  const insertStmt = db.prepare(
    `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
  );

  // Begin transaction for performance
  const insert = db.transaction((rows: string[]) => {
    for (const line of rows) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const fields = parseCSVLine(trimmed);
      const values = columns.map((col) => {
        const index = columnIndexes[col];
        return fields[index]?.trim() || null;
      });

      // Skip if required fields are missing
      if (tableName === 'stops' && (!values[0] || !values[1])) {
        continue;
      }

      try {
        insertStmt.run(...values);
      } catch (error) {
        console.error('[Import GTFS] Failed to insert row:', error);
        continue;
      }
    }
  });

  // Import data (skip header)
  const dataLines = lines.slice(1);
  insert(dataLines);
}

// Load stop-to-agency mapping and update stops table
function updateStopAgencies(db: Database.Database) {
  const mappingPath = path.join(CACHE_DIR, 'stop_agency_map.json');
  if (!fs.existsSync(mappingPath)) {
    return;
  }

  const mappingData = fs.readFileSync(mappingPath, 'utf-8');
  const mapping: Record<string, string> = JSON.parse(mappingData);

  // Agency code mapping (GTFS -> 511)
  const agencyMap: Record<string, string> = {
    BA: 'BA', // BART
    SF: 'SF', // Muni
    AC: 'AC', // AC Transit
    CM: 'CM', // Caltrain
    GG: 'GG', // Golden Gate
    SC: 'SC', // SamTrans
    VT: 'VT', // VTA
  };

  const updateStmt = db.prepare('UPDATE stops SET agency = ? WHERE stop_id = ?');

  const update = db.transaction(() => {
    let count = 0;
    for (const [stopId, gtfsAgency] of Object.entries(mapping)) {
      const api511Agency = agencyMap[gtfsAgency] || gtfsAgency;
      updateStmt.run(api511Agency, stopId);
      count++;
    }
    return count;
  });

  update();
}

// Build stop-route mapping from trips and stop_times
function buildStopRouteMapping(db: Database.Database) {
  const tripsPath = path.join(CACHE_DIR, 'trips.txt');
  const stopTimesPath = path.join(CACHE_DIR, 'stop_times.txt');

  if (!fs.existsSync(tripsPath) || !fs.existsSync(stopTimesPath)) {
    return;
  }

  // First, load all trips with their route_ids
  const tripToRoute = new Map<string, string>();

  const tripsContent = fs.readFileSync(tripsPath, 'utf-8');
  const tripsLines = tripsContent.split('\n');
  const tripsHeader = parseCSVLine(tripsLines[0]);
  const tripIdIdx = tripsHeader.indexOf('trip_id');
  const routeIdIdx = tripsHeader.indexOf('route_id');

  if (tripIdIdx === -1 || routeIdIdx === -1) {
    return;
  }

  for (let i = 1; i < tripsLines.length; i++) {
    const line = tripsLines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    const tripId = fields[tripIdIdx]?.trim();
    const routeId = fields[routeIdIdx]?.trim();

    if (tripId && routeId) {
      tripToRoute.set(tripId, routeId);
    }
  }

  // Now process stop_times to build stop-route relationships
  const stopRoutes = new Map<string, Set<string>>();

  const stopTimesContent = fs.readFileSync(stopTimesPath, 'utf-8');
  const stopTimesLines = stopTimesContent.split('\n');
  const stopTimesHeader = parseCSVLine(stopTimesLines[0]);
  const stTripIdIdx = stopTimesHeader.indexOf('trip_id');
  const stStopIdIdx = stopTimesHeader.indexOf('stop_id');

  if (stTripIdIdx === -1 || stStopIdIdx === -1) {
    return;
  }

  for (let i = 1; i < stopTimesLines.length; i++) {
    const line = stopTimesLines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    const tripId = fields[stTripIdIdx]?.trim();
    const stopId = fields[stStopIdIdx]?.trim();

    if (!tripId || !stopId) continue;

    const routeId = tripToRoute.get(tripId);
    if (!routeId) continue;

    if (!stopRoutes.has(stopId)) {
      stopRoutes.set(stopId, new Set());
    }
    stopRoutes.get(stopId)!.add(routeId);
  }

  // Insert into database
  const insertStmt = db.prepare(
    'INSERT OR IGNORE INTO stop_routes (stop_id, route_id) VALUES (?, ?)',
  );

  const insert = db.transaction(() => {
    let count = 0;
    for (const [stopId, routes] of stopRoutes) {
      for (const routeId of routes) {
        insertStmt.run(stopId, routeId);
        count++;
      }
    }
    return count;
  });

  insert();
}

// Infer agency from stop_id or stop_url for stops without agency
function inferMissingAgencies(db: Database.Database) {
  const stops = db
    .prepare('SELECT stop_id, stop_url FROM stops WHERE agency IS NULL')
    .all() as Array<{
    stop_id: string;
    stop_url: string | null;
  }>;

  if (stops.length === 0) {
    return;
  }

  const updateStmt = db.prepare('UPDATE stops SET agency = ? WHERE stop_id = ?');

  const update = db.transaction(() => {
    let count = 0;
    for (const stop of stops) {
      let agency: string | null = null;

      // Try inferring from stop_id prefix
      if (stop.stop_id.includes(':')) {
        const prefix = stop.stop_id.split(':')[0].toUpperCase();
        const agencyMap: Record<string, string> = {
          BA: 'BA',
          SF: 'SF',
          AC: 'AC',
          CM: 'CM',
          GG: 'GG',
          SC: 'SC',
          VT: 'VT',
        };
        agency = agencyMap[prefix] || null;
      }

      // Try inferring from stop_url
      if (!agency && stop.stop_url) {
        if (stop.stop_url.includes('sfmta.com')) agency = 'SF';
        else if (stop.stop_url.includes('bart.gov')) agency = 'BA';
        else if (stop.stop_url.includes('actransit.org')) agency = 'AC';
        else if (stop.stop_url.includes('caltrain.com')) agency = 'CM';
        else if (stop.stop_url.includes('goldengate.org')) agency = 'GG';
        else if (stop.stop_url.includes('samtrans.com')) agency = 'SC';
        else if (stop.stop_url.includes('vta.org')) agency = 'VT';
      }

      if (agency) {
        updateStmt.run(agency, stop.stop_id);
        count++;
      }
    }
    return count;
  });

  update();
}

// Main import function
async function main() {
  // Initialize database
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL'); // Better performance

  // Load schema
  const schemaPath = path.join(CACHE_DIR, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  // Import stops
  importCSV(db, 'stops', path.join(CACHE_DIR, 'stops.txt'), {
    stop_id: 'stop_id',
    stop_name: 'stop_name',
    stop_code: 'stop_code',
    stop_lat: 'stop_lat',
    stop_lon: 'stop_lon',
    stop_url: 'stop_url',
  });

  // Update stop agencies from mapping file
  updateStopAgencies(db);

  // Infer any missing agencies
  inferMissingAgencies(db);

  // Import routes
  importCSV(db, 'routes', path.join(CACHE_DIR, 'routes.txt'), {
    route_id: 'route_id',
    route_short_name: 'route_short_name',
    route_long_name: 'route_long_name',
    route_type: 'route_type',
    route_color: 'route_color',
    route_text_color: 'route_text_color',
    route_url: 'route_url',
    agency_id: 'agency_id',
  });

  // Build stop-route relationships from trips and stop_times
  buildStopRouteMapping(db);

  db.close();
}

main().catch(console.error);
