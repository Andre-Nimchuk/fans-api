export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();

  return function schedule<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task);

    // A failed operation still rejects for its caller without blocking later work.
    tail = result.catch(() => undefined);

    return result;
  };
}
