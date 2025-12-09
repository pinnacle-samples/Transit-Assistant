import { rcsClient } from './rcsClient';
import { PinnacleClient } from 'rcs-js';

if (!process.env.PINNACLE_AGENT_ID) {
  throw new Error('PINNACLE_AGENT_ID environment variable is required');
}

export class BaseAgent {
  protected readonly client: PinnacleClient;
  protected readonly agentName: string;
  protected readonly TEST_MODE: boolean;

  constructor() {
    this.client = rcsClient;
    this.agentName = process.env.PINNACLE_AGENT_ID!;
    this.TEST_MODE = process.env.TEST_MODE === 'true';
  }

  // Send strict format message (for errors)
  async sendStrictFormatMessage(to: string, text: string) {
    return await this.client.messages.rcs.send({
      from: this.agentName,
      to: to,
      text,
      quickReplies: [],
      options: { test_mode: this.TEST_MODE },
    });
  }
}
