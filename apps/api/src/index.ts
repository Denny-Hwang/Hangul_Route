import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) =>
  c.json({
    service: "hangul-route-api",
    status: "ok",
    message: "Hello, Hoya!",
  })
);

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
