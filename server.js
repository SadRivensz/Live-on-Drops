import express from "express";
import multer from "multer";
import FormData from "form-data";
import fetch from "node-fetch";

const app = express();
const upload = multer();

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const API_KEY = process.env.API_KEY;

if (!WEBHOOK_URL) {
  throw new Error("WEBHOOK_URL não configurado");
}

function sanitizeContent(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/@everyone/gi, "@ everyone")
    .replace(/@here/gi, "@ here");
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Endpoint principal
app.post("/dink", upload.any(), async (req, res) => {
  try {
    // Autenticação opcional
    const key = req.headers["x-api-key"];
    if (API_KEY && key !== API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log("========== DINK REQUEST ==========");
    console.log("Headers:", req.headers);
    console.log("Body:", JSON.stringify(req.body, null, 2));
    console.log("Files:", req.files?.length ?? 0);
    console.log("==================================");

    const form = new FormData();

    // Monta payload
    let payload = req.body.payload_json
      ? JSON.parse(req.body.payload_json)
      : { ...req.body };

    if (payload.content) {
      payload.content = sanitizeContent(payload.content);
    }

    payload.allowed_mentions = { parse: [], users: [], roles: [] };

    form.append("payload_json", JSON.stringify(payload));

    // Anexa arquivos corretamente
    for (const file of req.files ?? []) {
      form.append(file.fieldname, file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });
      console.log(`Attached file: ${file.originalname}`);
    }

    // Envia para o Discord
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      body: form,
    });

    const text = await response.text();
    console.log("Discord Status:", response.status);
    console.log("Discord Response:", text);

    res.json({
      success: true,
      discordStatus: response.status,
      discordResponse: text,
    });
  } catch (err) {
    console.error("Erro no /dink:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Rotas de teste
app.get("/health", (_, res) => res.json({ status: "ok" }));
app.get("/", (_, res) => res.json({ status: "online" }));

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
