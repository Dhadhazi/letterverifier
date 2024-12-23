import OpenAI from "openai";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const {
  OPENAI_API_KEY,
  GPT_MODEL = "gpt-4o-mini",
  DAILY_LIMIT = 5,
  MAX_WORDS = 350,
} = process.env;

const approvedUserIDs = [
  "user123",
  "freelancer456",
  "writer789",
  "editor101",
  "client202"
];

const TABLE_NAME = "letter_verifier";
const TIMEOUT_MESSAGE = "The server is busy. Please try again later.";
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

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const validateRequest = (userId, text) => {
  if (!userId || !text) {
    throw new Error("Missing userId or text");
  }

  if (!approvedUserIDs.includes(userId)) {
    throw new Error("Invalid user");
  }

  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount > MAX_WORDS) {
    throw new Error(
      `Your letter exceeds the ${MAX_WORDS} word limit. Please shorten it and try again.`
    );
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
    },
    ReturnValues: "UPDATED_NEW",
  };

  try {
    const result = await dynamo.send(new UpdateCommand(params));
    return result.Attributes.messageCount;
  } catch (error) {
    console.error("Error updating user record:", error);
    throw error;
  }
};

const getAIResponse = async (text) => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(TIMEOUT_MESSAGE)), 15000)
  );

  const aiPromise = openai.chat.completions.create({
    model: GPT_MODEL,
    messages: [
      { role: "system", content: SYSTEM_MESSAGE },
      { role: "user", content: text },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  try {
    const response = await Promise.race([aiPromise, timeoutPromise]);
    if (!response || !response.choices || !response.choices[0]) {
      console.error("Unexpected OpenAI response structure:", response);
      throw new Error("Invalid response from OpenAI");
    }
    return response.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI API Error:", error);
    if (error.message === TIMEOUT_MESSAGE) {
      throw error;
    }
    if (error.response) {
      console.error("OpenAI Error Response:", error.response.data);
    }
    throw new Error(error.message || "Error getting AI response");
  }
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization",
  "Access-Control-Allow-Methods": "OPTIONS,POST",
  "Content-Type": "application/json",
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { userId, text } = body;

    validateRequest(userId, text);

    const currentCount = await checkDailyLimit(userId);

    if (currentCount >= parseInt(DAILY_LIMIT)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: LIMIT_REACHED_MESSAGE,
          requests: 0,
        }),
      };
    }

    const cleanedText = text.replace(/[^a-zA-Z0-9\s.,!?]/g, "");
    const aiResponse = await getAIResponse(cleanedText);
    const newCount = await updateUserRecord(userId, text, aiResponse);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        response: aiResponse,
        requests: parseInt(DAILY_LIMIT) - newCount,
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
};