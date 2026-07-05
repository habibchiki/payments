const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();

// Разрешаем CORS для Taplink
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Тестовый роут для проверки в браузере
app.get('/api', (req, res) => {
    res.json({ status: "server is running" });
});

// Реальный роут, куда будет стучаться Taplink
app.post('/api/create-payment', async (req, res) => {
    try {
        const { amount, description } = req.body;

        if (!amount) {
            return res.status(400).json({ error: "Не указана сумма платежа" });
        }

        const terminalKey = process.env.TERMINAL_KEY;
        const password = process.env.PASSWORD;

        if (!terminalKey || !password) {
            return res.status(500).json({ error: "Ключи оплаты не настроены в Vercel" });
        }

        const orderId = `order_${Date.now()}`;

        const dataForSign = {
            Amount: amount,
            Description: description || 'Оплата по свободной сумме',
            OrderId: orderId,
            Password: password,
            TerminalKey: terminalKey
        };

        const sortedKeys = Object.keys(dataForSign).sort();
        let signString = '';
        sortedKeys.forEach(key => {
            signString += dataForSign[key];
        });

        const token = crypto.createHash('sha256').update(signString).digest('hex');

        const tbankResponse = await fetch('https://securepay.tinkoff.ru/v2/Init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                TerminalKey: terminalKey,
                Amount: amount,
                OrderId: orderId,
                Description: description || 'Оплата по свободной сумме',
                Token: token
            })
        });

        const tbankData = await tbankResponse.json();

        if (tbankData.Success && tbankData.PaymentURL) {
            return res.json({ paymentUrl: tbankData.PaymentURL });
        } else {
            return res.status(400).json({ error: tbankData.Message || 'Ошибка банка' });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

module.exports = app;
