const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ status: 'server is running' });
});

app.post('/create-payment', async (req, res) => {
    try {
        const { amount, description } = req.body;

        const terminalKey = process.env.TERMINAL_KEY;
        const password = process.env.TERMINAL_PASSWORD;

        if (!amount) {
            return res.status(400).json({ error: 'Не указана сумма' });
        }

        if (!terminalKey || !password) {
            return res.status(500).json({ error: 'Не настроены ENV переменные' });
        }

        const orderId = `order_${Date.now()}`;

        const dataForSign = {
            Amount: String(amount),
            Description: description || 'Оплата',
            OrderId: orderId,
            Password: password,
            TerminalKey: terminalKey
        };

        const token = crypto
            .createHash('sha256')
            .update(
                Object.keys(dataForSign)
                    .sort()
                    .map(key => dataForSign[key])
                    .join('')
            )
            .digest('hex');

        console.log('Создание платежа:', {
            Amount: amount,
            OrderId: orderId
        });

        const response = await fetch('https://securepay.tinkoff.ru/v2/Init', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                TerminalKey: terminalKey,
                Amount: amount,
                OrderId: orderId,
                Description: description || 'Оплата',
                Token: token
            })
        });

        const result = await response.json();

        console.log('Ответ Т-Банка:', result);

        if (!result.Success) {
            return res.status(400).json(result);
        }

        return res.json({
            paymentUrl: result.PaymentURL
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            error: err.message
        });
    }
});

module.exports = app;
