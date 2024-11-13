import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import cors from "cors";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

dotenv.config();

const {
  PORT = 3000,
  API_KEY = "3b53cb7a-cf27-4fd3-80c3-6ec7dd5c8275",
  OPENAI_API_KEY,
  GPT_MODEL = "gpt-4o-mini",
  DAILY_LIMIT = 5,
  AWS_REGION = "eu-north-1",
} = process.env;

const TABLE_NAME = "letter_verifier";

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
Mark changes in the new letter using <strong> tags around modified text.`;

const app = express();
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const client = new DynamoDBClient({ region: AWS_REGION });
const dynamo = DynamoDBDocumentClient.from(client);

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

const getCurrentDateKey = () => {
  return new Date().toISOString().split("T")[0];
};

const checkDailyLimit = async (userId) => {
  const dateKey = getCurrentDateKey();

  const params = {
    TableName: TABLE_NAME,
    Key: {
      userId: userId,
      date: dateKey,
    },
    ProjectionExpression: "messageCount",
  };

  const result = await dynamo.send(new GetCommand(params));
  return result.Item?.messageCount || 0;
};

const updateUserRecord = async (userId, text, aiResponse) => {
  const dateKey = getCurrentDateKey();
  const timestamp = new Date().toISOString();

  const params = {
    TableName: TABLE_NAME,
    Key: {
      userId: userId,
      date: dateKey,
    },
    UpdateExpression: `
      SET messageCount = if_not_exists(messageCount, :zero) + :inc,
      messages = list_append(if_not_exists(messages, :empty_list), :new_message)
    `,
    ExpressionAttributeValues: {
      ":zero": 0,
      ":inc": 1,
      ":empty_list": [],
      ":new_message": [
        {
          timestamp,
          userText: text,
          aiResponse,
        },
      ],
      ":limit": DAILY_LIMIT,
    },
    ConditionExpression:
      "attribute_not_exists(messageCount) OR messageCount < :limit",
    ReturnValues: "UPDATED_NEW",
  };

  try {
    const result = await dynamo.send(new UpdateCommand(params));
    return result.Attributes.messageCount;
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      throw new Error(LIMIT_REACHED_MESSAGE);
    }
    throw error;
  }
};

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

app.post("/api/process-letter", async (req, res) => {
  try {
    const { userId, text, apiKey } = req.body;
    validateRequest(userId, text, apiKey);

    const currentCount = await checkDailyLimit(userId);

    if (currentCount >= DAILY_LIMIT) {
      return res.status(400).json({
        error: LIMIT_REACHED_MESSAGE,
        requests: 0,
      });
    }

    const cleanedText = text.replace(/[^a-zA-Z0-9\s.,!?]/g, "");
    const aiResponse = await getAIResponse(cleanedText);
    const newCount = await updateUserRecord(userId, text, aiResponse);

    res.json({
      response: aiResponse,
      requests: DAILY_LIMIT - newCount,
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
