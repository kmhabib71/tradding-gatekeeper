import Anthropic from "@anthropic-ai/sdk";

export async function analyzeWithClaude(
  apiKey: string,
  systemPrompt: string,
  imageBase64: string
): Promise<Record<string, unknown>> {
  const anthropic = new Anthropic({ apiKey });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this MetaTrader multi-timeframe screenshot and provide your assessment in the exact JSON format specified.",
          },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: imageBase64,
            },
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const content = textBlock && "text" in textBlock ? textBlock.text : "{}";
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}
