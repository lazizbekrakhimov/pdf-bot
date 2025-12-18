import { Telegraf, Markup } from "telegraf";
import puppeteer from "puppeteer";
import fs from "fs";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Document, Packer, Paragraph, TextRun } from "docx";
import PPTXGenJS from "pptxgenjs";

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bot = new Telegraf(process.env.BOT_TOKEN);

if (!fs.existsSync("./src/temp")) {
  fs.mkdirSync("./src/temp");
}

const userTexts = new Map();

bot.start(async ctx => {
  ctx.reply(
    `👋 Assalomu alaykum, ${ctx.from.first_name || 'hurmatli mijoz'}!\n\n` +
    `Men siz yuborgan matnni PDF, Word yoki PowerPoint faylga aylantira olaman.\n\n` +
    `Matningizni yuboring va fayl turini tanlang. 📂`
  );
});

bot.command("about", async ctx => {
  ctx.reply(
    "🤖 PDFWordGeneratorBot\n\n" +
    "Matningizni tez va oson PDF, Word yoki PowerPoint faylga aylantiradi. ✨\n\n" +
    "👤 Yaratuvchi: @otabekovich25"
  );
});

bot.help(async ctx => {
  ctx.reply(
    "ℹ️ Botdan foydalanish:\n\n" +
    "1️⃣ /start - Botni ishga tushuring.\n" +
    "2️⃣ Matnni yuboring.\n" +
    "3️⃣ Fayl turini tanlang: PDF 📄, Word 📝, PowerPoint 📊.\n" +
    "4️⃣ Bot siz uchun faylni tayyorlaydi. Agar xatolik yuz bersa, matnni qayta tekshirib yuboring."
  );
});

bot.telegram.setMyCommands([
  {
    command: '/start',
    description: "Botni ishga tushirish"
  },
  {
    command: '/help',
    description: "Foydalanish bo‘yicha qo‘llanma"
  },
  {
    command: '/about',
    description: "Bot haqida ma’lumot"
  },
]);

bot.on("text", async ctx => {
  const text = ctx.message.text;
  const userId = ctx.from.id;

  if (!text || !text.trim()) {
    return ctx.reply("❌ Matn bo‘sh bo‘lishi mumkin emas, iltimos matn yuboring.");
  }

  userTexts.set(userId, text);

  await ctx.reply(
    "✅ Matningiz qabul qilindi, fayl turini tanlang:",
    Markup.inlineKeyboard([
      [Markup.button.callback("PDF", "pdf")],
      [Markup.button.callback("Word", "word")],
      [Markup.button.callback("PowerPoint", "pptx")]
    ])
  );
});

bot.on("callback_query", async ctx => {
  const format = ctx.callbackQuery.data;
  const userId = ctx.from.id;
  const text = userTexts.get(userId);

  if (!text) {
    await ctx.reply("❌ Matn topilmadi, iltimos avval matn yuboring.");
    return ctx.answerCbQuery();
  }

  let formatName = format === "pdf" ? "PDF" : format === "word" ? "Word" : "PowerPoint";
  const loadingMessage = await ctx.reply(`⏳ ${formatName} fayl yuklanmoqda, iltimos sabr qiling...`);

  const date = new Date();
  const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}-${date.getMinutes().toString().padStart(2, '0')}`;

  let descriptiveType = 'document';
  let extension = 'txt';

  if (format === 'pdf') {
    descriptiveType = 'pdf';
    extension = 'pdf';
  } else if (format === 'word') {
    descriptiveType = 'document';
    extension = 'docx';
  } else if (format === 'pptx') {
    descriptiveType = 'presentation';
    extension = 'pptx';
  }

  const fileName = `${descriptiveType}_${formattedDate}.${extension}`;
  const filePath = path.join(__dirname, 'temp', fileName);

  try {
    if (format === "pdf") {
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      await page.setContent(`
        <html>
          <body style="
            font-family: Arial, sans-serif;
            font-size: 14pt;
            line-height: 1.5;
            padding: 40px 50px;
            white-space: pre-wrap;
            word-wrap: break-word;
            color: #111;
          ">
            ${text}
          </body>
        </html>
      `);
      await page.pdf({ path: filePath, format: "A4" });
      await browser.close();

    } else if (format === "word") {
      const paragraphs = text.split("\n").map(line =>
        new Paragraph({ children: [new TextRun({ text: line, font: "Arial", size: 24 })] })
      );
      const doc = new Document({ sections: [{ children: paragraphs }] });
      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(filePath, buffer);

    } else if (format === "pptx") {
      const pptx = new PPTXGenJS();
      const slide = pptx.addSlide();
      slide.addText(text, { x: 1, y: 1, w: 8, h: 5, fontSize: 18, wrap: true });
      await pptx.writeFile({ fileName: filePath });
    }

    await ctx.replyWithDocument({ source: filePath });
    await ctx.deleteMessage(loadingMessage.message_id);

    fs.unlinkSync(filePath);

  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Fayl yaratishda xatolik yuz berdi.");
  }

  ctx.answerCbQuery();
});

bot.launch();
console.log("Bot running on port 2000");