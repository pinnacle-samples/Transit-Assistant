import { Request } from 'express';
import { Pinnacle } from 'rcs-js';

export interface TriggerPayload {
  action: string;
  [key: string]: any;
}

export interface RequestWithMessageEvent extends Request {
  messageEvent: Pinnacle.MessageEvent;
}
