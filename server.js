import express from "express";
import multer from "multer";

const app = express();
// Configura o multer para usar a memória RAM, evitando erros de permissão de pasta na DisCloud
const upload = multer({ storage: multer.memoryStorage() });

console.log("SERVER STARTING");
console.log("PORT =", process.env.PORT || 8080);
console.log("WEBHOOK_URL =", !!process.env.WEBHOOK_URL);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (!WEBHOOK_URL) {
    throw new Error("WEBHOOK_URL not configured");
}

// Função responsável por quebrar as menções em massa antes de irem para o Discord
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
        console.log("========== DINK REQUEST ==========");
        console.log("Content-Type:", req.headers["content-type"]);
        console.log("Body:");
        console.log(JSON.stringify(req.body, null, 2));
        console.log("Files:", req.files?.length ?? 0);
        console.log("==================================");

        // Usando o FormData nativo global do Node.js (Sem precisar de imports externos)
        const form = new FormData();

        // Tratamento caso o Dink envie os dados empacotados em payload_json
        if (req.body.payload_json) {
            try {
                const payload = JSON.parse(req.body.payload_json);

                if (payload.content) {
                    payload.content = sanitizeContent(payload.content);
                }

                payload.allowed_mentions = {
                    parse: [],
                    users: [],
                    roles: []
                };

                form.append("payload_json", JSON.stringify(payload));
            } catch (err) {
                console.error("Failed to parse payload_json:", err);
                form.append("payload_json", req.body.payload_json);
            }
        } else {
            // Tratamento caso o Dink envie os dados diretamente no corpo da requisição
            const payload = structuredClone(req.body);

            // Garante a captura do texto mesmo se mudar o nome do parâmetro enviado pelo Dink
            let textMessage = payload.content || payload.text || payload.message || payload.msg || "";
            
            if (textMessage) {
                payload.content = sanitizeContent(textMessage);
            }

            payload.allowed_mentions = {
                parse: [],
                users: [],
                roles: []
            };

            form.append("payload_json", JSON.stringify(payload));
        }

        // Reanexa os screenshots e mídias enviados pelo Dink
        for (const file of req.files ?? []) {
            const blob = new Blob(
                [new Uint8Array(file.buffer)],
                { type: file.mimetype }
            );

            form.append(
                file.fieldname,
                blob,
                file.originalname
            );

            console.log(`Attached file: ${file.originalname}`);
        }

        // Dispara o formulário limpo em direção ao canal do Discord
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
        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.get("/health", (_, res) => {
    res.json({ status: "ok" });
});

app.get("/", (_, res) => {
    res.json({ status: "online" });
});

// A DisCloud exige escutar a porta 8080 e aceitar o host global 0.0.0.0
const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Listening on ${PORT} at host 0.0.0.0`);
});
