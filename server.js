import express from "express";
import multer from "multer";
import fetch from "node-fetch";

const app = express();
const upload = multer();

console.log("SERVER STARTING");
console.log("PORT =", process.env.PORT);
console.log("WEBHOOK_URL =", !!process.env.WEBHOOK_URL);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const API_KEY = process.env.API_KEY;

if (!WEBHOOK_URL) {
    throw new Error("WEBHOOK_URL not configured");
}

function sanitizeContent(text) {
    if (typeof text !== "string") {
        return text;
    }

    return text
        .replace(/@everyone/gi, "@ everyone")
        .replace(/@here/gi, "@ here");
}

app.post("/dink", upload.any(), async (req, res) => {
    try {
        const key = req.headers["x-api-key"];

        if (API_KEY && key !== API_KEY) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        console.log("========== DINK REQUEST ==========");
        console.log("Content-Type:", req.headers["content-type"]);
        console.log("Body:", JSON.stringify(req.body, null, 2));
        console.log("Files:", req.files?.length ?? 0);
        console.log("==================================");

        const form = new FormData();

        // Monta payload
        let payload;
        if (req.body.payload_json) {
            try {
                payload = JSON.parse(req.body.payload_json);
            } catch (err) {
                console.error("Failed to parse payload_json:", err);
                payload = req.body.payload_json;
            }
        } else {
            payload = { ...req.body };
        }

        if (payload.content) {
            payload.content = sanitizeContent(payload.content);
        }

        payload.allowed_mentions = { parse: [], users: [], roles: [] };

        form.append("payload_json", JSON.stringify(payload));

        // Anexa arquivos corretamente
        for (const file of req.files ?? []) {
            form.append(file.fieldname, file.buffer, {
                filename: file.originalname,
                contentType: file.mimetype
            });
            console.log(`Attached file: ${file.originalname}`);
        }

        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            body: form
        });

        const text = await response.text();

        console.log("Discord Status:", response.status);
        console.log("Discord Response:", text);

        return res.status(200).json({
            success: true,
            discordStatus: response.status,
            discordResponse: text
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/health", (_, res) => res.json({ status: "ok" }));
app.get("/", (_, res) => res.json({ status: "online" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));
