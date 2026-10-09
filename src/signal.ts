/**
 * A request that couldn't get through at all: no signal, or a network that
 * doesn't reach the internet. Building a Card needs signal; playing doesn't.
 */
export class NoSignalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoSignalError";
  }
}
