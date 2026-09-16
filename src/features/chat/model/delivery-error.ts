export class DeliveryError extends Error {
  constructor(
    public readonly outcome: 'offline' | 'unknown' | 'access',
    message: string,
  ) {
    super(message);
    this.name = 'DeliveryError';
  }
}
