const crypto = require("crypto");

module.exports = async (req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method Not Allowed"
        });
    }

    try {
        const terminalKey = process.env.TERMINAL_KEY;
        const password = process.env.TERMINAL_PASSWORD;

        if (!terminalKey || !password) {
            return res.status(500).json({
                error: "TERMINAL_KEY или TERMINAL_PASSWORD не настроены"
            });
        }

        const { amount, description } = req.body;

        if (!amount || Number(amount) < 1000) {
            return res.status(400).json({
                error: "Минимальная сумма 10 рублей"
            });
        }

        const orderId = `order_${Date.now()}`;

        const signData = {
            Amount: String(amount),
            Description: description || "Оплата",
            OrderId: orderId,
            Password: password,
            TerminalKey: terminalKey
        };

        const token = crypto
            .createHash("sha256")
            .update(
                Object.keys(signData)
                    .sort()
                    .map(k => signData[k])
                    .join("")
            )
            .digest("hex");

        const response = await fetch("https://securepay.tinkoff.ru/v2/Init", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                TerminalKey: terminalKey,
                Amount: Number(amount),
                OrderId: orderId,
                Description: description || "Оплата",
                Token: token
            })
        });

        const data = await response.json();

        console.log(data);

        if (!data.Success) {
            return res.status(400).json(data);
        }

        return res.status(200).json({
            paymentUrl: data.PaymentURL
        });

    } catch (e) {

        console.error(e);

        return res.status(500).json({
            error: e.message
        });

    }
};
