// File: app/page.tsx
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
            {dailyVoiceClient ? <App /> : (
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

// File: app/App.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { TransportState, VoiceError, VoiceEvent } from "realtime-ai";
import { useVoiceClient, useVoiceClientEvent } from "realtime-ai-react";
import Image from "next/image";
import { Mic, MicOff, Loader2 } from "lucide-react";

const App: React.FC = () => {
  const voiceClient = useVoiceClient();
  const [error, setError] = useState<string | null>(null);
  const [userTranscript, setUserTranscript] = useState<string[]>([]);
  const [botTranscript, setBotTranscript] = useState<string[]>([]);
  const [state, setState] = useState<TransportState>("idle");
  const [isActive, setIsActive] = useState(false);

  // Track conversation messages with unique IDs
  const [messages, setMessages] = useState<Array<{role: string, content: string, id: string}>>([
    {
      role: "assistant",
      content: "Hello, I'm Dr. Riya from Cadabam's Consult. How can I help you today?",
      id: "welcome-message"
    }
  ]);
  
  // Add a way to track sent messages to avoid duplicates
  const sentMessages = useRef(new Set<string>());
  
  // Auto-scroll to bottom when messages change
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useVoiceClientEvent(VoiceEvent.BotTranscript, (transcript) => {
    let transcriptText = '';
    
    // Handle string transcripts
    if (typeof transcript === 'string') {
      transcriptText = transcript;
    } 
    // Handle object transcripts
    else if (transcript && typeof transcript === 'object') {
      // Try different common properties
      const obj = transcript as any;
      if (typeof obj.text === 'string') {
        transcriptText = obj.text;
      } else if (typeof obj.transcript === 'string') {
        transcriptText = obj.transcript;
      } else if (typeof obj.content === 'string') {
        transcriptText = obj.content;
      } else if (typeof obj.message === 'string') {
        transcriptText = obj.message;
      } else {
        // Last resort: stringify the object
        try {
          transcriptText = JSON.stringify(transcript);
          if (transcriptText === '{}' || transcriptText === '[object Object]') {
            return; // Skip empty objects
          }
        } catch (e) {
          console.error("Failed to stringify transcript:", e);
          return; // Skip on error
        }
      }
    }
    
    // Skip empty transcripts
    if (!transcriptText || !transcriptText.trim()) {
      return;
    }
    
    // Deduplicate identical messages
    const msgKey = `bot-${transcriptText}`;
    if (sentMessages.current.has(msgKey)) {
      return;
    }
    
    console.log("Bot transcript:", transcriptText);
    sentMessages.current.add(msgKey);
    
    // Add the message with a unique ID
    const msgId = `bot-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setBotTranscript(prev => [...prev, transcriptText]);
    setMessages(prev => [...prev, { 
      role: "assistant", 
      content: transcriptText,
      id: msgId 
    }]);
  });

  useVoiceClientEvent(VoiceEvent.UserTranscript, (transcript) => {
    let transcriptText = '';
    
    // Handle string transcripts
    if (typeof transcript === 'string') {
      transcriptText = transcript;
    } 
    // Handle object transcripts
    else if (transcript && typeof transcript === 'object') {
      // Try different common properties
      const obj = transcript as any;
      if (typeof obj.text === 'string') {
        transcriptText = obj.text;
      } else if (typeof obj.transcript === 'string') {
        transcriptText = obj.transcript;
      } else if (typeof obj.content === 'string') {
        transcriptText = obj.content;
      } else if (typeof obj.message === 'string') {
        transcriptText = obj.message;
      } else {
        // Last resort: stringify the object
        try {
          transcriptText = JSON.stringify(transcript);
          if (transcriptText === '{}' || transcriptText === '[object Object]') {
            return; // Skip empty objects
          }
        } catch (e) {
          console.error("Failed to stringify transcript:", e);
          return; // Skip on error
        }
      }
    }
    
    // Skip empty transcripts
    if (!transcriptText || !transcriptText.trim()) {
      return;
    }
    
    // Deduplicate identical messages
    const msgKey = `user-${transcriptText}`;
    if (sentMessages.current.has(msgKey)) {
      return;
    }
    
    console.log("User transcript:", transcriptText);
    sentMessages.current.add(msgKey);
    
    // Add the message with a unique ID
    const msgId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setUserTranscript(prev => [...prev, transcriptText]);
    setMessages(prev => [...prev, { 
      role: "user", 
      content: transcriptText,
      id: msgId 
    }]);
  });

  useVoiceClientEvent(
    VoiceEvent.TransportStateChanged,
    (state: TransportState) => {
      setState(state);
      if (state === "connected") {
        setIsActive(true);
      } else if (state === "idle") {
        setIsActive(false);
        // Clear the sent messages cache when ending a session
        sentMessages.current.clear();
      }
    }
  );

  async function start() {
    if (!voiceClient) return;
    try {
      await voiceClient.start();
    } catch (e) {
      setError((e as VoiceError).message || "Unknown error occurred");
      voiceClient.disconnect();
    }
  }

  async function disconnect() {
    if (!voiceClient) return;
    await voiceClient.disconnect();
    // Keep the messages to maintain conversation history
  }

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="w-full bg-white shadow-md rounded-lg p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image 
            src="https://cdn.prod.website-files.com/6067e9cc04d7b901547a284e/669b63600521ea1779b61d34_62a2dea737ece30511d5f9a8_Logo%20for%20headder%20(1).webp" 
            alt="Cadabam's Hospital Logo"
            width={150}
            height={50}
            className="h-10 w-auto"
            priority
          />
          <div className="h-6 w-px bg-gray-300 mx-2"></div>
          <h1 className="text-xl font-bold text-blue-800">Dr. Riya</h1>
        </div>
        <div className="bg-blue-100 px-3 py-1 rounded-full text-sm text-blue-800 font-medium">
          AI Mental Health Assistant
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="w-full bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Conversation area */}
      <div className="w-full bg-white border border-gray-200 rounded-lg shadow-sm mb-6 h-96 overflow-y-auto p-4">
        <div className="flex flex-col gap-3">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-xs md:max-w-md rounded-lg p-3 ${
                  message.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-gray-100 text-gray-800 rounded-bl-none'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {state === "connecting" && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-3 rounded-bl-none flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-gray-500">Dr. Riya is typing...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Control Panel */}
      <div className="w-full bg-white border border-gray-200 rounded-lg p-4 flex flex-col items-center gap-4">
        <div className="text-center text-sm text-gray-500 mb-2">
          {state === "idle" 
            ? "Click the button below to start talking with Dr. Riya"
            : state === "connecting" 
              ? "Connecting to Dr. Riya..."
              : state === "connected" 
                ? "Dr. Riya is listening..."
                : "Processing your request..."}
        </div>
        
        <button
          onClick={() => (state === "idle" ? start() : disconnect())}
          className={`relative inline-flex items-center justify-center rounded-full w-16 h-16 transition-all duration-300 ${
            isActive 
              ? "bg-red-500 hover:bg-red-600" 
              : "bg-blue-600 hover:bg-blue-700"
          } shadow-lg hover:shadow-xl`}
          disabled={state === "connecting"}
        >
          {state === "connecting" ? (
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          ) : isActive ? (
            <MicOff className="h-6 w-6 text-white" />
          ) : (
            <Mic className="h-6 w-6 text-white" />
          )}
          
          <span className="absolute -bottom-8 text-sm font-medium text-gray-700">
            {isActive ? "End Call" : "Start Call"}
          </span>
        </button>
        
        <div className="w-full max-w-md mt-4 text-center">
          <p className="text-xs text-gray-500">
            Cadabam&apos;s Consult - Available Monday to Saturday, 9 AM to 7 PM
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;

// File: app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dr. Riya - Mental Health Assistant | Cadabam&apos;s Consult",
  description: "Talk to Dr. Riya, an AI mental health assistant from Cadabam&apos;s Consult who can help you book appointments and assess your mental health concerns.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}

// File: app/globals.css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --primary-color: #1e40af;
  --primary-light: #dbeafe;
  --accent-color: #0ea5e9;
  --text-color: #1e293b;
  --background-color: #f8fafc;
  --error-color: #ef4444;
}

body {
  color: var(--text-color);
  background: var(--background-color);
  font-family: var(--font-inter);
}

@layer base {
  body {
    @apply antialiased;
  }
}

@layer components {
  .chat-bubble-user {
    @apply bg-blue-600 text-white rounded-lg rounded-br-none p-3 max-w-xs md:max-w-md shadow-sm;
  }
  
  .chat-bubble-assistant {
    @apply bg-gray-100 text-gray-800 rounded-lg rounded-bl-none p-3 max-w-xs md:max-w-md shadow-sm;
  }
  
  .btn-primary {
    @apply bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-full 
           transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-opacity-50;
  }
  
  .btn-danger {
    @apply bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-full
           transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-opacity-50;
  }
  
  .card {
    @apply bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden;
  }
  
  .container-chat {
    @apply max-w-4xl mx-auto px-4 w-full;
  }
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 10px;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

// File: app/api/[[...route]]/route.ts
import { NextRequest } from "next/server";
import { handler } from "realtime-ai-daily-next";

// You'll need to set these environment variables:
// DAILY_API_KEY - Your Daily API key
// TOGETHER_API_KEY - Your Together.ai API key (if using Together.ai)
// CARTESIA_API_KEY - Your Cartesia API key (for voice)

export const GET = async (req: NextRequest) => {
  return handler(req);
};

export const POST = async (req: NextRequest) => {
  return handler(req);
};

export const dynamic = "force-dynamic";
