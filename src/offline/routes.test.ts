import { describe, expect, it } from "vitest";
import { routeFor } from "./routes";

const SCOPE = "https://bingo.example/app/";
const SHELL = ["./", "assets/index-abc.js", "assets/ort-wasm-def.wasm", "manifest.webmanifest", "icons/icon-192.png"];

const get = (url: string, mode: RequestMode = "no-cors") => ({ url, method: "GET", mode });
const route = (request: { url: string; method: string; mode: RequestMode }) => routeFor(request, SCOPE, SHELL);

describe("which requests the service worker answers offline", () => {
  it("answers the app's own files from the shell cache", () => {
    expect(route(get(`${SCOPE}assets/index-abc.js`))).toEqual({ kind: "shell", key: `${SCOPE}assets/index-abc.js` });
    expect(route(get(`${SCOPE}icons/icon-192.png`))).toEqual({ kind: "shell", key: `${SCOPE}icons/icon-192.png` });
  });

  it("opens the app from the shell for any page in its scope", () => {
    for (const url of [SCOPE, `${SCOPE}index.html`, `${SCOPE}?source=pwa`, `${SCOPE}#4`]) {
      expect(route(get(url, "navigate"))).toEqual({ kind: "shell", key: SCOPE });
    }
  });

  it("ignores a query string on the app's files", () => {
    expect(route(get(`${SCOPE}assets/index-abc.js?v=2`))).toEqual({ kind: "shell", key: `${SCOPE}assets/index-abc.js` });
  });

  it("leaves the model download to the setup screen, which stores the model itself", () => {
    expect(route(get(`${SCOPE}models/image_encoder_fp16.onnx`))).toEqual({ kind: "network" });
  });

  it("leaves iNaturalist, OpenStreetMap and photo downloads to the network", () => {
    for (const url of [
      "https://api.inaturalist.org/v1/taxa/1",
      "https://nominatim.openstreetmap.org/search?q=Moab",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/1/small.jpg",
    ]) {
      expect(route(get(url))).toEqual({ kind: "network" });
    }
  });

  it("leaves anything that isn't a plain read, or isn't part of the app, to the network", () => {
    expect(route({ url: `${SCOPE}assets/index-abc.js`, method: "POST", mode: "cors" })).toEqual({ kind: "network" });
    expect(route(get(`${SCOPE}assets/old-version.js`))).toEqual({ kind: "network" });
    expect(route(get("https://bingo.example/elsewhere/", "navigate"))).toEqual({ kind: "network" });
  });
});
