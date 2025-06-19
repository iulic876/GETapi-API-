import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import workspaceRoutes from "./routes/workspace.js";
import variablesRoutes from "./routes/variables.js";
import collectionsRoutes from "./routes/collections.js";
import requestsRoutes from "./routes/requests.js";
import initDatabase from "./initDb.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/test", async function(req: Request, res: Response) {
   console.log("helllo");
   res.status(200).send("Hello");
});

app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/variables", variablesRoutes);
app.use("/api/collections", collectionsRoutes);
app.use("/api/requests", requestsRoutes);

// Initialize database before starting server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});
