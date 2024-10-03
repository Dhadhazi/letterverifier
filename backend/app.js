import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
app.use(cors());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json());

app.post("/process-letter", async (req, res) => {
  try {
    const { userId, text } = req.body;

    if (!userId || !text) {
      return res.status(400).json({ error: "Missing userId or text" });
    }

    const cleanText = text.replace(/[^a-zA-Z0-9\s.,!?]/g, "");
    const wordCount = cleanText.split(/\s+/).length;
    const textWithWordCount = `${cleanText} ${wordCount}`;

    // Fixed wrapper for OpenAI requests
    const systemMessage = `You are a teacher helping freelancers improve their expression of interest (EoI) letters. Provide concise feedback for each specified section and an updated letter. Use simple language. Explain issues briefly. Include one encouraging note per section. Do not use formatting. Do not repeat section names. Sections:
Professional tone
Client needs and proposed solution
Understanding of the business impact
After feedback, provide the updated letter without any introductory text. Adhere to requirements. Do not hallucinate or add content not present in the original letter. You can add notes to the letter if something is unclear but should be in it, but put it in <>. Maximum 300 words for the EoI. Put %%% after each section. Separate each section and the letter with %%%. Use HTML formatting in your response.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Update this to the correct model name
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: textWithWordCount },
      ],
    });

    const aiResponse = response.choices[0].message.content;

    res.json({ response: aiResponse });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
