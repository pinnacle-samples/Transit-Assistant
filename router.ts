import { Router, Request, Response } from 'express';
import { handleButtonClick, handleTextMessage, handleLocation } from './handlers';
import { rcsClient } from './lib/rcsClient';

const varoomRouter = Router();

varoomRouter.post('/', async (req: Request, res: Response) => {
  try {
    const messageEvent = await rcsClient.messages.process(req);
    if (!('message' in messageEvent)) {
      return res.status(200).json({ message: 'No message found' });
    }
    const message = messageEvent.message;
    const from = messageEvent.conversation.from;

    // Handle button clicks
    if (message.type === 'RCS_BUTTON_DATA' && typeof message.button.raw === 'object') {
      // Handle location request button
      if (message.button.raw.type === 'requestUserLocation') {
        return res.status(200).json({ message: 'Share Location button clicked' });
      }

      // Handle trigger buttons
      if (message.button.raw.type === 'trigger') {
        return handleButtonClick(from, message.button.raw.payload ?? '', res);
      }
    }

    // Handle location sharing
    if (message.type === 'RCS_LOCATION_DATA') {
      const { latitude, longitude } = message.data;
      return handleLocation(from, latitude, longitude, res);
    }

    // Handle text messages
    if (message.type === 'RCS_TEXT') {
      return handleTextMessage(from, message.text, res);
    }

    return res.status(200).json({ message: 'No message found' });
  } catch (error) {
    console.error('[Varoom]: Internal server error', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default varoomRouter;
