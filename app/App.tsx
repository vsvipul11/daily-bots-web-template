"use client";

import React, { useState, useEffect, useRef } from "react";
import { RTVIClient } from "@pipecat-ai/client-js";
import { Mic, MicOff, Loader2, Calendar, MapPin } from "lucide-react";

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

interface AppProps {
  voiceClient: RTVIClient;
}

const App: React.FC<AppProps> = ({ voiceClient }) => {
  const [error, setError] = useState<string | null>(null);
  const [userTranscript, setUserTranscript] = useState<string[]>([]);
  const [botTranscript, setBotTranscript] = useState<string[]>([]);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [showEmailInput, setShowEmailInput] = useState<boolean>(true);
  
  // Tracking patient data
  const [symptoms, setSymptoms] = useState<Array<{
    location: string, 
    duration?: string, 
    severity?: string,
    pattern?: string,
    triggers?: string
  }>>([]);
  
  const [appointment, setAppointment] = useState<{
    appointmentType: string,
    location?: string,
    date: string, 
    time: string, 
    confirmed: boolean,
    fee: string
  } | null>(null);
  
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  
  // For preventing function call data from appearing in messages
  const [processingFunctionCall, setProcessingFunctionCall] = useState(false);
  const lastFunctionCallRef = useRef<string | null>(null);
  
  // Debug mode
  const debugMode = false; // Set to true to see raw transcripts

  // Track conversation messages with unique IDs
  const [messages, setMessages] = useState<Array<{role: string, content: string, id: string}>>([
    {
      role: "assistant",
      content: "Hi, this is Dr. Riya from Physiotattva. How can I assist you today?",
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

  // Function to handle email submission
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userEmail && userName) {
      setShowEmailInput(false);
    }
  };

  useEffect(() => {
    if (!voiceClient) return;

    // Set up event listeners for voice client
    const handleBotUtterance = (text: string) => {
      console.log("Bot utterance:", text);
      
      // Ignore if processing function call
      if (processingFunctionCall) {
        console.log("Ignoring bot utterance during function call processing");
        return;
      }
      
      // Check if this is a function call
      const functionMatch = text.match(/<function=(.+?)>(.+?)<\/function>/);
      if (functionMatch) {
        // Process function call
        setProcessingFunctionCall(true);
        lastFunctionCallRef.current = text;
        
        // Handle function call message (don't display to user)
        const [, functionName, argsString] = functionMatch;
        
        try {
          const args = JSON.parse(argsString);
          
          if (functionName === "record_symptoms" && args.symptoms) {
            setSymptoms(args.symptoms);
          }
          else if (functionName === "book_appointment") {
            const { appointmentType, location, date, time } = args;
            const fee = appointmentType === "online" ? "99 INR" : "499 INR";
            
            setAppointment({
              appointmentType,
              location: location || "Online",
              date,
              time,
              confirmed: true,
              fee
            });
          }
          else if (functionName === "lookup_appointment") {
            setExistingAppointments([
              {
                appointmentType: "online",
                date: "2025-03-15",
                time: "10:30",
                confirmed: true
              }
            ]);
          }
          
          // Clear function call processing state after a delay
          setTimeout(() => {
            setProcessingFunctionCall(false);
          }, 100);
          
        } catch (error) {
          console.error("Error processing function call:", error);
          setProcessingFunctionCall(false);
        }
        
        return;
      }
      
      // Check if this matches a recent function call
      if (lastFunctionCallRef.current && text.includes(lastFunctionCallRef.current.substring(0, 20))) {
        console.log("Skipping function call that appears in message");
        return;
      }
      
      // Add bot message
      const msgKey = `bot-${text}`;
      if (!sentMessages.current.has(msgKey)) {
        sentMessages.current.add(msgKey);
        const msgId = `bot-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        setBotTranscript(prev => [...prev, text]);
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: text,
          id: msgId 
        }]);
      }
    };

    const handleUserUtterance = (text: string) => {
      console.log("User utterance:", text);
      
      // Ignore if processing function call
      if (processingFunctionCall) {
        console.log("Ignoring user utterance during function call processing");
        return;
      }
      
      // Add user message
      const msgKey = `user-${text}`;
      if (!sentMessages.current.has(msgKey)) {
        sentMessages.current.add(msgKey);
        const msgId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        setUserTranscript(prev => [...prev, text]);
        setMessages(prev => [...prev, { 
          role: "user", 
          content: text,
          id: msgId 
        }]);
      }
    };

    // Register event listeners
    voiceClient.on("botUtterance", handleBotUtterance);
    voiceClient.on("userUtterance", handleUserUtterance);
    
    voiceClient.on("connecting", () => setIsConnecting(true));
    voiceClient.on("connected", () => {
      setIsConnecting(false);
      setIsCallActive(true);
    });
    voiceClient.on("disconnected", () => {
      setIsConnecting(false);
      setIsCallActive(false);
      // Reset tracking
      sentMessages.current.clear();
    });
    voiceClient.on("error", (error) => {
      setError(error.message || "An unknown error occurred");
      setIsConnecting(false);
      setIsCallActive(false);
    });

    // Cleanup
    return () => {
      voiceClient.off("botUtterance", handleBotUtterance);
      voiceClient.off("userUtterance", handleUserUtterance);
      voiceClient.off("connecting");
      voiceClient.off("connected");
      voiceClient.off("disconnected");
      voiceClient.off("error");
    };
  }, [voiceClient, processingFunctionCall]);

  const startCall = async () => {
    if (!voiceClient || !userEmail || !userName) return;
    
    try {
      setIsConnecting(true);
      await voiceClient.connect();
    } catch (error: any) {
      setError(error.message || "Failed to start call");
      setIsConnecting(false);
    }
  };

  const endCall = async () => {
    if (!voiceClient) return;
    
    try {
      await voiceClient.disconnect();
    } catch (error: any) {
      setError(error.message || "Failed to end call");
    }
  };

  // Email collection form
  if (showEmailInput) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-center mb-6">
            <div className="text-3xl font-bold text-blue-700">Physiotattva</div>
          </div>
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
            Welcome to Dr. Riya&apos;s Physiotherapy Consultation
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
                We&apos;ll send your appointment details to this email
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
          <div className="text-2xl font-bold text-blue-700">Physiotattva</div>
          <div className="h-6 w-px bg-gray-300 mx-2"></div>
          <h1 className="text-xl font-bold text-blue-800">Dr. Riya</h1>
        </div>
        <div className="bg-blue-100 px-3 py-1 rounded-full text-sm text-blue-800 font-medium">
          Physiotherapy Assistant
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
              {isConnecting && (
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
              {!isCallActive && !isConnecting
                ? "Click the button below to start talking with Dr. Riya"
                :isConnecting
                  ? "Connecting to Dr. Riya..."
                  : isCallActive 
                    ? "Dr. Riya is listening..."
                    : "Processing your request..."}
            </div>
            
            <button
              onClick={() => (isCallActive ? endCall() : startCall())}
              className={`relative inline-flex items-center justify-center rounded-full w-16 h-16 transition-all duration-300 ${
                isCallActive 
                  ? "bg-red-500 hover:bg-red-600" 
                  : "bg-blue-600 hover:bg-blue-700"
              } shadow-lg hover:shadow-xl`}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              ) : isCallActive ? (
                <MicOff className="h-6 w-6 text-white" />
              ) : (
                <Mic className="h-6 w-6 text-white" />
              )}
              
              <span className="absolute -bottom-8 text-sm font-medium text-gray-700">
                {isCallActive ? "End Call" : "Start Call"}
              </span>
            </button>
            
            <div className="w-full max-w-md mt-4 text-center">
              <p className="text-xs text-gray-500">
                Physiotattva - Available Monday to Saturday, 8 AM to 8 PM
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
                      <p className="font-medium text-gray-800">{symptom.location}</p>
                      <div className="mt-1 text-sm space-y-1">
                        {symptom.duration && (
                          <div className="text-gray-500">Duration: {symptom.duration}</div>
                        )}
                        {symptom.severity && (
                          <div className="text-gray-500">Severity: {symptom.severity}</div>
                        )}
                        {symptom.pattern && (
                          <div className="text-gray-500">Pattern: {symptom.pattern}</div>
                        )}
                        {symptom.triggers && (
                          <div className="text-gray-500">Triggers: {symptom.triggers}</div>
                        )}
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
                  <p className="text-gray-700 mb-1">
                    Time: {formatTime(appointment.time)}
                  </p>
                  <div className="flex items-start gap-2 mb-3">
                    <MapPin className="h-4 w-4 mt-0.5 text-blue-600" />
                    <span className="text-gray-700">
                      {appointment.appointmentType === "online" 
                        ? "Online consultation" 
                        : `In-person at ${appointment.location}`}
                    </span>
                  </div>
                  <p className="text-gray-700 font-medium">
                    Fee: {appointment.fee}
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
                      
                      <p className="text-xs text-gray-500 mt-2">
                        A confirmation has been sent to your email
                      </p>
                    </div>
                  )}
                </div>
              ) : existingAppointments.length > 0 ? (
                <div className="space-y-3">
                  {existingAppointments.map((apt, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-md">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-gray-800">
                          {formatDate(apt.date)}
                        </span>
                      </div>
                      <p className="text-gray-700 text-sm">
                        Time: {formatTime(apt.time)}
                      </p>
                      <p className="text-gray-700 text-sm">
                        Type: {apt.appointmentType === "online" 
                          ? "Online consultation" 
                          : "In-person consultation"}
                      </p>
                    </div>
                  ))}
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
