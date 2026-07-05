const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();

// Разрешаем запросы со стороны Taplink
app.use(cors());

// Парсинг JSON для Vercel
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Тестовый роут
app.get('/', (req, res) => {
    res.json({ status: "server is running" });
});

// Основной маршрут для создания платежа в Т-Банке
app.post('/create-payment', async (req, res) => {
    try {
        const { amount, description } = req.body;

        if (!amount) {
            return res.status(400).json({ error: "Не указана сумма платежа" });
        }

        const terminalKey = process.env.TERMINAL_KEY;
        const password = process.env.PASSWORD;

        if (!terminalKey || !password) {
            return res.status(500).json({ error: "Ключи оплаты не настроены в Environment Variables на Vercel" });
        }

        const orderId = `order_${Date.now()}`;

        // Сборка токена по правилам Т-Банка
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

        // Отправка запроса с помощью встроенного глобального fetch
        const tbankResponse = await fetch('https://securepay.tinkoff.ru/v2/Init', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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
            return res.status(400).json({
                error: tbankData.Message || 'Ошибка инициализации платежа банком'
            });
        }

    } catch (error) {
        console.error('Ошибка:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера платежей' });
    }
});

module.exports = app;
