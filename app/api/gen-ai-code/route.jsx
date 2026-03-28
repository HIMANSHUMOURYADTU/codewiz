import { generateCodeResponse } from "@/configs/AiModel";
import { NextResponse } from "next/server";

export async function POST(req) {
    const { prompt } = await req.json();
    try {
        const payload = await generateCodeResponse(prompt);
        return NextResponse.json(payload);
    } catch (error) {
        console.error("Error generating AI code:", error);
        const status = error?.message === "Model returned invalid JSON" ? 502 : 500;
        return NextResponse.json(
            { error: error?.message || "Failed to generate code", raw: error?.raw },
            { status }
        );
    }
}