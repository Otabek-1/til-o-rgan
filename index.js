const { Telegraf } = require("telegraf");
require("dotenv").config();
const pool = require("./pg");
const cron = require("node-cron");
const { enwords } = require("./words");


const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
    const user = ctx.message.from;
    ctx.reply(
        `Salom, ${ctx.from.first_name} 👋\n<b>Til o'rgan bot</b>ga xush kelibsiz!\nO'rganmoqchi bo'lgan tilingizni tanlang:`,
        {
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "🇺🇸 Ingliz tili", callback_data: "lang_en" },
                        { text: "🇷🇺 Rus tili", callback_data: "lang_ru" }
                    ]
                ]
            }
        }
    );

    bot.action("lang_ru", (ctx) => {
        ctx.reply("Bu funksiya hozirda mavjud emas.");
    })

    bot.action("lang_en", async (ctx) => {
        await ctx.editMessageReplyMarkup(null);
        const user = ctx.from;
        const res = await pool.query(`INSERT INTO users (telegram_id, chosen_lang) VALUES ($1,$2)`, [user.id, "en"]);
        ctx.reply(
            `🎉 <b>Ajoyib!</b>\n\n<b>Til o‘rgan bot</b> haqida qisqacha:\n\n📚 Har kuni siz tanlagan tilda <b>5</b>, <b>10</b> yoki <b>15 ta yangi so‘z</b> yuboriladi.\n\n🧠 Har bir so‘zga <i>tavsif</i> va <i>tarjima</i> birga beriladi.\n\n🔁 Bu usul orqali siz <b>doimiy va intizomli o‘rganish</b> orqali so‘z boyligingizni tezda oshirasiz.\n\n🚀 Keling, birinchi kuningizni boshlaymiz!\n\n⚠️ /settings buyrug'i orqali sozlamalarni o'zgartirishingiz mumkin (so'zlarni tashlash vaqti, so'z limiti va tilni).`,
            {
                parse_mode: "HTML"
            }
        );
    })
});

bot.command("settings", async (ctx) => {
    const user = ctx.from;
    const res = await pool.query("SELECT * FROM users WHERE telegram_id = $1", [user.id]);
    const useInfo = res.rows[0];
    ctx.reply(`Sizning profilingiz:\n\n<b>So'z limiti:</b> ${useInfo.word_limit}\n<b>So'z tashlash vaqti:</b> ${useInfo.schedule}\n<b>Til:</b> ${useInfo.chosen_lang}`, {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "So'z limitini o'zgartirish", callback_data: "word_limit" },
                    { text: "So'z tashlash vaqtni o'zgartirish", callback_data: "schedule" }
                ],
                [
                    { text: "Tilni o'zgartirish", callback_data: "lang" }
                ]
            ]
        }
    });


    // Finished!!!
    bot.action("word_limit", (ctx) => {
        ctx.reply("Limitni tanlang:", {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "5", callback_data: "5" },
                        { text: "10", callback_data: "10" },
                        { text: "15", callback_data: "15" }
                    ]
                ]
            }
        })

        bot.action("5", async (ctx) => {
            await pool.query(`UPDATE users SET word_limit = $1 WHERE telegram_id = $2`, ["5", ctx.from.id]);
            ctx.editMessageReplyMarkup(null);
            ctx.reply("Limit muvaffaqiyatli o'zgartirildi!");
        })

        bot.action("10", async (ctx) => {
            await pool.query(`UPDATE users SET word_limit = $1 WHERE telegram_id = $2`, ["10", ctx.from.id]);
            ctx.editMessageReplyMarkup(null);
            ctx.reply("Limit muvaffaqiyatli o'zgartirildi!");
        })

        bot.action("15", async (ctx) => {
            await pool.query(`UPDATE users SET word_limit = $1 WHERE telegram_id = $2`, ["15", ctx.from.id]);
            ctx.editMessageReplyMarkup(null);
            ctx.reply("Limit muvaffaqiyatli o'zgartirildi!");
        })
    })

    // Finished!!!
    bot.action("schedule", (ctx) => {
        ctx.reply("O'zingizga qulay vaqtni shu ko'rinishda jo'nating: hh:mm => 12:30");

        bot.on("text", (ctx) => {
            const time = ctx.message.text;
            const Time = time.split(":");
            const hour = Time[0];
            const min = Time[1];
            if (hour < 24 && min < 60) {
                pool.query(`UPDATE users SET schedule = $1 WHERE telegram_id = $2`, [time, ctx.from.id]);
                ctx.reply("Vaqt muvaffaqiyatli o'zgartirildi!");
            } else {
                ctx.reply("To'g'ri formatda kiriting!  soat < 24 va minut < 60");
            }
        })
    })

    bot.action("lang", (ctx) => {
        ctx.reply("Tilni tanlang:", {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "🇺🇸 Ingliz tili", callback_data: "lang_en" },
                        { text: "🇷🇺 Rus tili", callback_data: "lang_ru" }
                    ]
                ]
            }
        })

        bot.action("lang_ru", (ctx) => {
            ctx.reply("Bu funksiya hozirda mavjud emas.");
        })

        bot.action("lang_en", async (ctx) => {
            await pool.query(`UPDATE users SET chosen_lang = $1 WHERE telegram_id = $2`, ["en", ctx.from.id]);
            ctx.editMessageReplyMarkup(null);
            ctx.reply("Til muvaffaqiyatli o'zgartirildi!");
        })
    })
})


