const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();

// Разрешаем CORS со всех доменов без ограничений
app.use(cors({ origin: '*' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Обрабатываем OPTIONS пред-запросы вручную на корневом уровне
app.options('*', (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.sendStatus(200);
});

// Тестовый роут проверки
app.get('/', (req, res) => {
    res.json({ status: "server is running" });
});

// Главный роут создания платежа
app.post('/create-payment', async (req, res) => {
    try {
        const { amount, description } = req.body;
const terminalKey = process.env.TERMINAL_KEY;
const password = process.env.TERMINAL_PASSWORD;
if (!amount || !terminalKey || !password) {
    return res.status(400).json({ error: "Отсутствуют обязательные параметры" });
}

const orderId = `order_${Date.now()}`;

const dataForSign = {
    Amount: amount.toString(),           // обязательно строка!
    Description: description || 'Оплата',
    OrderId: orderId,
    Password: password,
    TerminalKey: terminalKey
};

// Сортируем ключи по алфавиту
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
                Description: description || 'Оплата',
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
        return res.status(500).json({ error: 'Внутренняя ошибка бэкенда' });
    }
});

module.exports = app;
