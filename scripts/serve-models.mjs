// Serves the ONNX export from another origin with CORS headers, the way Hugging
// Face does, to rehearse the published setup locally:
//   node scripts/serve-models.mjs                       (http://localhost:4180/)
//   VITE_MODEL_URL=http://localhost:4180/ npm run build && npm run preview
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { basename, join } from "node:path";

const DIR = "spike/web/public/models";
const PORT = Number(process.env.PORT ?? 4180);

createServer((request, response) => {
  const file = join(DIR, basename(decodeURIComponent(new URL(request.url, "http://x").pathname)));
  const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "Content-Length" };
  try {
    const { size } = statSync(file);
    response.writeHead(200, { ...headers, "Content-Length": size, "Content-Type": "application/octet-stream" });
    if (request.method === "HEAD") return response.end();
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, headers).end();
  }
}).listen(PORT, () => console.log(`Model files on http://localhost:${PORT}/`));
