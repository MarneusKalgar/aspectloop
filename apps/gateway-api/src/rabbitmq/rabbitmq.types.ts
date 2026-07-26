export interface PublishToQueueInput {
  message: string | Uint8Array;
  options?: {
    contentType?: string;
    messageId?: string;
    persistent?: boolean;
    type?: string;
  };
  queueName: string;
}
