import OpenAI from "openai";
import fs from "node:fs/promises";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources";

async function main() {
  const [, , flag, prompt] = process.argv;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseURL =
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  if (flag !== "-p" || !prompt) {
    throw new Error("error: -p flag is required");
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
  });

  const messages: ChatCompletionMessageParam[] = [
    { role: "user", content: prompt },
  ];

  const tools: ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "Read",
        description: "Read and return the contents of a file",
        parameters: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "The path to the file to read",
            },
          },
          required: ["file_path"],
        },
      },
    },
  ];

  // let loopCount = 0;
  // Agent loop to execute tool calls
  do {
    // console.debug(`agent loop iteration #${(loopCount += 1)}`);
    // console.debug("messages:", messages);
    const response = await client.chat.completions.create({
      model: "anthropic/claude-haiku-4.5",
      messages: messages,
      tools: tools,
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error("no choices in response");
    }

    // Add model response to messages
    const responseMessage = response.choices[0].message;
    messages.push(responseMessage);

    const toolCalls = responseMessage.tool_calls;
    // console.debug("tool_calls:", toolCalls);
    // If no more tool calls, return final message
    if (!toolCalls) {
      console.log(responseMessage.content);
      break;
    } else {
      for (const toolCall of toolCalls) {
        if (toolCall.type === "function" && toolCall.function.name === "Read") {
          const filePath = JSON.parse(toolCall.function.arguments).file_path;
          const data = await fs.readFile(filePath, "utf-8");
          // Add toll call result to messages
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: data,
          });
        }
      }
    }
  } while (true);
}

main();
