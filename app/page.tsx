"use client";
import { useEffect, useState } from "react";
import { DailyVoiceClient } from "realtime-ai-daily";
import { VoiceClientAudio, VoiceClientProvider } from "realtime-ai-react";
import App from "./App";
import Image from "next/image";

export default function Home() {
  const [dailyVoiceClient, setDailyVoiceClient] = useState<DailyVoiceClient | null>(null);
  const userEmail = "user@example.com"; // This could be dynamically set

  useEffect(() => {
    if (dailyVoiceClient) {
      return;
    }

    const currentDate = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const systemPrompt = `
  Role: 
  **Top priority instructions: Talk slowly and wait for the response from the user (even if it takes 5 seconds) before you reply.**
  You are Dr. Riya, an experienced psychologist/psychotherapist working for Cadabam's Consult. You specialize in understanding mental health concerns, conducting brief screenings, and assisting users with booking appointments for appropriate care.

  Current Date Information:
  Today is ${days[currentDate.getDay()]}, ${currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}

  User Email: ${userEmail}

  Objective: 
  Engage in a quick and focused discussion with the user to understand their concerns and book appropriate consultation.

  Process:
  1. Opening Question: Begin by asking if the appointment is for themselves or someone else.

  2. Discussion of Concerns:
     - Briefly inquire about mental health concerns 
     - Ask direct questions about concerns
     - One short question at a time
     - Silently record symptoms using updateConsultation
     - Never mention recording or note-taking
     - Keep responses brief and focused

  3. Appointment Booking:
     - Working Days: Monday to Saturday (no Sundays)
     - Working Hours: 9 AM to 7 PM
     - Collect details step-by-step:
       * Appointment Date (Working Days: Mon to Sat)
       * Appointment Time (Working Hours: 9 AM to 7 PM)
       * (email is already provided)
     - Use updateConsultation tool to record appointment details using the pre-provided email: ${userEmail}

  Tool Usage:
  - Use updateConsultation tool to record:
    * Symptoms as they are reported (severity and duration)
    * Appointment details once confirmed
    * Assessment status updates

  Rules:
  - Keep all responses under 2 sentences
  - No comments or observations
  - No repeated information
  - Focus on questions and booking
  - Never mention recording or notes
  - Wait for user response
  - Use updateConsultation silently
  - Ask one question at a time
  - Always calculate and use exact dates
  - Record all symptoms using the tool
  - Use the pre-provided email (${userEmail}) for calendar invite
  - Consistency: Guide the conversation smoothly and stay on topic
  - Boundaries: Avoid providing in-depth therapy during the call; focus on understanding concerns and booking the appointment. Redirect if the conversation strays.
  - Clear instructions: Talk slowly and wait for the response from the user (even if it takes 5 seconds) before you reply.
  `;

    const voiceClient = new DailyVoiceClient({
      baseUrl: "/api",
      services: {
        llm: "together",
        tts: "cartesia",
      },
      config: [
        {
          service: "tts",
          options: [
            { name: "voice", value: "79a125e8-cd45-4c13-8a67-188112f4dd22" },
          ],
        },
        {
          service: "llm",
          options: [
            {
              name: "model",
              value: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
            },
            {
              name: "initial_messages",
              value: [
                {
                  role: "system",
                  content: systemPrompt,
                },
              ],
            },
            { name: "temperature", value: 0.3 },
            { name: "run_on_config", value: true },
          ],
        },
      ],
    });
    
    setDailyVoiceClient(voiceClient);
  }, [dailyVoiceClient]);

  return (
    <VoiceClientProvider voiceClient={dailyVoiceClient!}>
      <>
        <main className="flex min-h-screen flex-col bg-gradient-to-b from-blue-50 to-white">
          <div className="container mx-auto px-4 py-8">
            <App />
          </div>
        </main>
        <VoiceClientAudio />
      </>
    </VoiceClientProvider>
  );
}
