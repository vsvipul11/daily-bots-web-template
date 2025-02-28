"use client";

import React, { useState, useEffect, useRef } from "react";
import { TransportState, VoiceError, VoiceEvent } from "realtime-ai";
import { useVoiceClient, useVoiceClientEvent } from "realtime-ai-react";
import Image from "next/image";
import { Mic, MicOff, Loader2, Calendar, Video } from "lucide-react";
import { CalComService } from "../lib/calComService";

// Function to format date string
const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
};

// Function to format time string
const formatTime = (timeString: string) => {
  try {
    if (timeString.includes(':')) {
      const [hours, minutes] = timeString.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }
    return timeString;
  } catch (e) {
    return timeString;
  }
};

const App: React.FC = () => {
  const voiceClient = useVoiceClient();
  const [error, setError] = useState<string | null>(null);
  const [userTranscript, setUserTranscript] = useState<string[]>([]);
  const [botTranscript, setBotTranscript] = useState<string[]>([]);
  const [state, setState] = useState<TransportState>("idle");
  const [isActive, setIsActive] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [showEmailInput, setShowEmailInput] = useState<boolean>(true);
  
  // Tracking appointment data
  const [symptoms, setSymptoms] = useState<Array<{symptom: string, severity: string, duration: string}>>([]);
  const [appointment, setAppointment] = useState<{date: string, time: string, confirmed: boolean} | null>(null);
  const [meetingUrl, setMeetingUrl] = useState<string | null>(null);
  
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

  // Add basic initialization logging
  useEffect(() => {
    if (voiceClient) {
      console.log("VoiceClient initialized successfully");
    }
  }, [voiceClient]);

  // Function to handle email submission
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userEmail && userName) {
      setShowEmailInput(false);
    }
  };

  // Function to process function calls from the LLM
  const processFunctionCall = async (functionCall: string) => {
    try {
      // Extract function name and arguments
      const functionMatch = functionCall.match(/<function=(.+?)>(.+?)<\/function>/);
      if (!functionMatch) return;

      const [, functionName, argsString] = functionMatch;
      const args = JSON.parse(argsString);

      console.log(`Processing function call: ${functionName}`, args);

      if (functionName === "record_symptoms" && args.symptoms) {
        // Record symptoms
        setSymptoms(args.symptoms);
        return { success: true, symptoms: args.symptoms };
      } 
      else if (functionName === "book_appointment") {
        // Book appointment
        const { date, time, email, name, concerns } = args;
        
        // Update local state
        setAppointment({
          date,
          time,
          confirmed: false
        });
        
        try {
          // Create appointment with Cal.com
          const calComService = CalComService.getInstance();
          const result = await calComService.createEvent(
            date,
            time,
            email || userEmail,
            name || userName,
            concerns || ""
          );
          
          // Update state with confirmed appointment
          setAppointment({
            date,
            time,
            confirmed: true
          });
          
          // Extract meeting URL from booking response
          if (result.references) {
            const meetingRef = result.references.find(
              (ref: any) => ref.type === "google_meet_video"
            );
            if (meetingRef && meetingRef.meetingUrl) {
              setMeetingUrl(meetingRef.meetingUrl);
            }
          }
          
          return { 
            success: true, 
            appointment: { 
              date, 
              time, 
              email: email || userEmail,
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
    } catch (error) {
      console.error("Error processing function call:", error);
      return { success: false, error: "Failed to process function call" };
    }
  };

  useVoiceClientEvent(VoiceEvent.BotTranscript, (transcript: any) => {
    // Extract text content from the transcript
    console.log("Raw bot transcript received:", transcript);
    
    let transcriptText = '';
    let functionCall = null;
    
    // Handle string transcripts
    if (typeof transcript === 'string') {
      transcriptText = transcript;
      
      // Check for function calls in the transcript
      const functionMatch = transcript.match(/<function=(.+?)>(.+?)<\/function>/);
      if (functionMatch) {
        functionCall = transcript;
        // Don't display function calls to the user
        transcriptText = "";
      }
      
      // Try to parse JSON strings if no function call
      if (!functionCall && transcript.startsWith('{')) {
        try {
          const parsed = JSON.parse(transcript);
          if (parsed && typeof parsed === 'object') {
            if (parsed.text) transcriptText = parsed.text;
            else if (parsed.transcript) transcriptText = parsed.transcript;
            else if (parsed.content) transcriptText = parsed.content;
            else if (parsed.message) transcriptText = parsed.message;
          }
        } catch (e) {
          // If parsing fails, keep original string
          console.log("JSON parse failed, using original string");
        }
      }
    } 
    // Handle object transcripts
    else if (transcript && typeof transcript === 'object') {
      // Try accessing various properties directly
      const obj = transcript as Record<string, any>;
      
      // Check for function calls in object format
      if (obj.functionCall || obj.function_call || obj.tool_calls) {
        functionCall = JSON.stringify(obj.functionCall || obj.function_call || obj.tool_calls);
        // Don't display function calls to the user
        transcriptText = "";
      } else {
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
    }
    
    // Process function calls if present
    if (functionCall) {
      processFunctionCall(functionCall).then(result => {
        console.log("Function call result:", result);
      });
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

  useVoiceClientEvent(VoiceEvent.UserTranscript, (transcript: any) => {
    // Extract text content from the transcript
    console.log("Raw user transcript received:", transcript);
    
    let transcriptText = '';
    
    // Handle string transcripts
    if (typeof transcript === 'string') {
      transcriptText = transcript;
      
      // Try to parse JSON strings
      if (transcript.startsWith('{')) {
        try {
          const parsed = JSON.parse(transcript);
          if (parsed && typeof parsed === 'object') {
            if (parsed.text) transcriptText = parsed.text;
            else if (parsed.transcript) transcriptText = parsed.transcript;
            else if (parsed.content) transcriptText = parsed.content;
            else if (parsed.message) transcriptText = parsed.message;
          }
        } catch (e) {
          // If parsing fails, keep original string
          console.log("JSON parse failed, using original string");
        }
      }
    } 
    // Handle object transcripts
    else if (transcript && typeof transcript === 'object') {
      // Try accessing various properties directly
      const obj = transcript as Record<string, any>;
      
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
    if (!voiceClient || !userEmail || !userName) return;
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

  // Email collection form
  if (showEmailInput) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-center mb-6">
            <Image 
              src="https://cdn.prod.website-files.com/6067e9cc04d7b901547a284e/669b63600521ea1779b61d34_62a2dea737ece30511d5f9a8_Logo%20for%20headder%20(1).webp" 
              alt="Cadabam's Hospital Logo"
              width={200}
              height={60}
              className="h-12 w-auto"
              unoptimized
              priority
            />
          </div>
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
            Welcome to Dr. Riya's Consultation
          </h2>
          <p className="text-gray-600 mb-6 text-center">
            Please provide your information to continue
          </p>
          
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                type="text"
                id="name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your name"
                required
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                We'll send your appointment details to this email
              </p>
            </div>
            
            <button
              type="submit"
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition duration-200"
            >
              Continue to Consultation
            </button>
          </form>
        </div>
      </div>
    );
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

      <div className="flex w-full gap-6">
        {/* Main conversation area */}
        <div className="flex-1">
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

        {/* Right side panel with consultation information */}
        <div className="w-80 shrink-0">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 sticky top-4">
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b border-gray-200">
              Consultation Details
            </h2>
            
            {/* User info */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Patient Information</h3>
              <p className="text-gray-800">{userName}</p>
              <p className="text-gray-600 text-sm">{userEmail}</p>
            </div>
            
            {/* Symptoms */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Reported Symptoms</h3>
              {symptoms.length > 0 ? (
                <div className="space-y-2">
                  {symptoms.map((symptom, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-md">
                      <p className="font-medium text-gray-800">{symptom.symptom}</p>
                      <div className="flex justify-between mt-1 text-sm">
                        <span className="text-gray-500">Severity: {symptom.severity}</span>
                        <span className="text-gray-500">Duration: {symptom.duration}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">No symptoms recorded yet</p>
              )}
            </div>
            
            {/* Appointment */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Appointment</h3>
              {appointment ? (
                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-gray-800">
                      {formatDate(appointment.date)}
                    </span>
                  </div>
                  <p className="text-gray-700">
                    Time: {formatTime(appointment.time)}
                  </p>
                  
                  {appointment.confirmed && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-green-700 text-sm">Appointment confirmed</span>
                      </div>
                      
                      {meetingUrl && (
                        <a 
                          href={meetingUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 mt-2 text-sm text-blue-600 hover:underline"
                        >
                          <Video className="h-4 w-4" />
                          Join video consultation
                        </a>
                      )}
                      
                      <p className="text-xs text-gray-500 mt-2">
                        A calendar invitation has been sent to your email
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 italic">No appointment scheduled yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
