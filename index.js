const { Telegraf } = require("telegraf");
require("dotenv").config();
const pool = require("./pg"); // PostgreSQL pool ulanishi
const cron = require("node-cron");
const { enwords } = require("./words"); // So'zlar ma'lumotlari
const express = require("express");

const app = express();

app.get("/", (req, res) => {
  res.send("Server is live!");
});

const bot = new Telegraf(process.env.BOT_TOKEN);

// Helper function: Foydalanuvchini DB da tekshirish va kerak bo'lsa yaratish
async function findOrCreateUser(telegramId, chosenLang = "en") {
  const res = await pool.query("SELECT * FROM users WHERE telegram_id = $1", [telegramId]);
  if (res.rows.length === 0) {
    await pool.query(
      "INSERT INTO users (telegram_id, chosen_lang, word_limit, schedule) VALUES ($1, $2, $3, $4)",
      [telegramId, chosenLang, 5, "09:00"] // Default so'z limiti va schedule
    );
    return { telegram_id: telegramId, chosen_lang: chosenLang, word_limit: 5, schedule: "09:00" };
  }
  return res.rows[0];
}

// /start buyrug'i
bot.start(async (ctx) => {
  const user = ctx.from;
  await findOrCreateUser(user.id);

  ctx.reply(
    `Salom, ${user.first_name} 👋\n<b>Til o'rgan bot</b>ga xush kelibsiz!\nO'rganmoqchi bo'lgan tilingizni tanlang:`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🇺🇸 Ingliz tili", callback_data: "lang_en" },
            { text: "🇷🇺 Rus tili", callback_data: "lang_ru" },
          ],
        ],
      },
    }
  );
});

// Til tanlash tugmachalari
bot.action("lang_en", async (ctx) => {
  await ctx.editMessageReplyMarkup(null);
  const user = ctx.from;
  await pool.query("UPDATE users SET chosen_lang = $1 WHERE telegram_id = $2", ["en", user.id]);
  ctx.reply(
    `🎉 <b>Ajoyib!</b>\n\n<b>Til o‘rgan bot</b> haqida qisqacha:\n\n` +
      `📚 Har kuni siz tanlagan tilda <b>5</b>, <b>10</b> yoki <b>15 ta yangi so‘z</b> yuboriladi.\n\n` +
      `🧠 Har bir so‘zga <i>tavsif</i> va <i>tarjima</i> birga beriladi.\n\n` +
      `🔁 Bu usul orqali siz <b>doimiy va intizomli o‘rganish</b> orqali so‘z boyligingizni tezda oshirasiz.\n\n` +
      `🚀 Keling, birinchi kuningizni boshlaymiz!\n\n` +
      `⚠️ /settings buyrug'i orqali sozlamalarni o'zgartirishingiz mumkin (so'z limitini, so'z tashlash vaqtini va tilni).`,
    { parse_mode: "HTML" }
  );
});

bot.action("lang_ru", (ctx) => {
  ctx.reply("Bu funksiya hozirda mavjud emas.");
});

// /settings komandasi
bot.command("settings", async (ctx) => {
  const user = ctx.from;
  const res = await pool.query("SELECT * FROM users WHERE telegram_id = $1", [user.id]);

  if (res.rows.length === 0) {
    return ctx.reply("Profil topilmadi. Iltimos, /start buyrug'ini yuboring.");
  }

  const useInfo = res.rows[0];

  await ctx.reply(
    `Sizning profilingiz:\n\n<b>So'z limiti:</b> ${useInfo.word_limit}\n<b>So'z tashlash vaqti:</b> ${useInfo.schedule}\n<b>Til:</b> ${useInfo.chosen_lang}`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "So'z limitini o'zgartirish", callback_data: "word_limit" },
            { text: "So'z tashlash vaqtini o'zgartirish", callback_data: "schedule" },
          ],
          [{ text: "Tilni o'zgartirish", callback_data: "lang" }],
        ],
      },
    }
  );
});

// So'z limitini o'zgartirish uchun actionlar
bot.action("word_limit", (ctx) => {
  ctx.reply("Limitni tanlang:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "5", callback_data: "limit_5" },
          { text: "10", callback_data: "limit_10" },
          { text: "15", callback_data: "limit_15" },
        ],
      ],
    },
  });
});

