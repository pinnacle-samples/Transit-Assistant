import { gtfsCache } from '../../cache/gtfsCache';
import { StopData, AGENCY_NAMES } from './types';

const API_KEY = process.env.API_511_KEY;

/**
 * Find nearest stops by distance with route information
 * Returns up to maxResults closest stops, deduplicated by location
 */
export async function findNearestStops(
  userLat: number,
  userLon: number,
  maxResults: number = 5,
): Promise<StopData[]> {
  // Get more candidates to ensure we have enough after deduplication
  const nearbyStops = gtfsCache.findNearbyStops(
    userLat,
    userLon,
    1609, // 1 mile radius
    50,
  );

  // Deduplicate by routes - only show stops with at least one new route
  const uniqueStops: StopData[] = [];
  const seenRoutes = new Set<string>();

  for (const stop of nearbyStops) {
    if (!stop.agency) continue;

    // Skip unsupported agencies
    if (!AGENCY_NAMES[stop.agency]) {
      continue;
    }

    // Fetch routes for this stop from StopMonitoring API
    try {
      const stopCode = stop.stopCode || stop.stopId;
      const monitoringUrl = `http://api.511.org/transit/StopMonitoring?api_key=${API_KEY}&agency=${stop.agency}&stopcode=${stopCode}&format=json`;
      const response = await fetch(monitoringUrl);

      if (response.ok) {
        const data: {
          ServiceDelivery: {
            StopMonitoringDelivery: {
              MonitoredStopVisit: {
                MonitoredVehicleJourney: {
                  PublishedLineName: string;
                };
              };
            };
          };
        } = (await response.json()) as {
          ServiceDelivery: {
            StopMonitoringDelivery: {
              MonitoredStopVisit: {
                MonitoredVehicleJourney: {
                  PublishedLineName: string;
                };
              };
            };
          };
        };
        const monitoredStopVisits =
          data?.ServiceDelivery?.StopMonitoringDelivery?.MonitoredStopVisit;

        const routeSet = new Set<string>();
        if (monitoredStopVisits && Array.isArray(monitoredStopVisits)) {
          for (const visit of monitoredStopVisits) {
            const routeName = visit?.MonitoredVehicleJourney?.PublishedLineName;
            if (routeName) {
              routeSet.add(routeName);
            }
          }
        }

        stop.routeNames = Array.from(routeSet).sort();

        // Check if this stop has at least one new route we haven't seen
        const newRoutes = stop.routeNames.filter((route) => !seenRoutes.has(route));

        if (newRoutes.length > 0) {
          // Add all routes from this stop to seen routes
          stop.routeNames.forEach((route) => seenRoutes.add(route));

          uniqueStops.push(stop);

          if (uniqueStops.length >= maxResults) {
            break;
          }
        }
      }
    } catch (error) {
      console.error(`[NearbyStops] Failed to fetch routes for ${stop.stopId}:`, error);
    }
  }

  return uniqueStops;
}
