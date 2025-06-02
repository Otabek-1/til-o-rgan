const { Telegraf } = require("telegraf");
const pool = require("./pg");
require("dotenv").config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// Foydalanuvchilarning holatini saqlash
const userStates = {
  awaitingAdd: new Set()
};

// Barcha foydalanuvchilar uchun timeoutlarni saqlash
const userTimeouts = new Map();

// Random boshlovchi xabarlar
const messageStarts = [
  "🧠 Eslay olasizmi?",
  "📚 Bugungi kichik test!",
  "🔁 Keling, yodlaymiz!",
  "🌀 Bugungi so'zlar:",
  "🧐 Yodda qoldimi?",
  "📝 Mashq vaqti!",
  "💡 Esingizda bormi?",
  "📖 Bugungi dars:",
  "😎 Keling, tekshirib ko'ramiz:",
];

// Bot komandalari
bot.start(handleStart);
bot.command("add", handleAdd);
bot.on("text", handleText);
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const turejavoblar = ["✅ To‘g‘ri!", "✅ Qoyil, esda qolibdi!", "Malades"];
  const xatojavoblar = ["❌ Noto‘g‘ri!", "❌ Qayta yodlash kerak", "Malades, xato❌"];
  if (data === "true") {
    // Foydalanuvchiga alert chiqadi
    await ctx.answerCbQuery(turejavoblar[Math.floor(Math.random() * turejavoblar.length)], { show_alert: false });

    // Istasangiz, keyingi bosqichga ham o‘tishingiz mumkin
    // await ctx.reply("Keyingi savol: ...");
  } else {
    await ctx.answerCbQuery(xatojavoblar[Math.floor(Math.random() * xatojavoblar.length)], { show_alert: false });
  }
});


// Botni ishga tushirish
bot.launch().then(async () => {
  console.log("🤖 Bot ishga tushdi");
  await initializeUserTimeouts();
  // sendAsTest();
});

// ========== ASOSIY FUNKSIYALAR ==========

async function sendAsTest(userId) {
  const user = await pool.query(
    "SELECT * FROM users WHERE telegram_id = $1 AND array_length(remembering_words, 1) > 0",
    [userId]
  );

  if (!user.rows.length) return;

  const words = user.rows[0].remembering_words;
  const selected = words[Math.floor(Math.random() * words.length)];
  const [wordEn, wordUz] = selected.split("-");

  const wrongOptions = words
    .map(w => w.split("-")[1])
    .filter(uz => uz !== wordUz);

  let buttons;

  if (wrongOptions.length > 0) {
    const wrongWord = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
    buttons = [
      { text: wordUz, callback_data: "true" },
      { text: wrongWord, callback_data: "false" },
    ];

    // Aralashtiramiz
    for (let i = buttons.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [buttons[i], buttons[j]] = [buttons[j], buttons[i]];
    }
  } else {
    buttons = [{ text: wordUz, callback_data: "true" }];
  }

  await bot.telegram.sendMessage(
    userId,
    `👉 ${wordEn} so‘zining tarjimasini toping:`,
    {
      reply_markup: {
        inline_keyboard: [buttons],
      },
    }
  );
}


async function initializeUserTimeouts() {
  try {
    const users = await pool.query(
      "SELECT telegram_id, schedule FROM users WHERE array_length(remembering_words, 1) > 0"
    );

    for (const user of users.rows) {
      scheduleNextMessage(user.telegram_id, user.schedule);
    }
  } catch (err) {
    console.error("Timeoutlarni boshlashda xato:", err);
  }
}

function scheduleNextMessage(userId, delayMinutes) {
  if (userTimeouts.has(userId)) {
    clearTimeout(userTimeouts.get(userId));
  }

  const time = [1, 5, 10, 15, 20, 30, 45, 60, 70, 80, 100, 120, 150, 300, 600];
  const validatedDelay = time[Math.floor(Math.random() * time.length)];
  const delayMs = Math.min(validatedDelay * 60 * 1000, 2147483647);

  console.log(`[DEBUG] User ${userId} uchun yangi timeout: ${validatedDelay} daqiqa`);

  const timeout = setTimeout(async () => {
    try {
      // 50% ehtimol bilan test yuboriladi, qolganida oddiy so‘zlar
      if (Math.random() < 0.5) {
        await sendAsTest(userId);
      } else {
        await sendWordsToUser(userId);
      }

      scheduleNextMessage(userId, validatedDelay);
    } catch (err) {
      console.error(`Xabar yuborishda xato (${userId}):`, err);
      scheduleNextMessage(userId, 60);
    }
  }, delayMs);

  userTimeouts.set(userId, timeout);
}


