"use client";

import { useEffect, useState } from "react";
import { DailyVoiceClient } from "realtime-ai-daily";
import { VoiceClientAudio, VoiceClientProvider } from "realtime-ai-react";
import App from "./App";
import Image from "next/image";
import { defaultConfig } from "./rtvi.config";
import { LLMHelper } from "realtime-ai";
import CalendlyService from "@/lib/calendlyService";

export default function Home() {
  const [dailyVoiceClient, setDailyVoiceClient] = useState<DailyVoiceClient | null>(null);
  const userEmail = "user@example.com"; // This is now handled by the App component's form

  useEffect(() => {
    if (dailyVoiceClient) {
      return;
    }

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
        ...defaultConfig,
      ],
    });
    
    // Setup function calling handler
    setupFunctionCallingHandler(voiceClient);
    
    setDailyVoiceClient(voiceClient);
  }, [dailyVoiceClient]);

  // Function to set up function calling with the voiceClient
  const setupFunctionCallingHandler = (voiceClient: DailyVoiceClient) => {
    try {
      // Register LLM helper
      const llmHelper = voiceClient.registerHelper(
        "llm",
        new LLMHelper({
          callbacks: {},
        })
      ) as LLMHelper;

      // Handle book_appointment function calls
      llmHelper.handleFunctionCall(async (fn: any) => {
        console.log("Function call received:", fn);
        
        // Handling book_appointment function
        if (fn.functionName === "book_appointment" && fn.arguments) {
          const args = typeof fn.arguments === 'string' 
            ? JSON.parse(fn.arguments) 
            : fn.arguments;
            
          const { date, time, email, name, concerns } = args;
          
          try {
            // Create appointment with Calendly
            const calendlyService = CalendlyService.getInstance();
            const result = await calendlyService.createAppointment(
              date,
              time,
              email,
              name,
              concerns || ""
            );
            
            return { 
              success: true, 
              appointment: {
                date,
                time,
                email,
                meetingUrl: result.meetingUrl || "Video link will be sent via email"
              }
            };
          } catch (error) {
            console.error("Failed to book appointment:", error);
            return { 
              success: false, 
              error: "Failed to book appointment. Please try again."
            };
          }
        }
        
        // Handling record_symptoms function
        else if (fn.functionName === "record_symptoms" && fn.arguments) {
          const args = typeof fn.arguments === 'string' 
            ? JSON.parse(fn.arguments) 
            : fn.arguments;
            
          // Simply pass through the symptoms data
          return { success: true, symptoms: args.symptoms };
        }
        
        return null;
      });
    } catch (error) {
      console.error("Error setting up function calling:", error);
    }
  };

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
