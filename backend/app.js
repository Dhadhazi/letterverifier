import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";
import path from "path";

dotenv.config();

const API_KEY = "3b53cb7a-cf27-4fd3-80c3-6ec7dd5c8275";
const DAILY_LIMIT = 5;
const LIMIT_REACHED_MESSAGE =
  "Wow! You've sent us lots of letters to check today, great job! You can send more letters tomorrow when your daily limit starts over. We're looking forward to helping you again then!";

const SYSTEM_MESSAGE = `You are a teacher helping freelancers improve their expression of interest (EoI) letters. Provide concise feedback for each specified section and an updated letter. Use simple language. Explain issues briefly. Include one encouraging note per section. Do not use formatting. Do not repeat section names. Sections:
Professional tone
Client needs and proposed solution
Understanding of the business impact
After feedback, provide the updated letter without any introductory text. Adhere to requirements. Do not hallucinate or add content not present in the original letter. You can add notes to the letter if something is unclear but should be in it, but put it in <>. Maximum 300 words for the EoI. Put %%% after each section. Separate each section and the letter with %%%. Use HTML formatting in your response.`;
const GPT_MODEL = "gpt-4o-mini";

const app = express();
const port = process.env.PORT || 3000;
app.use(cors());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json());

app.post("/process-letter", async (req, res) => {
  try {
    const { userId, text, apiKey } = req.body;

    if (apiKey !== API_KEY) {
      return res.status(500).json({ error: "Invalid API key" });
    }

    if (!userId || !text) {
      return res.status(400).json({ error: "Missing userId or text" });
    }

    const today = new Date();
    const dateString = `${today.getDate().toString().padStart(2, "0")}-${(
      today.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}-${today.getFullYear()}`;
    const logDir = path.join("logs", userId, dateString);

    fs.mkdirSync(logDir, { recursive: true });

    const files = fs.readdirSync(logDir);
    const remainingRequests = DAILY_LIMIT - files.length;

    if (files.length >= DAILY_LIMIT) {
      return res.status(200).json({
        message: LIMIT_REACHED_MESSAGE,
        requests: remainingRequests,
      });
    }

    const cleanText = text.replace(/[^a-zA-Z0-9\s.,!?]/g, "");
    const textWithWordCount = `${cleanText}`;

    const response = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_MESSAGE },
        { role: "user", content: textWithWordCount },
      ],
    });

    const aiResponse = response.choices[0].message.content;

    const updatedFiles = fs.readdirSync(logDir);
    const fileNumber = updatedFiles.length + 1;

    const logData = {
      userId: userId,
      userText: text,
      openAiText: aiResponse,
      timestamp: today.toISOString(),
    };

    const logFilePath = path.join(logDir, `${fileNumber}.json`);

    fs.writeFile(logFilePath, JSON.stringify(logData, null, 2), (err) => {
      if (err) {
        console.error("Error writing log file:", err);
      }
    });

    res.json({
      response: aiResponse,
      requests: remainingRequests - 1,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
