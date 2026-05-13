export interface PublishToQueueInput {
  message: string | Uint8Array;
  options?: {
    persistent?: boolean;
  };
  queueName: string;
}
