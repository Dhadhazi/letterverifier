import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs/promises";
import path from "path";

dotenv.config();

const {
  PORT = 3000,
  API_KEY = "3b53cb7a-cf27-4fd3-80c3-6ec7dd5c8275",
  OPENAI_API_KEY,
  GPT_MODEL = "gpt-4o-mini",
  DAILY_LIMIT = 5,
} = process.env;

const LIMIT_REACHED_MESSAGE =
  "Wow! You've sent us lots of letters to check today, great job! You can send more letters tomorrow when your daily limit starts over. We're looking forward to helping you again then!";

const SYSTEM_MESSAGE = `You are a teacher helping freelancers enhance their Expression of Interest (EoI) letters. For each of the following sections, provide concise feedback using simple language. Briefly explain any issues and include one encouraging note per section. Do not repeat the section names. The sections are:

Professional Tone
Client Needs and Proposed Solution
Understanding of the Business Impact
After providing feedback, present the updated EoI letter without any introductory text. If certain necessary information is unclear or missing, indicate this within angle brackets <> in the letter. The EoI should be a maximum of 300 words.

Output your response in the following JSON format:
{
  "feedback": {
    "professional_tone": "Your feedback here.",
    "client_needs_and_proposed_solution": "Your feedback here.",
    "understanding_of_business_impact": "Your feedback here."
  },
  "updated_letter": "Your updated letter here."
}
In the updated letter, bold any changes made compared to the original letter by wrapping them with HTML <strong> tags.`;

const app = express();
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

const validateRequest = (userId, text, apiKey) => {
  if (apiKey !== API_KEY) {
    throw new Error("Invalid API key");
  }
  if (!userId || !text) {
    throw new Error("Missing userId or text");
  }
};

const getLogDirectory = (userId) => {
  const today = new Date();
  const dateString = today.toISOString().split("T")[0].replace(/-/g, "");
  return path.join("logs", userId, dateString);
};

const checkDailyLimit = async (logDir) => {
  await fs.mkdir(logDir, { recursive: true });
  const files = await fs.readdir(logDir);
  const remainingRequests = DAILY_LIMIT - files.length;

  if (files.length >= DAILY_LIMIT) {
    throw new Error(LIMIT_REACHED_MESSAGE);
  }

  return remainingRequests;
};

const cleanText = (text) => text.replace(/[^a-zA-Z0-9\s.,!?]/g, "");

const getAIResponse = async (text) => {
  const response = await openai.chat.completions.create({
    model: GPT_MODEL,
    messages: [
      { role: "system", content: SYSTEM_MESSAGE },
      { role: "user", content: text },
    ],
  });
  return response.choices[0].message.content;
};

const logRequest = async (logDir, userId, text, aiResponse) => {
  const files = await fs.readdir(logDir);
  const fileNumber = files.length + 1;
  const logData = {
    userId,
    userText: text,
    openAiText: aiResponse,
    timestamp: new Date().toISOString(),
  };
  const logFilePath = path.join(logDir, `${fileNumber}.json`);
  await fs.writeFile(logFilePath, JSON.stringify(logData, null, 2));
};

app.post("/api/process-letter", async (req, res) => {
  try {
    const { userId, text, apiKey } = req.body;
    validateRequest(userId, text, apiKey);

    const logDir = getLogDirectory(userId);
    const remainingRequests = await checkDailyLimit(logDir);
    const cleanedText = cleanText(text);
    const aiResponse = await getAIResponse(cleanedText);
    await logRequest(logDir, userId, text, aiResponse);

    res.json({
      response: aiResponse,
      requests: remainingRequests - 1,
    });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(error.message === "Invalid API key" ? 500 : 400)
      .json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
