import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, relative, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.PORT ?? 4183);

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
]);

function resolvePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const normalized = normalize(decoded === "/" ? "/browser-smoke/timing.html" : decoded);
  const relativePath = normalized.replace(/^[/\\]+/, "");
  const absolutePath = resolve(join(root, relativePath));
  const rootRelative = relative(root, absolutePath);

  if (rootRelative.startsWith(`..${sep}`) || rootRelative === ".." || rootRelative === "") {
    return null;
  }

  return absolutePath;
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const filePath = resolvePath(url.pathname);

  if (filePath === null) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const stats = statSync(filePath);
    if (!stats.isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Length": stats.size,
      "Content-Type": contentTypes.get(extname(filePath)) ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Browser smoke server listening on http://127.0.0.1:${port}`);
});
