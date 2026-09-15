export class DeliveryError extends Error {
  constructor(
    public readonly outcome: 'offline' | 'unknown',
    message: string,
  ) {
    super(message);
    this.name = 'DeliveryError';
  }
}
