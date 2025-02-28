"use client";

import { useEffect, useState } from "react";
import { DailyVoiceClient } from "realtime-ai-daily";
import { VoiceClientAudio, VoiceClientProvider } from "realtime-ai-react";
import App from "./App";
import { LLMHelper } from "realtime-ai";

export default function Home() {
  const [voiceClient, setVoiceClient] = useState<DailyVoiceClient | null>(null);

  useEffect(() => {
    if (voiceClient) {
      return;
    }

    // Gemini API key
    const GEMINI_API_KEY = "AIzaSyD0H3DOuV_SeKMUnxOAY85e9l2c_OCk6o4";

    const client = new DailyVoiceClient({
      baseUrl: "/api",
      services: {
        stt: "deepgram",
        tts: "cartesia",
        llm: "gemini",
      },
      config: [
        {
          service: "vad",
          options: [
            {
              name: "params",
              value: {
                stop_secs: 0.6
              }
            }
          ]
        },
        {
          service: "tts",
          options: [
            {
              name: "voice",
              value: "79a125e8-cd45-4c13-8a67-188112f4dd22"
            },
            {
              name: "language",
              value: "en"
            },
            {
              name: "text_filter",
              value: {
                filter_code: false,
                filter_tables: false
              }
            },
            {
              name: "model",
              value: "sonic-english"
            },
            {
              name: "emotion",
              value: [
                "positivity:low"
              ]
            }
          ]
        },
        {
          service: "llm",
          options: [
            {
              name: "model",
              value: "models/gemini-2.0-flash-exp"
            },
            {
              name: "api_key",
              value: GEMINI_API_KEY
            },
            {
              name: "initial_messages",
              value: [
                {
                  role: "system",
                  content: `# Role: You are Dr. Riya, an exceptional physiotherapist working for Physiotattva You possess in-depth knowledge and skills in physiotherapy.
# Rule: Strictly only ask one question at a time

Stage 1: Initial Greeting & Routing (Dr. Riya)
System Prompt:
"Hi, this is Dr. Riya from Physiotattva. How can I assist you today?"

Routing Logic:

If user mentions booking an appointment, move to Stage 3 (Appointment Booking).
If user describes symptoms, move to Stage 2 (Symptom Checker).
If user asks about existing appointments, move to Stage 4 (Appointment Lookup).
If user asks about services, provide information from the Physiotattva website.

Stage 2: Symptom Checker Bot
System Prompt:
"I understand you have some discomfort. Can you describe where you feel the pain?"

Follow-up Questions (if needed): (Strictly only ask one question at a time)

"How long have you had this pain?"
"On a scale of 1 to 10, how severe is it?"
"Is the pain constant or does it come and go?"
"Does it worsen with movement?"

Decision:

If symptoms match a physiotherapy condition, recommend a consultation and move to Stage 3 (Appointment Booking).

Stage 3: Appointment Booking
System Prompt:
"Would you like an in-person or online consultation?"

Case 1: In-Person Appointment

"We have centers in Bangalore and Hyderabad. Which city do you prefer?"
"Please choose a center from the available locations (from the list of our centers in bangalore or hyderabad."
"What day of this or next week would you like? (Available Mon to Sat)"
"Here are the available time slots. Which one works for you? (Available 8AM to 8PM) "
"The consultation fee is 499 $. Proceeding with booking?"
"Your appointment is confirmed. You'll receive details shortly. Anything else I can help with?"

Case 2: Online Appointment

"What date would you like?"
"What day of this or next week would you like? (Available Mon to Sat)"
"Here are the available time slots. Which one works for you? (Available 8AM to 8PM) "
"The consultation fee is 99 $. Proceeding with booking?"

"Your appointment is confirmed. You'll receive details shortly. Anything else I can help with?"

Stage 4: Appointment Lookup
System Prompt:
"Let me check your upcoming appointments."

API Fetch & Response:

"You have an appointment on [Date] at [Time] for a [Online/In-Person] consultation."`
                }
              ]
            },
            {
              name: "run_on_config",
              value: true
            }
          ]
        }
      ],
    });

    setVoiceClient(client);
  }, [voiceClient]);

  return (
    <VoiceClientProvider voiceClient={voiceClient!}>
      <>
        <main className="flex min-h-screen flex-col bg-gradient-to-b from-blue-50 to-white">
          <div className="container mx-auto px-4 py-8">
            {voiceClient ? <App /> : (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            )}
          </div>
        </main>
        <VoiceClientAudio />
      </>
    </VoiceClientProvider>
  );
}
