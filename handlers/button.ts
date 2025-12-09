import { Response } from 'express';
import { agent, RecentViewType } from '../lib/agent';
import { getStopArrivals } from '../lib/transit/arrivals';
import { ArrivalInfo } from '../lib/transit/types';

interface ButtonPayload {
  action: string;
  agency?: string;
  stopId?: string;
  routeNumber?: string;
}

// Handle button clicks
export async function handleButtonClick(
  from: string,
  payloadString: string,
  res: Response,
): Promise<Response> {
  try {
    const payload: ButtonPayload = JSON.parse(payloadString);

    // Clear pending route search when user presses any button (except view_recent_route which sets new search)
    if (payload.action !== 'view_recent_route' && agent.hasPendingRouteSearch(from)) {
      agent.clearPendingRouteSearch(from);
    }

    switch (payload.action) {
      case 'search_near_me':
        await agent.requestLocation(from);
        break;

      case 'recently_viewed':
        await agent.showRecentViews(from);
        break;

      case 'help':
        await agent.sendHelp(from);
        break;

      case 'view_recent_route':
        if (payload.routeNumber) {
          // Set pending route search and request location
          agent.setPendingRouteSearch(from, payload.routeNumber);
          await agent.requestLocation(from, `Route ${payload.routeNumber}`);
        }
        break;

      case 'show_stop_arrivals':
        if (payload.agency && payload.stopId) {
          const arrivals = await getStopArrivals(payload.stopId, payload.agency);
          const arrivalInfo: ArrivalInfo[] = arrivals;

          // Track this view (use stopId as display name)
          agent.addRecentView(
            from,
            RecentViewType.STOP,
            payload.stopId,
            payload.stopId,
            payload.agency,
          );

          await agent.showStopArrivals(from, payload.stopId, arrivalInfo, payload.agency);
        }
        break;
    }

    return res.status(200).json({ message: 'Button action handled' });
  } catch (error) {
    console.error('[Varoom]: Failed to process button click', error);
    return res.status(500).json({
      error: 'Failed to process button click',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
