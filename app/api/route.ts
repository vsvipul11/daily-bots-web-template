// app/api/route.ts
import { NextRequest } from "next/server";

// [POST] /api
export async function POST(request: Request) {
  const { services, config } = await request.json();
  
  if (!services || !config || !process.env.DAILY_BOTS_KEY) {
    return Response.json(`Services or config not found on request body`, {
      status: 400,
    });
  }
  
  const payload = {
    bot_profile: "voice_2024_08",
    max_duration: 600,
    services,
    api_keys: {
      // Add the Gemini API key specifically for the Gemini service
      gemini: "AIzaSyD0H3DOuV_SeKMUnxOAY85e9l2c_OCk6o4",
      // Any other API keys would go here
    },
    config,
  };
  
  const req = await fetch("https://api.daily.co/v1/bots/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DAILY_BOTS_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  
  const res = await req.json();
  
  if (req.status !== 200) {
    return Response.json(res, { status: req.status });
  }
  
  return Response.json(res);
}

// [GET] /api
export async function GET(request: NextRequest) {
  // Handle any GET requests if needed
  return Response.json({ message: "API endpoint for Dr. Riya physiotherapy bot" });
}

export const dynamic = "force-dynamic";
