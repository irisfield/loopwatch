import { join, relative } from "node:path";

const dir = join(import.meta.dirname, "../test/pages");

Bun.serve({
  port: 4184,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);
    const filePath = join(dir, url.pathname);
    if (relative(dir, filePath).startsWith("..")) {
      return new Response("Forbidden", { status: 403 });
    }
    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file);
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log("Serving test pages at http://127.0.0.1:4184");