async function sendWordsToUser(userId) {
  const user = await pool.query(
    "SELECT remembering_words FROM users WHERE telegram_id = $1",
    [userId]
  );

  if (!user.rows.length || !user.rows[0].remembering_words || user.rows[0].remembering_words.length === 0) {
    return;
  }

  const words = user.rows[0].remembering_words;
  const selectedWords = getRandomWords(words);
  const intro = getRandomStart();
  const message = `${intro}\n\n${selectedWords.map((w, i) => `${i + 1}. ${w}`).join("\n")}`;

  await bot.telegram.sendMessage(userId, message);
}

// ========== YORDAMCHI FUNKSIYALAR ==========

function getRandomStart() {
  return messageStarts[Math.floor(Math.random() * messageStarts.length)];
}

function getRandomWords(words, maxCount = 4) {
  const shuffled = [...words].sort(() => 0.5 - Math.random());
  const count = Math.min(Math.floor(Math.random() * maxCount) + 1, words.length);
  return shuffled.slice(0, count);
}

// ========== COMMAND HANDLERS ==========

async function handleStart(ctx) {
  const userId = ctx.from.id;

  try {
    const user = await pool.query("SELECT * FROM users WHERE telegram_id = $1", [userId]);

    if (user.rows.length === 0) {
      await pool.query(
        "INSERT INTO users (telegram_id, remembering_words, schedule) VALUES ($1, $2, $3)",
        [userId, [], 2] // Default: 30 daqiqa
      );
      await ctx.reply("✅ Xush kelibsiz! So'z qo'shish uchun /add ni bosing.");
    } else {
      await ctx.reply("✅ Qaytganingizdan xursandmiz! So'z qo'shish uchun /add ni bosing.");

      // Agar so'zlari bo'lsa, timeoutni o'rnatamiz
      if (user.rows[0].remembering_words?.length > 0) {
        scheduleNextMessage(userId, user.rows[0].schedule);
      }
    }
  } catch (err) {
    console.error("START ERROR:", err);
    await ctx.reply("❌ Xatolik yuz berdi.");
  }
}

async function handleAdd(ctx) {
  const userId = ctx.from.id;
  userStates.awaitingAdd.add(userId);
  await ctx.reply("So'zni kiriting (masalan: apple - olma):");
}

async function handleText(ctx) {
  const userId = ctx.from.id;

  if (!userStates.awaitingAdd.has(userId)) return;

  const [word, translation] = ctx.message.text.split(" - ").map(s => s.trim());
  if (!word || !translation) {
    return ctx.reply("❗ Format noto'g'ri. Masalan: apple - olma");
  }

  try {
    await pool.query(
      "UPDATE users SET remembering_words = array_append(remembering_words, $1) WHERE telegram_id = $2",
      [`${word} - ${translation}`, userId]
    );

    // Agar bu birinchi so'z bo'lsa, timeoutni boshlaymiz
    const user = await pool.query(
      "SELECT remembering_words, schedule FROM users WHERE telegram_id = $1",
      [userId]
    );

    if (user.rows[0].remembering_words.length === 1) {
      scheduleNextMessage(userId, user.rows[0].schedule);
    }

    await ctx.reply(`✅ Qo'shildi: ${word} - ${translation}`);
  } catch (err) {
    console.error("ADD ERROR:", err);
    await ctx.reply("❌ Xatolik yuz berdi.");
  }

  userStates.awaitingAdd.delete(userId);
}

// ========== PROCESS HANDLERS ==========

process.once("SIGINT", () => {
  cleanupTimeouts();
  bot.stop("SIGINT");
});

process.once("SIGTERM", () => {
  cleanupTimeouts();
  bot.stop("SIGTERM");
});

function cleanupTimeouts() {
  for (const timeout of userTimeouts.values()) {
    clearTimeout(timeout);
  }
  userTimeouts.clear();
}