bot.launch();

function sendWordsToUser(bot, telegram_id, lang, word_limit) {
    let word_data;
    if (lang === "en") {
        word_data = enwords;
    } else {
        word_data = []; // kelajakda boshqa tillar qo‘shilsa shu yerga qo‘shiladi
    }

    if (!word_data.length) return;

    let words = [];
    const selectedIndexes = new Set();
    while (words.length < word_limit) {
        const randomIndex = Math.floor(Math.random() * word_data.length);

        if (!selectedIndexes.has(randomIndex)) {
            selectedIndexes.add(randomIndex);
            words.push(word_data[randomIndex]);
        }
    }

    let message = `📚 <b>Bugungi so‘zlaringiz:</b>\n\n`;
    words.forEach((word, index) => {
        message += `${index + 1}. <b>${word.word}</b> - ${word.translation}\n<b>Description:</b> ${word.description}\n<b>Example:</b> ${word.example}\n\n`;
    });


    const endings = [
        "🔁 Esda tuting: har kuni oz-ozdan o‘rganish katta natijaga olib keladi!",
        "🚀 Siz har kuni yaxshilanyapsiz – davom eting!",
        "📚 Bugungi so‘zlaringiz yuborildi. Endi ularni amalda qo‘llab ko‘ring!",
        "🤝 Siz bilan birgamiz! Ertaga yangi so‘zlar bilan qaytamiz!",
        "🌱 Har bir yangi so‘z – bu bilim daraxtingizga qo‘shilgan yangi barg!",
        "🎯 Maqsadingizga oz qoldi – faqat davom eting!",
        "💡 Agar unutmoqchi bo‘lsangiz – takrorlang. Harakatda baraka bor!",
        "🔥 Sizda hammasi chiqadi – biz siz bilan birgamiz!",
        "🗣 So‘zlarni yodlang va kundalik hayotingizda ishlatishga harakat qiling!",
        "💬 Biror savol yoki taklif bo‘lsa, bemalol yozing. Biz sizni eshitamiz!"
    ];


    bot.telegram.sendMessage(telegram_id, message, { parse_mode: "HTML" });
    const endingMessage = endings[Math.floor(Math.random() * endings.length)];
    bot.telegram.sendMessage(telegram_id, endingMessage);

}


// Cronni shu yerda ishga tushirasan:
// Cronni shu yerda ishga tushirasan:
cron.schedule("* * * * *", async () => {
    const now = new Date();
    const hour = now.getHours().toString().padStart(2, "0");
    const minute = now.getMinutes().toString().padStart(2, "0");
    const currentTime = `${hour}:${minute}`;

    try {
        const res = await pool.query(
            `SELECT * FROM users WHERE schedule = $1`,
            [currentTime]
        );

        const users = res.rows;

        for (const user of users) {
            console.log(`So'z yuboriladi: ${user.telegram_id}`);
            sendWordsToUser(bot, user.telegram_id, user.chosen_lang, parseInt(user.word_limit));
        }
    } catch (err) {
        console.error("Schedule cron xatolik:", err);
    }
});


// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

console.log("Bot started");