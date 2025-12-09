import { Response } from 'express';
import { agent } from '../lib/agent';
import { getStopArrivals } from '../lib/transit/arrivals';
import { gtfsCache } from '../cache/gtfsCache';

// Helper function to send format error message
async function sendFormatError(from: string, message: string) {
  await agent.sendStrictFormatMessage(
    from,
    `Sorry, I didn't understand "${message}".\n\nPlease use one of the following formats:\n\n• "stop [id]" - View arrival times\n• "route [name]" - Find nearest stops for that route`,
  );
}

// Handle text messages - requires "route" or "stop" prefix
export async function handleTextMessage(
  from: string,
  text: string,
  res: Response,
): Promise<Response> {
  try {
    const trimmedText = text.trim();

    // Handle welcome commands (exact match, all caps)
    if (trimmedText === 'MENU' || trimmedText === 'START' || trimmedText === 'SUBSCRIBE') {
      agent.clearPendingRouteSearch(from); // Clear any pending route search state
      await agent.showMainMenu(from);
      return res.status(200).json({ message: 'Main menu sent' });
    }

    const lowerText = trimmedText.toLowerCase();

    // Check if starts with "route "
    if (lowerText.startsWith('route ')) {
      const routeQuery = text.trim().substring(6).trim(); // Extract after "route "

      if (!routeQuery) {
        await sendFormatError(from, trimmedText);
        return res.status(200).json({ message: 'Empty route query' });
      }

      // Store the route query and request user location
      agent.setPendingRouteSearch(from, routeQuery);
      await agent.requestLocation(from, `Route ${routeQuery.toUpperCase()}`);
      return res.status(200).json({ message: 'Location requested for route search' });
    }

    // Check if starts with "stop "
    if (lowerText.startsWith('stop ')) {
      const stopQuery = text.trim().substring(5).trim(); // Extract after "stop "

      if (!stopQuery) {
        await sendFormatError(from, trimmedText);
        return res.status(200).json({ message: 'Empty stop query' });
      }

      const stopMatches = gtfsCache.searchStops(stopQuery, 1);

      if (stopMatches.length > 0) {
        const matchedStop = stopMatches[0];

        // Skip if no agency info
        if (!matchedStop.agency) {
          await agent.sendMessage(
            from,
            `Stop "${stopQuery}" was found but is missing agency information. Please try a different stop.`,
          );
          return res.status(200).json({ message: 'Stop found but no agency info' });
        }

        const arrivals = await getStopArrivals(matchedStop.stopId, matchedStop.agency);

        await agent.showStopArrivals(from, matchedStop.stopId, arrivals, matchedStop.agency);
        return res.status(200).json({ message: 'Stop arrivals sent' });
      }

      await agent.sendMessage(from, `No stop found matching "${stopQuery}". Please try again.`);
      return res.status(200).json({ message: 'Stop not found' });
    }

    // Invalid format - send unhandled message response
    await sendFormatError(from, trimmedText);
    return res.status(200).json({ message: 'Invalid format' });
  } catch (error) {
    console.error('[Varoom]: Failed to process text message', error);
    return res.status(500).json({
      error: 'Failed to process text message',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
