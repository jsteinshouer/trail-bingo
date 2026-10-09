import type { Encoder } from "../game";
import type { EncoderInfo, Request, Response } from "./protocol";

export type { EncoderInfo } from "./protocol";

/** BioCLIP, running in a Web Worker. Vectors are L2-normalized. */
export interface BioclipEncoder extends Encoder {
  /** Settles when the model has loaded, or failed to. */
  ready: Promise<EncoderInfo>;
  /** Status while loading, for the player. */
  onProgress?: (message: string) => void;
  encodeImage(image: Blob): Promise<Float32Array>;
}

/** Starts loading BioCLIP in a worker straight away; requests wait until it's ready. */
export function createBioclipEncoder(): BioclipEncoder {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  const pending = new Map<number, { resolve(vectors: Float32Array[]): void; reject(error: Error): void }>();
  let nextId = 0;

  let settle!: { resolve(info: EncoderInfo): void; reject(error: Error): void };
  const ready = new Promise<EncoderInfo>((resolve, reject) => (settle = { resolve, reject }));

  const fail = (error: Error) => {
    settle.reject(error);
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };

  const encoder: BioclipEncoder = {
    ready,
    encodeText: (labels) => send({ type: "encode-text", id: nextId++, labels }),
    encodeImage: async (image) => (await send({ type: "encode-image", id: nextId++, image }))[0],
  };

  function send(request: Request): Promise<Float32Array[]> {
    return new Promise((resolve, reject) => {
      pending.set(request.id, { resolve, reject });
      worker.postMessage(request);
    });
  }

  worker.onmessage = ({ data: message }: MessageEvent<Response>) => {
    switch (message.type) {
      case "progress":
        encoder.onProgress?.(message.message);
        break;
      case "loaded":
        settle.resolve(message.info);
        break;
      case "load-failed":
        settle.reject(new Error(message.message));
        break;
      case "vectors":
        pending.get(message.id)?.resolve(message.vectors);
        pending.delete(message.id);
        break;
      case "error":
        pending.get(message.id)?.reject(new Error(message.message));
        pending.delete(message.id);
        break;
    }
  };
  // The tab may have run out of memory; every waiting request fails rather than hanging.
  worker.onerror = (event) => fail(new Error(`The photo check stopped: ${event.message || "unknown error"}`));

  return encoder;
}
