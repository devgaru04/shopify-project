import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { loadAdminToken } from "./services/shopifyService.js";
import { bootstrapAdminToken } from "./controllers/authController.js";
import routes from "./routes/index.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", routes);

const PORT = env.port;

app.listen(PORT, async () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  loadAdminToken();
  await bootstrapAdminToken();
});
