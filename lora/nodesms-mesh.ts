export interface NodeSmsMeshPacket {
  id: string;
  to: string;
  from: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  createdAt: string;
  payloadBase64: string;
  ttlSeconds: number;
}

const offlineQueue: NodeSmsMeshPacket[] = [];

export function queueNodeSmsForLoRa(packet: NodeSmsMeshPacket): { queued: boolean; queueDepth: number } {
  offlineQueue.push(packet);
  return {
    queued: true,
    queueDepth: offlineQueue.length,
  };
}

export function flushNodeSmsQueue(maxItems = 25): NodeSmsMeshPacket[] {
  return offlineQueue.splice(0, Math.max(1, Math.min(maxItems, offlineQueue.length)));
}

export function getNodeSmsQueueStatus() {
  return {
    queuedMessages: offlineQueue.length,
    oldestMessageAt: offlineQueue[0]?.createdAt ?? null,
  };
}
