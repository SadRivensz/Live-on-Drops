import express from "express";

const app = express();

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

function sanitize(payload) {
    const copy = structuredClone(payload);

    if (typeof copy.content === "string") {
        copy.content = copy.content
            .replace(/@everyone/gi, "@ everyone")
            .replace(/@here/gi, "@ here");
    }

    copy.allowed_mentions = {
        parse: [],
        users: [],
        roles: []
    };

    return copy;
}

app.post("/dink", async (req, res) => {
    try {
        const key = req.headers["x-api-key"];

        if (API_KEY && key !== API_KEY) {
            return res.status(401).json({
                error: "Unauthorized"
            });
        }

        console.log("========== DINK REQUEST ==========");
        console.log("Content-Type:", req.headers["content-type"]);
        console.log("Body:");
        console.log(JSON.stringify(req.body, null, 2));
        console.log("Query:");
        console.log(JSON.stringify(req.query, null, 2));
        console.log("==================================");

        const payload = sanitize(req.body);

        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const text = await response.text();

        console.log("Discord Status:", response.status);
        console.log("Discord Response:", text);
        console.log("Payload Sent:");
        console.log(JSON.stringify(payload, null, 2));

        res.status(200).json({
            success: true,
            discordStatus: response.status,
            discordResponse: text
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

        const text = await response.text();

    console.log("Discord Status:", response.status);
    console.log("Discord Response:", text);
    console.log("Payload:", JSON.stringify(payload, null, 2));

        res.status(200).json({
            success: true,
            discordStatus: response.status,
            discordResponse: text
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.get("/health", (_, res) => {
    res.json({
        status: "ok"
    });
});

const PORT = process.env.PORT || 3000;

app.get("/", (_, res) => {
    res.json({
        status: "online"
    });
});
app.listen(PORT, () => {
    console.log(`Listening on ${PORT}`);
});
