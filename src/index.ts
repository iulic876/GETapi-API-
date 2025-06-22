import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from 'swagger-ui-express';
import specs from './swagger.js';
import authRoutes from "./routes/auth.js";
import workspaceRoutes from "./routes/workspace.js";
import variablesRoutes from "./routes/variables.js";
import collectionsRoutes from "./routes/collections.js";
import requestsRoutes from "./routes/requests.js";
import initDatabase from "./initDb.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://ap-iget-front.vercel.app'
];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

/**
 * @swagger
 * /api/test:
 *   get:
 *     summary: Test endpoint
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Hello message
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Hello"
 */
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
