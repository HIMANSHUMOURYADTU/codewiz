import { generateChatResponse } from "@/configs/AiModel";
import { NextResponse } from "next/server";

export async function POST(req) {
    const { prompt } = await req.json();
    try {
        const respo = await generateChatResponse(prompt);
        return NextResponse.json({ result: respo });
    } catch (error) {
        console.error("Error generating AI response:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to generate response" },
            { status: 500 }
        );
    }
}