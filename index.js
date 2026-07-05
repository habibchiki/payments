const express = require('express');
const cors = require('cors');//<--добавила
const fetch = require('node-fetch');
const crypto = require('crypto');

const app = express();
app.use(cors());//добавила
app.use(express.json());

// === КЛЮЧИ ИЗ SECRETS ===
const TERMINAL_KEY = process.env.TERMINAL_KEY;
const PASSWORD = process.env.PASSWORD;

// Функция генерации токена по правилам Т-Банка
function generateToken(params) {
    const sortedKeys = Object.keys(params).sort();
    let str = '';

    for (let key of sortedKeys) {
        if (key !== 'Token' && key !== 'Receipt' && params[key] !== undefined && params[key] !== null && params[key] !== '') {
            str += params[key];
        }
    }

    str += PASSWORD;
    return crypto.createHash('sha256').update(str).digest('hex');
}

// Маршрут для создания платежа
app.post('/create-payment', async (req, res) => {
    const { amount, orderId, description = 'Оплата по свободной сумме', email } = req.body;

    if (!amount || amount < 1000) { // минимум 10 руб = 1000 копеек
        return res.status(400).json({ error: 'Минимальная сумма 10 руб.' });
    }

    const payload = {
        TerminalKey: TERMINAL_KEY,
        Amount: amount,
        OrderId: orderId || 'order_' + Date.now(),
        Description: description,
        SuccessURL: 'https://твоя-страница-taplink/success', // поменяй на свою ссылку позже
        FailURL: 'https://твоя-страница-taplink/fail',     // поменяй на свою ссылку позже
        Receipt: {
            Email: email || 'customer@example.com',
            Taxation: 'usn_income',
            Items: [{
                Name: description,
                Price: amount,
                Quantity: 1,
                Amount: amount,
                Tax: 'none'
            }]
        }
    };

    payload.Token = generateToken(payload);

    try {
        const response = await fetch('https://securepay.tinkoff.ru/v2/Init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.PaymentURL) {
            res.json({ paymentUrl: data.PaymentURL });
        } else {
            res.status(400).json({ error: data.Message || 'Ошибка банка' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Тестовый маршрут, чтобы проверить работоспособность
app.get('/', (req, res) => {
    res.json({ status: 'server is running 🚀' });
});

// ОБЯЗАТЕЛЬНО ДЛЯ REPLIT: Запуск сервера на правильном порту
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
