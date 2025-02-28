// Auto-scroll to bottom when messages change
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);  // Listen for final user transcript to avoid duplicates from real-time transcription
  useVoiceClientEvent(VoiceEvent.FinalUserTranscript, (finalTranscript) => {
    // This helps ensure we get the final, correct version of user input
    console.log("Final user transcript received:", finalTranscript);
  });
  
  // Listen for socket connection status changes
  useEffect(() => {
    const checkConnection = () => {
      if (voiceClient) {
        const socketState = voiceClient.getSocketState?.();
        console.log("Socket connection state:", socketState);
      }
    };
    
    // Check initially and periodically
    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    
    return () => clearInterval(interval);
  }, [voiceClient]);"use client";

import React, { useState, useEffect } from "react";
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

  // Track conversation messages
  const [messages, setMessages] = useState<Array<{role: string, content: any, id: string}>>([
    {
      role: "assistant",
      content: "Hello, I'm Dr. Riya from Cadabam's Consult. How can I help you today?",
      id: "initial-message"
    }
  ]);
  
  // Keep track of processed transcripts to avoid duplication
  const [processedTranscripts] = useState<Set<string>>(new Set());
  const [lastUserMessageTime, setLastUserMessageTime] = useState<number>(0);
  const [lastBotMessageTime, setLastBotMessageTime] = useState<number>(0);

  useVoiceClientEvent(VoiceEvent.BotTranscript, (transcript) => {
    // Extract text from transcript object
    let transcriptText = '';
    if (typeof transcript === 'string') {
      transcriptText = transcript;
    } else if (transcript && typeof transcript === 'object') {
      // Use type assertion to handle the object properties
      const transcriptObj = transcript as Record<string, any>;
      // Try to access common transcript properties
      if (transcriptObj.text) {
        transcriptText = transcriptObj.text;
      } else if (transcriptObj.transcript) {
        transcriptText = transcriptObj.transcript;
      } else if (transcriptObj.content) {
        transcriptText = transcriptObj.content;
      } else {
        // Fallback to JSON stringify but avoid [object Object]
        try {
          const jsonStr = JSON.stringify(transcriptObj);
          transcriptText = jsonStr !== "[object Object]" ? jsonStr : ""; 
        } catch (e) {
          transcriptText = String(transcriptObj);
        }
      }
    }
    
    console.log("Bot transcript received:", transcriptText);
    
    // Only process non-empty, meaningful content
    if (transcriptText && transcriptText.trim()) {
      // Create a unique hash of the content to check for duplicates
      const contentHash = `bot-${transcriptText.trim()}`;
      
      // Deduplicate and throttle: don't add identical messages within 1 second
      const now = Date.now();
      if (
        !processedTranscripts.has(contentHash) && 
        now - lastBotMessageTime > 1000
      ) {
        processedTranscripts.add(contentHash);
        setLastBotMessageTime(now);
        
        const messageId = `bot-${now}-${Math.random().toString(36).substring(2, 9)}`;
        setBotTranscript((prev) => [...prev, transcriptText]);
        setMessages(prev => {
          // Check if we're getting the same content as the previous message
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === "assistant" && lastMsg.content === transcriptText) {
            return prev; // Skip duplicate
          }
          return [...prev, { role: "assistant", content: transcriptText, id: messageId }];
        });
      }
    }
  });

  useVoiceClientEvent(VoiceEvent.UserTranscript, (transcript) => {
    // Extract text from transcript object
    let transcriptText = '';
    if (typeof transcript === 'string') {
      transcriptText = transcript;
    } else if (transcript && typeof transcript === 'object') {
      // Use type assertion to handle the object properties
      const transcriptObj = transcript as Record<string, any>;
      // Try to access common transcript properties
      if (transcriptObj.text) {
        transcriptText = transcriptObj.text;
      } else if (transcriptObj.transcript) {
        transcriptText = transcriptObj.transcript;
      } else if (transcriptObj.content) {
        transcriptText = transcriptObj.content;
      } else {
        // Fallback to JSON stringify but avoid [object Object]
        try {
          const jsonStr = JSON.stringify(transcriptObj);
          transcriptText = jsonStr !== "[object Object]" ? jsonStr : "";
        } catch (e) {
          transcriptText = String(transcriptObj);
        }
      }
    }
    
    console.log("User transcript received:", transcriptText);
    
    // Only process non-empty, meaningful content
    if (transcriptText && transcriptText.trim()) {
      // Create a unique hash of the content to check for duplicates
      const contentHash = `user-${transcriptText.trim()}`;
      
      // Deduplicate and throttle: don't add identical messages within 1 second
      const now = Date.now();
      if (
        !processedTranscripts.has(contentHash) && 
        now - lastUserMessageTime > 1000
      ) {
        processedTranscripts.add(contentHash);
        setLastUserMessageTime(now);
        
        const messageId = `user-${now}-${Math.random().toString(36).substring(2, 9)}`;
        setUserTranscript((prev) => [...prev, transcriptText]);
        setMessages(prev => {
          // Check if we're getting the same content as the previous message
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === "user" && lastMsg.content === transcriptText) {
            return prev; // Skip duplicate
          }
          return [...prev, { role: "user", content: transcriptText, id: messageId }];
        });
      }
    }
  });

  useVoiceClientEvent(
    VoiceEvent.TransportStateChanged,
    (state: TransportState) => {
      setState(state);
      if (state === "connected") {
        setIsActive(true);
      } else if (state === "idle") {
        setIsActive(false);
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
        <div className="flex flex-col gap-4">
          {messages.map((message) => {
            // Determine the content to display
            let displayContent = '';
            if (typeof message.content === 'string') {
              displayContent = message.content;
            } else if (message.content && typeof message.content === 'object') {
              // Use type assertion to handle the object properties
              const contentObj = message.content as Record<string, any>;
              // Try to access common transcript properties
              if (contentObj.text) {
                displayContent = contentObj.text;
              } else if (contentObj.transcript) {
                displayContent = contentObj.transcript;
              } else if (contentObj.content) {
                displayContent = contentObj.content;
              } else {
                // Fallback to JSON stringify but avoid [object Object]
                try {
                  const jsonStr = JSON.stringify(contentObj);
                  displayContent = jsonStr !== "[object Object]" ? jsonStr : "Unable to display message"; 
                } catch (e) {
                  displayContent = String(contentObj);
                }
              }
            }
            
            // Only render if we have content to display
            if (!displayContent) return null;
            
            return (
              <div 
                key={message.id} 
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-3`}
              >
                <div 
                  className={`max-w-3/4 rounded-lg p-3 ${
                    message.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-gray-100 text-gray-800 rounded-bl-none'
                  }`}
                >
                  {displayContent}
                </div>
              </div>
            );
          })}
          {state === "connecting" && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-3 rounded-bl-none flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-gray-500">Dr. Riya is typing...</span>
              </div>
            </div>
          )}
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
