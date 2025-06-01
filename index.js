const { Telegraf } = require("telegraf");
const pool = require("./pg");
require("dotenv").config();

const bot = new Telegraf(process.env.BOT_TOKEN);

const awaitingAdd = new Map();

bot.start(async (ctx) => {
  const userId = ctx.from.id;

  try {
    const user = await pool.query("SELECT * FROM users WHERE telegram_id = $1", [userId]);

    if (user.rows.length === 0) {
      // Default schedule 30 daqiqa (30*60 sekund)
      await pool.query("INSERT INTO users (telegram_id, remembering_words, schedule) VALUES ($1, $2, $3)", [
        userId,
        [],
        30,
      ]);
    }

    await ctx.reply("✅ Xush kelibsiz! So‘z qo‘shish uchun /add ni bosing.");
  } catch (err) {
    console.error("START ERROR:", err);
    await ctx.reply("❌ Xatolik yuz berdi.");
  }
});

bot.command("add", async (ctx) => {
  awaitingAdd.set(ctx.from.id, true);
  await ctx.reply("So‘zni kiriting (masalan: apple - olma):");
});

bot.on("text", async (ctx) => {
  const userId = ctx.from.id;

  if (!awaitingAdd.get(userId)) return;

  const [word, translation] = ctx.message.text.split(" - ").map((s) => s.trim());
  if (!word || !translation) {
    return ctx.reply("❗ Format noto‘g‘ri. Masalan: apple - olma");
  }

  try {
    await pool.query(
      "UPDATE users SET remembering_words = array_append(remembering_words, $1) WHERE telegram_id = $2",
      [`${word} - ${translation}`, userId]
    );
    ctx.reply(`✅ Qo‘shildi: ${word} - ${translation}`);
  } catch (err) {
    console.error("ADD ERROR:", err);
    ctx.reply("❌ Xatolik yuz berdi.");
  }

  awaitingAdd.delete(userId);
});

// Random boshlovchi xabarlar
const messageStarts = [
  "🧠 Eslay olasizmi?",
  "📚 Bugungi kichik test!",
  "🔁 Keling, yodlaymiz!",
  "🌀 Bugungi so‘zlar:",
  "🧐 Yodda qoldimi?",
  "📝 Mashq vaqti!",
  "💡 Esingizda bormi?",
  "📖 Bugungi dars:",
  "😎 Keling, tekshirib ko‘ramiz:",
];

function getRandomStart() {
  return messageStarts[Math.floor(Math.random() * messageStarts.length)];
}

function getRandomWords(words) {
  const shuffled = [...words].sort(() => 0.5 - Math.random());
  const count = Math.floor(Math.random() * 4) + 1; // 1–4 ta so‘z
  return shuffled.slice(0, Math.min(count, words.length));
}

// Bu yerda 30 daqiqadan 300 daqiqagacha random (5 soat = 300 daqiqa)
function getNextScheduleMinutes() {
  const minMinutes = 30;   // 30 daqiqa
  const maxMinutes = 300;  // 5 soat (300 daqiqa)
  return Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
}

async function sendWordsToAllUsers() {
  try {
    const now = Date.now();

    const result = await pool.query("SELECT telegram_id, remembering_words, schedule, next_send FROM users");

    for (const user of result.rows) {
      const { telegram_id, remembering_words, schedule, next_send } = user;

      if (!remembering_words || remembering_words.length === 0) continue;

      // next_send da millisekundlarda saqlangan
      if (!next_send || now >= parseInt(next_send)) {
        const selectedWords = getRandomWords(remembering_words);
        const intro = getRandomStart();

        const message =
          `${intro}\n\n` +
          selectedWords.map((w, i) => `${i + 1}. ${w}`).join("\n");

        try {
          await bot.telegram.sendMessage(telegram_id, message, { parse_mode: "HTML" });
        } catch (err) {
          console.error(`Xabar yuborilmadi (${telegram_id}):`, err.message);
        }

        // Yangi next_send vaqtini update qilamiz (daqiqa -> millisekund)
        const nextSendTime = now + getNextScheduleMinutes() * 60 * 1000;

        await pool.query("UPDATE users SET next_send = $1 WHERE telegram_id = $2", [
          nextSendTime,
          telegram_id,
        ]);
      }
    }
  } catch (err) {
    console.error("SEND WORD ERROR:", err.message);
  }

  // Yana tekshiruvni 5 sekunddan keyin ishga tushiramiz
  setTimeout(sendWordsToAllUsers, 5000);
}

bot.launch().then(() => {
  console.log("🤖 Bot ishlayapti");
  sendWordsToAllUsers();
});
