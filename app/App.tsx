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

  // Add direct rendering of transcript arrays for debugging
  const debugMode = false; // Set to true to see raw transcripts

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

  // Add listeners for all relevant transcript events
  useEffect(() => {
    // Additional logging for debug purposes
    if (voiceClient) {
      console.log("VoiceClient initialized successfully");
      
      // Register any additional event listeners here
      const handleLog = (message: any) => {
        console.log("Daily voice log:", message);
      };
      
      voiceClient.on('log', handleLog);
      
      return () => {
        voiceClient.off('log', handleLog);
      };
    }
  }, [voiceClient]);

  useVoiceClientEvent(VoiceEvent.BotTranscript, (transcript) => {
    // Extract text content from the transcript
    console.log("Raw bot transcript received:", transcript);
    
    let transcriptText = '';
    
    // Handle string transcripts
    if (typeof transcript === 'string') {
      transcriptText = transcript;
    } 
    // Handle potential parsed JSON string
    else if (typeof transcript === 'string' && transcript.startsWith('{')) {
      try {
        const parsed = JSON.parse(transcript);
        if (parsed.text) transcriptText = parsed.text;
        else if (parsed.transcript) transcriptText = parsed.transcript;
        else if (parsed.content) transcriptText = parsed.content;
        else if (parsed.message) transcriptText = parsed.message;
        else transcriptText = transcript;
      } catch {
        transcriptText = transcript;
      }
    }
    // Handle object transcripts
    else if (transcript && typeof transcript === 'object') {
      const obj = transcript as any;
      
      // Try accessing various properties directly
      if (typeof obj.text === 'string') {
        transcriptText = obj.text;
      } else if (typeof obj.transcript === 'string') {
        transcriptText = obj.transcript;
      } else if (typeof obj.content === 'string') {
        transcriptText = obj.content;
      } else if (typeof obj.message === 'string') {
        transcriptText = obj.message;
      } else if (typeof obj.value === 'string') {
        transcriptText = obj.value;
      } else if (typeof obj.botTranscript === 'string') {
        transcriptText = obj.botTranscript;
      } else if (typeof obj.data === 'string') {
        transcriptText = obj.data;
      } else if (obj.data && typeof obj.data === 'object' && typeof obj.data.text === 'string') {
        transcriptText = obj.data.text;
      } else {
        // Last resort: stringify the object but avoid [object Object]
        try {
          const jsonString = JSON.stringify(obj);
          if (jsonString !== '{}' && jsonString !== '[object Object]') {
            transcriptText = jsonString;
          }
        } catch (e) {
          console.error("Failed to stringify transcript:", e);
        }
      }
    }
    
    console.log("Extracted bot transcript:", transcriptText);
    
    // Skip empty transcripts
    if (!transcriptText || !transcriptText.trim()) {
      return;
    }
    
    // Deduplicate identical messages
    const msgKey = `bot-${transcriptText}`;
    if (sentMessages.current.has(msgKey)) {
      return;
    }
    
    // Add the message with a unique ID
    const msgId = `bot-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    sentMessages.current.add(msgKey);
    setBotTranscript(prev => [...prev, transcriptText]);
    
    // Use setTimeout to ensure state updates don't conflict
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: transcriptText,
        id: msgId 
      }]);
    }, 10);
  });

  useVoiceClientEvent(VoiceEvent.UserTranscript, (transcript) => {
    // Extract text content from the transcript
    console.log("Raw user transcript received:", transcript);
    
    let transcriptText = '';
    
    // Handle string transcripts
    if (typeof transcript === 'string') {
      transcriptText = transcript;
    } 
    // Handle potential parsed JSON string
    else if (typeof transcript === 'string' && transcript.startsWith('{')) {
      try {
        const parsed = JSON.parse(transcript);
        if (parsed.text) transcriptText = parsed.text;
        else if (parsed.transcript) transcriptText = parsed.transcript;
        else if (parsed.content) transcriptText = parsed.content;
        else if (parsed.message) transcriptText = parsed.message;
        else transcriptText = transcript;
      } catch {
        transcriptText = transcript;
      }
    }
    // Handle object transcripts
    else if (transcript && typeof transcript === 'object') {
      const obj = transcript as any;
      
      // Try accessing various properties directly
      if (typeof obj.text === 'string') {
        transcriptText = obj.text;
      } else if (typeof obj.transcript === 'string') {
        transcriptText = obj.transcript;
      } else if (typeof obj.content === 'string') {
        transcriptText = obj.content;
      } else if (typeof obj.message === 'string') {
        transcriptText = obj.message;
      } else if (typeof obj.value === 'string') {
        transcriptText = obj.value;
      } else if (typeof obj.userTranscript === 'string') {
        transcriptText = obj.userTranscript;
      } else if (typeof obj.data === 'string') {
        transcriptText = obj.data;
      } else if (obj.data && typeof obj.data === 'object' && typeof obj.data.text === 'string') {
        transcriptText = obj.data.text;
      } else {
        // Last resort: stringify the object but avoid [object Object]
        try {
          const jsonString = JSON.stringify(obj);
          if (jsonString !== '{}' && jsonString !== '[object Object]') {
            transcriptText = jsonString;
          }
        } catch (e) {
          console.error("Failed to stringify transcript:", e);
        }
      }
    }
    
    console.log("Extracted user transcript:", transcriptText);
    
    // Skip empty transcripts
    if (!transcriptText || !transcriptText.trim()) {
      return;
    }
    
    // Deduplicate identical messages
    const msgKey = `user-${transcriptText}`;
    if (sentMessages.current.has(msgKey)) {
      return;
    }
    
    // Add the message with a unique ID
    const msgId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    sentMessages.current.add(msgKey);
    setUserTranscript(prev => [...prev, transcriptText]);
    
    // Use setTimeout to ensure state updates don't conflict
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: "user", 
        content: transcriptText,
        id: msgId 
      }]);
    }, 10);
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
            unoptimized
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
          
          {/* Debug view of raw transcripts if enabled */}
          {debugMode && (
            <div className="mt-6 p-3 border border-dashed border-gray-300 rounded bg-gray-50">
              <h3 className="text-sm font-semibold mb-2">Bot Transcripts (Debug):</h3>
              <ul className="text-xs text-gray-600">
                {botTranscript.map((item, i) => (
                  <li key={`bot-${i}`} className="mb-1">• {item}</li>
                ))}
              </ul>
              
              <h3 className="text-sm font-semibold mt-3 mb-2">User Transcripts (Debug):</h3>
              <ul className="text-xs text-gray-600">
                {userTranscript.map((item, i) => (
                  <li key={`user-${i}`} className="mb-1">• {item}</li>
                ))}
              </ul>
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
