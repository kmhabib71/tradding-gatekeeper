import OpenAI from "openai";

export async function analyzeWithOpenAI(
  apiKey: string,
  systemPrompt: string,
  imageBase64: string,
): Promise<Record<string, unknown>> {
  const openai = new OpenAI({ apiKey });

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 2000,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this MetaTrader multi-timeframe screenshot and provide your assessment in the exact JSON format specified.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${imageBase64}`,
              detail: "high",
            },
          },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content || "{}";
  // Strip markdown code blocks if present
  const cleaned = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  return JSON.parse(cleaned);
}
