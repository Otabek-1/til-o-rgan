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
bot.command("login", handleLogin);
bot.command("broadcast", handleBroadcast);
bot.command("help",handleHelp);
bot.command("admin", handleAdminContact);
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

async function handleAdminContact(ctx){
  ctx.reply(`Contact or support:\n@i_am_nobody2038`);
}

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


async function handleLogin(ctx) {
  const userId = ctx.from.id;
  const userInfo = await pool.query("SELECT * FROM users WHERE telegram_id = $1", [userId]);
  const login = userInfo.rows[0].login;
  const password = userInfo.rows[0].password;
  if (!login || !password) {
    const newLogin = `user${Math.floor(Math.random() * 1000000)}`;
    const newPassword = `u${Math.floor(Math.random() * 1000000)}`;
    await pool.query("UPDATE users SET login = $1, password = $2 WHERE telegram_id = $3", [newLogin, newPassword, userId]);
    await ctx.reply(
      "Sizning login va parolingiz:\n\nLogin: <code>" + newLogin + "</code>\nPassword: <code>" + newPassword + "</code>\n\nLogin va parolni web app da o'zgartirishingiz mumkin.",
      {
        parse_mode: "HTML"
      }
    );

  }
  else {
    ctx.reply(
      `🧾 Sizning login va parolingiz:\n\nLogin: <code>${login}</code>\nPassword: <code>${password}</code>\n\n📎 Nusxa olish uchun ustiga bosing.`,
      { parse_mode: "HTML" }
    );

  }
}

async function handleBroadcast(ctx) {
  const SUPERADMIN_ID = 5303361087;
  const user = ctx.message.from;

  // Faqat superadmin foydalanishi mumkin
  if (user.id !== SUPERADMIN_ID) {
    return ctx.reply("⛔️ Sizda ruxsat yo‘q.");
  }

  // Xabar matnini olish va tekshirish
  const text = ctx.message.text.slice(11).trim();
  if (!text) {
    return ctx.reply("❗️ Xabar matni bo‘sh bo‘lmasligi kerak.");
  }

  try {
    const users = await pool.query("SELECT telegram_id FROM users");
    let successCount = 0;
    let failCount = 0;
    let failedUsers = [];
    let sent = 0;

    for (const userRow of users.rows) {
      try {
        await bot.telegram.sendMessage(userRow.telegram_id, text);
        successCount++;
      } catch (err) {
        failCount++;
        failedUsers.push(userRow.telegram_id);
      }

      sent++;
      // Progress ko‘rsatish (masalan, har 20 ta yuborilganda)
      if (sent % 20 === 0) {
        await ctx.reply(`📢 ${sent}/${users.rows.length} foydalanuvchiga yuborildi...`);
      }
    }

    // Yakuniy hisobot
    let resultMsg = `✅ Xabar ${successCount} ta foydalanuvchiga muvaffaqiyatli yuborildi.`;
    if (failCount > 0) {
      resultMsg += `\n❌ ${failCount} ta foydalanuvchiga yuborilmadi.`;
      if (failCount <= 20) {
        resultMsg += `\nYuborilmadi (ID): ${failedUsers.join(', ')}`;
      }
    }
    await ctx.reply(resultMsg);
  } catch (error) {
    console.error("Broadcast xatoligi:", error);
    await ctx.reply("❌ Broadcast yuborishda xatolik yuz berdi.");
  }
}

async function handleHelp(ctx) {
  await ctx.reply(`📚 *Til O‘rgan Bot - Yordam bo‘limi*

Bu bot ingliz tilini o‘rganishda sizga yordam beruvchi shaxsiy assistentdir. Quyidagi asosiy funksiyalar mavjud:

🔤 *1. /add — Yangi so‘zlar qo‘shish*  
Siz /add buyrug‘i orqali o‘zingiz uchun inglizcha so‘zlar va ularning tarjimasini qo‘shishingiz mumkin.  
Misol: \`/add book - kitob\`

📬 *2. Eslatmalar (Reminders)*  
Qo‘shgan so‘zlaringiz sizga vaqti-vaqti bilan bot orqali yuboriladi — bu takrorlash orqali mustahkamlashga yordam beradi.

🧠 *3. Vocabulary testlar*  
Bot sizga inglizcha so‘zlarni tanlash yoki tarjimasini topish shaklida testlar yuboradi. Bu orqali o‘z bilimingizni sinab ko‘rishingiz mumkin.

🔑 *4. /login — Shaxsiy kabinet ma’lumotlari*  
Bu buyruq orqali siz login va parolingizni olasiz. Ushbu ma’lumotlar bilan siz [web dashboard](https://tilorgan.alwaysdata.net) ga kirishingiz mumkin.

📊 *5. Statistika paneli*  
Web panel orqali siz testlar natijasi, o‘zlashtirish darajasi, faol so‘zlar ro‘yxati kabi ko‘plab statistikalarni ko‘rishingiz mumkin.

🛠 *6. Parolni o‘zgartirish*  
Dashboard ichida login va parolni o‘zingiz mustaqil o‘zgartirishingiz mumkin.

🚀 *7. Yangilanishlar*  
Har safar yangi funksiyalar qo‘shilganda, bot orqali broadcast tarzida sizga bildiriladi.

---

❓ *Yordam kerakmi?*  
Istalgan vaqtda /help buyrug‘ini yozing. Biz siz bilan birga ingliz tilini mustahkam o‘rganamiz! 😊

🔗 Web: https://tilorgan.alwaysdata.net  
`, { parse_mode: "Markdown" });
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