["5", "10", "15"].forEach((limit) => {
  bot.action(`limit_${limit}`, async (ctx) => {
    await pool.query(`UPDATE users SET word_limit = $1 WHERE telegram_id = $2`, [limit, ctx.from.id]);
    await ctx.editMessageReplyMarkup(null);
    await ctx.reply(`Limit muvaffaqiyatli ${limit} ga o'zgartirildi!`);
  });
});

// So'z tashlash vaqtini o'zgartirish
bot.action("schedule", (ctx) => {
  ctx.reply("O'zingizga qulay vaqtni shu ko'rinishda kiriting: hh:mm (masalan, 12:30)");
  
  // Faqat keyingi 1 marta kelgan matnni qabul qilamiz
  bot.once("text", async (ctx2) => {
    const time = ctx2.message.text;
    const parts = time.split(":");
    if (
      parts.length === 2 &&
      !isNaN(parts[0]) &&
      !isNaN(parts[1]) &&
      Number(parts[0]) >= 0 &&
      Number(parts[0]) < 24 &&
      Number(parts[1]) >= 0 &&
      Number(parts[1]) < 60
    ) {
      await pool.query("UPDATE users SET schedule = $1 WHERE telegram_id = $2", [time, ctx2.from.id]);
      ctx2.reply("Vaqt muvaffaqiyatli o'zgartirildi!");
    } else {
      ctx2.reply("Noto‘g‘ri format! Iltimos, hh:mm ko‘rinishda kiriting (masalan, 12:30).");
    }
  });
});

// Tilni o'zgartirish
bot.action("lang", (ctx) => {
  ctx.reply("Tilni tanlang:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🇺🇸 Ingliz tili", callback_data: "lang_en" },
          { text: "🇷🇺 Rus tili", callback_data: "lang_ru" },
        ],
      ],
    },
  });
});

// Funksiya: foydalanuvchiga so‘zlarni yuborish
async function sendWordsToUser(bot, telegram_id, lang, word_limit) {
  let word_data = [];
  if (lang === "en") {
    word_data = enwords;
  }
  // Kelajak uchun boshqa tillar qo'shish mumkin

  if (word_data.length === 0) return;

  const words = [];
  const usedIndexes = new Set();

  while (words.length < word_limit && usedIndexes.size < word_data.length) {
    const randomIndex = Math.floor(Math.random() * word_data.length);
    if (!usedIndexes.has(randomIndex)) {
      usedIndexes.add(randomIndex);
      words.push(word_data[randomIndex]);
    }
  }

  let message = `📚 <b>Bugungi so‘zlaringiz:</b>\n\n`;
  words.forEach((word, idx) => {
    message += `${idx + 1}. <b>${word.word}</b> - ${word.translation}\n`;
    message += `<b>Description:</b> ${word.description}\n`;
    message += `<b>Example:</b> ${word.example}\n\n`;
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
    "💬 Biror savol yoki taklif bo‘lsa, bemalol yozing. Biz sizni eshitamiz!",
  ];

  try {
    await bot.telegram.sendMessage(telegram_id, message, { parse_mode: "HTML" });
    const endingMessage = endings[Math.floor(Math.random() * endings.length)];
    await bot.telegram.sendMessage(telegram_id, endingMessage);
  } catch (err) {
    console.error(`So'zlarni yuborishda xatolik: ${err.message}`);
  }
}

// Cron jadvalini sozlash
// Har daqiqada ishlaydi, hozirgi vaqtga teng keladigan foydalanuvchilarga so'zlar yuboradi
cron.schedule("* * * * *", async () => {
  const now = new Date();
  const hour = now.getHours().toString().padStart(2, "0");
  const minute = now.getMinutes().toString().padStart(2, "0");
  const currentTime = `${hour}:${minute}`;

  try {
    const res = await pool.query("SELECT * FROM users WHERE schedule = $1", [currentTime]);
    const users = res.rows;

    for (const user of users) {
      console.log(`So'z yuboriladi: ${user.telegram_id}`);
      await sendWordsToUser(bot, user.telegram_id, user.chosen_lang, parseInt(user.word_limit));
    }
  } catch (err) {
    console.error("Cron ishida xatolik:", err);
  }
});

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

bot.launch();

app.listen(8000, () => {
  console.log("Server started on port 8000");
});
