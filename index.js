const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const crypto = require('crypto');

const app = express();

// 1. Настройка CORS — разрешает Taplink отправлять запросы на этот сервер
app.use(cors());

// 2. Правильный парсинг данных для Serverless-среды Vercel
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Тестовый маршрут (для проверки работоспособности сервера в браузере)
app.get('/', (req, res) => {
    res.json({ status: "server is running" });
});

// Главный маршрут для создания платежной сессии
app.post('/create-payment', async (req, res) => {
    try {
        const { amount, description } = req.body;

        // Базовая проверка входящих данных
        if (!amount) {
            return res.status(400).json({ error: "Не указана сумма платежа" });
        }

        // Загружаем секретные ключи из переменных окружения Vercel (Environment Variables)
        const terminalKey = process.env.TERMINAL_KEY;
        const password = process.env.PASSWORD;
        
        if (!terminalKey || !password) {
            console.error('КРИТИЧЕСКАЯ ОШИБКА: Ключи TERMINAL_KEY или PASSWORD не настроены в Vercel!');
            return res.status(500).json({ error: "Ошибка конфигурации сервера (отсутствуют ключи)" });
        }

        // Генерируем уникальный номер заказа, чтобы банк его принял
        const orderId = `order_${Date.now()}`;

        // 3. Сборка объекта для расчета SHA-256 подписи (токена) по правилам Т-Банка
        // ВНИМАНИЕ: Пароль участвует в генерации токена, но НЕ отправляется в запросе!
        const dataForSign = {
            Amount: amount,
            Description: description || 'Оплата',
            OrderId: orderId,
            Password: password,
            TerminalKey: terminalKey
        };

        // Сортируем ключи по алфавиту и конкатенируем их значения
        const sortedKeys = Object.keys(dataForSign).sort();
        let signString = '';
        sortedKeys.forEach(key => {
            signString += dataForSign[key];
        });

        // Хешируем строку через sha256 в hex-формат
        const token = crypto.createHash('sha256').update(signString).digest('hex');

        // 4. Отправка запроса на инициализацию платежа в Т-Банк
        const tbankResponse = await fetch('https://securepay.tinkoff.ru/v2/Init', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                TerminalKey: terminalKey,
                Amount: amount,
                OrderId: orderId,
                Description: description || 'Оплата',
                Token: token // Сгенерированный токен безопасности
            })
        });

        const tbankData = await tbankResponse.json();

        // 5. Обработка ответа от банка
        if (tbankData.Success && tbankData.PaymentURL) {
            // Если банк всё одобрил, возвращаем ссылку фронтенду (Taplink)
            return res.json({ paymentUrl: tbankData.PaymentURL });
        } else {
            // Если банк вернул ошибку, логируем её и отдаем клиенту
            console.error('Ошибка банка:', tbankData);
            return res.status(400).json({
                error: tbankData.Message || tbankData.Details || 'Ошибка инициализации платежа в банке'
            });
        }

    } catch (error) {
        console.error('Системная ошибка бэкенда:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера оплаты' });
    }
});

// Экспортируем модуль для корректной работы Vercel в режиме Serverless
module.exports = app;
