import { Response } from 'express';
import { agent, RecentViewType } from '../lib/agent';
import { findNearestStops } from '../lib/transit/nearbyStops';
import { gtfsCache } from '../cache/gtfsCache';
import { AGENCY_NAMES } from '../lib/transit/types';

// Handle location sharing
export async function handleLocation(
  from: string,
  lat: number,
  lon: number,
  res: Response,
): Promise<Response> {
  try {
    // Check if this is for a pending route search
    const pendingRouteQuery = agent.getPendingRouteSearch(from);

    if (pendingRouteQuery) {
      // Find the route
      const route = gtfsCache.findRoute(pendingRouteQuery);
      if (!route) {
        console.error('[Varoom]: Route not found', pendingRouteQuery);
        await agent.sendMessage(from, `Route ${pendingRouteQuery.toUpperCase()} not found.`);
        return res.status(404).json({ message: 'Route not found' });
      }

      // Get all stops within 2 miles (no max limit - filter by radius only)
      const nearbyStops = gtfsCache.findNearbyStops(lat, lon, 3218); // 2 miles radius

      // Filter stops that serve this route
      const filteredStops = nearbyStops.filter((stop) =>
        gtfsCache.stopHasRoute(stop.stopId, route.route_id),
      );

      // Check if agency is supported
      if (!AGENCY_NAMES[route.agency_id]) {
        console.error('[Varoom]: Unsupported agency', route.agency_id);
        await agent.sendMessage(from, `Agency "${route.agency_id}" is not supported.`);
        return res.status(501).json({ message: 'Unsupported agency' });
      }

      // Take top 3 closest stops
      const nearestStops = filteredStops.slice(0, 3);

      // Track this route view (use short name for display, fallback to long name)
      const displayName = route.route_short_name || route.route_long_name;
      agent.addRecentView(
        from,
        RecentViewType.ROUTE,
        route.route_short_name,
        displayName,
        route.agency_id,
      );

      await agent.showNearbyStops(from, nearestStops);
      return res.status(200).json({ message: 'Route stops sent' });
    }

    // Regular location search - find nearest 3 stops
    const nearbyStops = await findNearestStops(lat, lon, 3);

    // Show stops as quick replies
    await agent.showNearbyStops(from, nearbyStops);

    return res.status(200).json({ message: 'Closest stops sent.' });
  } catch (error) {
    console.error('[Varoom]: Failed to process location', error);
    return res.status(500).json({
      error: 'Failed to process location',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
