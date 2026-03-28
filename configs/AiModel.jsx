import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

const codeSystemPrompt =
  "Return ONLY a JSON object with keys: projectTitle, explanation, files, generatedFiles. Each files entry is an object with a string field code. Do not wrap in markdown. Escape newlines as \\n inside code strings. The UI must be production-ready, visually rich, and include multiple sections (hero, features, CTA, footer).";

const extractJson = (text) => {
  if (!text) {
    return [];
  }

  const trimmed = text.trim();
  const candidates = [trimmed];

  const fenceJsonMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (fenceJsonMatch?.[1]) {
    candidates.unshift(fenceJsonMatch[1].trim());
  }

  const fenceMatch = trimmed.match(/```\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) {
    candidates.push(fenceMatch[1].trim());
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1).trim());
  }

  return candidates.filter(Boolean);
};

const escapeNewlinesInStrings = (text) => {
  let result = "";
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (isEscaped) {
      result += char;
      isEscaped = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      isEscaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString && (char === "\n" || char === "\r")) {
      result += char === "\n" ? "\\n" : "\\r";
      continue;
    }

    result += char;
  }

  return result;
};

const parseJsonLoose = (text) => {
  const candidates = extractJson(text);
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      // try next candidate
    }

    try {
      const cleaned = escapeNewlinesInStrings(candidate)
        .replace(/\uFEFF/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/,\s*(\}|\])/g, "$1");
      return JSON.parse(cleaned);
    } catch (error) {
      // try next candidate
    }
  }

  const parseError = new Error("Model returned invalid JSON");
  parseError.raw = text;
  throw parseError;
};

export const generateChatResponse = async (prompt) => {
  const completion = await groq.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 4096,
  });

  return completion.choices?.[0]?.message?.content || "";
};

export const generateCodeResponse = async (prompt) => {
  const completion = await groq.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: codeSystemPrompt },
      {
        role: "user",
        content: `${prompt}\n\nReturn ONLY valid JSON. Do not include markdown or code fences.`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.6,
    max_tokens: 8000,
  });

  const raw = completion.choices?.[0]?.message?.content || "";
  const parsed = parseJsonLoose(raw);

  if (parsed?.files && typeof parsed.files === "object") {
    Object.entries(parsed.files).forEach(([key, value]) => {
      if (value && typeof value.code !== "string") {
        parsed.files[key].code = JSON.stringify(value.code, null, 2);
      }
    });
  }

  return parsed;
};
