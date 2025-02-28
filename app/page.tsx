"use client";

import { useEffect, useState } from "react";
import { DailyVoiceClient } from "realtime-ai-daily";
import { VoiceClientAudio, VoiceClientProvider } from "realtime-ai-react";
import App from "./App";
import { defaultConfig } from "./rtvi.config";
import { LLMHelper } from "realtime-ai";
import { CalComService } from "@/lib/calComService";

export default function Home() {
  const [dailyVoiceClient, setDailyVoiceClient] = useState<DailyVoiceClient | null>(null);

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

      // Handle function calls
      llmHelper.handleFunctionCall(async (fn: any) => {
        console.log("Function call received:", fn);
        
        const args = typeof fn.arguments === 'string' 
          ? JSON.parse(fn.arguments) 
          : fn.arguments;
        
        // Handling book_appointment function
        if (fn.functionName === "book_appointment" && args) {
          const { date, time, email, name, concerns } = args;
          
          try {
            // Get Cal.com service instance
            const calComService = CalComService.getInstance();
            
            // Book appointment using Cal.com
            const booking = await calComService.createEvent(
              date,
              time,
              email,
              name,
              concerns || ""
            );
            
            // Extract meeting URL from booking response
            let meetingUrl = null;
            if (booking.references) {
              const meetingRef = booking.references.find(
                (ref: any) => ref.type === "google_meet_video"
              );
              if (meetingRef && meetingRef.meetingUrl) {
                meetingUrl = meetingRef.meetingUrl;
              }
            }
            
            return { 
              success: true, 
              appointment: {
                date,
                time,
                email,
                name,
                meetingUrl: meetingUrl || "Video link will be sent via email"
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
        else if (fn.functionName === "record_symptoms" && args) {
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
