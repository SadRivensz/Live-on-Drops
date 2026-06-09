import express from "express";
import multer from "multer";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

console.log("=== [INICIALIZAÇÃO DO SERVIDOR] ===");
console.log("PORTA CONFIGURADA =", process.env.PORT || 8080);
console.log("WEBHOOK_URL DETECTADA =", !!process.env.WEBHOOK_URL);
console.log("====================================");

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (!WEBHOOK_URL) {
    throw new Error("MÁ NOTÍCIA: WEBHOOK_URL não foi configurada nas variáveis de ambiente!");
}

//  FUNÇÃO CRÍTICA: DETONA TODOS OS EMOTES E MENÇÕES EM MASSA
function sanitizeContent(text) {
    if (typeof text !== "string") return text;
    
    // 1. Quebra as menções em massa adicionando um espaço invisível
    let cleanText = text
        .replace(/@everyone/gi, "@ everyone")
        .replace(/@here/gi, "@ here");

    // 2. Remove emojis customizados do Discord (formato <:nome:id> ou <a:nome:id>)
    cleanText = cleanText.replace(/<a?:[a-zA-Z0-9_]+:[0-9]+>/g, "");

    // 3. Limpeza total de qualquer tipo de emoji nativo do Unicode (antigos e novos)
    cleanText = cleanText.replace(/\p{Emoji_Presentation}/gu, "");
    cleanText = cleanText.replace(/\p{Emoji}/gu, "");

    // Remove espaços extras que sobraram após apagar os ícones
    return cleanText.trim();
}

// ROTA PRINCIPAL (LOG DE ALERTA CASO ENTRE REQUISIÇÃO ERRADA)
app.all("/", (req, res) => {
    console.log(" ALERTA: Alguém fez uma requisição na rota principal '/' em vez de '/dink'!");
    res.json({ status: "online", aviso: "Use a rota /dink para processar os logs" });
});

// ROTA HEALTH
app.get("/health", (_, res) => {
    res.json({ status: "ok" });
});

//  ROTA OFICIAL DO DINK (TRATAMENTO DE DADOS)
app.post("/dink", upload.any(), async (req, res) => {
    try {
        console.log(" [SINAL RECEBIDO] O DINK BATEU NA ROTA CORRETA '/dink'!");
        console.log("-> Dados do Body:", JSON.stringify(req.body, null, 2));
        console.log("-> Total de Arquivos/Prints:", req.files?.length ?? 0);

        const form = new FormData();

        // Se o Dink enviar via payload_json (Formato Empacotado)
        if (req.body.payload_json) {
            try {
                const payload = JSON.parse(req.body.payload_json);
                if (payload.content) {
                    console.log("-> Texto antes de limpar:", payload.content);
                    payload.content = sanitizeContent(payload.content);
                    console.log("-> Texto limpo (Sem Emotes):", payload.content);
                }
                payload.allowed_mentions = { parse: [], users: [], roles: [] };
                form.append("payload_json", JSON.stringify(payload));
            } catch (err) {
                console.error(" Falha ao ler o payload_json do Dink:", err.message);
                form.append("payload_json", req.body.payload_json);
            }
        } else {
            // Se o Dink enviar via Body Direto
            const payload = structuredClone(req.body);
            let textMessage = payload.content || payload.text || payload.message || payload.msg || "";
            
            if (textMessage) {
                console.log("-> Texto antes de limpar:", textMessage);
                payload.content = sanitizeContent(textMessage);
                console.log("-> Texto limpo (Sem Emotes):", payload.content);
            } else {
                console.log(" Nenhum texto identificado no corpo da requisição.");
            }

            payload.allowed_mentions = { parse: [], users: [], roles: [] };
            form.append("payload_json", JSON.stringify(payload));
        }

        // Reanexa todas as capturas de tela/imagens que o Dink mandar
        for (const file of req.files ?? []) {
            console.log(`-> Anexando imagem recebida: ${file.originalname}`);
            const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
            form.append(file.fieldname, blob, file.originalname);
        }

        console.log("-> Disparando dados limpos para o Discord...");
        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            body: form
        });

        const text = await response.text();
        console.log(" RESPOSTA DO DISCORD -> Status:", response.status);

        return res.status(200).json({ success: true, discordStatus: response.status });

    } catch (err) {
        console.error(" ERRO INTERNO NO SCRIPT:", err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// Captura de rotas inexistentes
app.use((req, res) => {
    console.log(` ERRO 404: Tentaram acessar uma rota inválida: ${req.url}`);
    res.status(404).json({ error: "Rota inválida. Use /dink" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
    console.log(` SERVIDOR ESCUTANDO NA PORTA ${PORT} EM HOST GLOBAL 0.0.0.0`);
});
