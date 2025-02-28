"use client";

import { useEffect, useState } from "react";
import { RTVIClient } from "@pipecat-ai/client-js";
import { DailyTransport } from "@pipecat-ai/daily-transport";
import App from "./App";
import { geminiConfig } from "./rtvi.config";
import { LLMHelper } from "@pipecat-ai/client-js";

export default function Home() {
  const [voiceClient, setVoiceClient] = useState<RTVIClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Only initialize once
    if (voiceClient) {
      return;
    }

    async function initializeClient() {
      try {
        setIsLoading(true);
        
        // Create new RTVI client with Gemini configuration
        const client = new RTVIClient({
          transport: new DailyTransport(),
          params: {
            baseUrl: `/api`,
            endpoints: {
              connect: "/connect",
              actions: "/actions",
            },
            requestData: {
              services: {
                stt: "deepgram",
                tts: "cartesia",
                llm: "gemini"
              },
              config: geminiConfig
            },
          },
          enableMic: true,
          enableCam: false,
          callbacks: {
            onBotReady: () => {
              console.log("Bot is ready!");
            },
          }
        });
        
        // Setup function calling handler
        setupFunctionCallingHandler(client);
        
        setVoiceClient(client);
      } catch (error) {
        console.error("Failed to initialize voice client:", error);
      } finally {
        setIsLoading(false);
      }
    }
    
    initializeClient();
  }, [voiceClient]);

  // Function to set up function calling with the voiceClient
  const setupFunctionCallingHandler = (client: RTVIClient) => {
    try {
      // Register LLM helper
      const llmHelper = client.registerHelper(
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
          try {
            // In a real app, you would call your booking API
            // Here we just simulate a successful booking
            const { appointmentType, location, date, time, email, name } = args;
            const fee = appointmentType === "online" ? "99 INR" : "499 INR";
            
            console.log("Booking appointment:", {
              appointmentType,
              location: location || "Online",
              date,
              time,
              email,
              name,
              fee
            });
            
            // Simulate API call latency
            await new Promise(resolve => setTimeout(resolve, 500));
            
            return { 
              success: true, 
              appointment: { 
                appointmentType,
                location: location || "Online",
                date, 
                time, 
                email,
                name,
                fee
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
          try {
            console.log("Recording symptoms:", args.symptoms);
            return { success: true, symptoms: args.symptoms };
          } catch (error) {
            console.error("Failed to record symptoms:", error);
            return { 
              success: false, 
              error: "Failed to record symptoms."
            };
          }
        }
        
        // Handling lookup_appointment function
        else if (fn.functionName === "lookup_appointment" && args) {
          try {
            console.log("Looking up appointments for:", args.email);
            
            // Simulate fetching appointments
            const fakeAppointments = [
              {
                appointmentType: "online",
                date: "2025-03-15",
                time: "10:30",
                confirmed: true
              }
            ];
            
            return {
              success: true,
              appointments: fakeAppointments
            };
          } catch (error) {
            console.error("Failed to lookup appointments:", error);
            return { 
              success: false, 
              error: "Failed to find appointments."
            };
          }
        }
        
        return null;
      });
    } catch (error) {
      console.error("Error setting up function calling:", error);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : voiceClient ? (
          <App voiceClient={voiceClient} />
        ) : (
          <div className="flex justify-center items-center h-64">
            <div className="text-red-500">Failed to initialize voice client</div>
          </div>
        )}
      </div>
    </main>
  );
}
