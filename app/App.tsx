"use client";

import React, { useState, useEffect, useRef } from "react";
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

// Define a proper type for symptoms
interface Symptom {
  location: string;
  severity?: string;
  duration?: string;
  pattern?: string;
  triggers?: string;
}

// Parse symptom data from transcript
const parseSymptoms = (text: string): Symptom[] => {
  const symptoms: Symptom[] = [];
  
  // Look for pain/discomfort mentions
  const locationMatches = text.match(/pain in (?:my|the) ([a-z\s]+)/gi);
  if (locationMatches && locationMatches.length > 0) {
    locationMatches.forEach(match => {
      const location = match.replace(/pain in (?:my|the) /i, '').trim();
      symptoms.push({ location });
    });
  }
  
  // Look for severity mentions
  const severityMatch = text.match(/([0-9]|10)(?: out of 10)? (?:pain|severity)/i);
  if (severityMatch && symptoms.length > 0) {
    symptoms[symptoms.length - 1].severity = severityMatch[1] + "/10";
  }
  
  // Look for duration
  const durationMatch = text.match(/(for|since|about) ([a-z0-9\s]+) (days?|weeks?|months?|years?)/i);
  if (durationMatch && symptoms.length > 0) {
    symptoms[symptoms.length - 1].duration = durationMatch[0];
  }
  
  return symptoms;
};
// Parse appointment data from transcript
const parseAppointment = (text: string): any | null => {
  // Online vs in-person
  let appointmentType = null;
  if (text.match(/online|virtual|video/i)) {
    appointmentType = "online";
  } else if (text.match(/in[\s-]person|office|clinic|centre|center/i)) {
    appointmentType = "in-person";
  }
  
  // Location for in-person
  let location = null;
  if (appointmentType === "in-person") {
    const locationMatch = text.match(/(?:in|at) (bangalore|hyderabad)/i);
    if (locationMatch) {
      location = locationMatch[1];
    }
  }
  
  // Date
  let date = null;
  const dateMatch = text.match(/(monday|tuesday|wednesday|thursday|friday|saturday)/i);
  if (dateMatch) {
    // Convert day name to next occurrence
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const today = new Date();
    const dayIndex = dayNames.findIndex(d => d.toLowerCase() === dateMatch[1].toLowerCase());
    
    if (dayIndex !== -1) {
      const daysUntilNext = (dayIndex - today.getDay() + 7) % 7;
      const nextDate = new Date();
      nextDate.setDate(today.getDate() + (daysUntilNext === 0 ? 7 : daysUntilNext));
      date = nextDate.toISOString().split('T')[0]; // YYYY-MM-DD
    }
  }
  
  // Time
  let time = null;
  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? timeMatch[2] : "00";
    const period = timeMatch[3].toLowerCase();
    
    if (period === "pm" && hours < 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;
    
    time = `${hours.toString().padStart(2, '0')}:${minutes}`;
  }
  
  if (appointmentType && date && time) {
    return {
      appointmentType,
      location,
      date,
      time,
      confirmed: text.includes("confirm") || text.includes("book"),
      fee: appointmentType === "online" ? "99 INR" : "499 INR"
    };
  }
  
  return null;
};

// The main component
const App: React.FC = () => {
  // State for audio recording and sending to Daily API
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userTranscript, setUserTranscript] = useState<string[]>([]);
  const [botTranscript, setBotTranscript] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [showEmailInput, setShowEmailInput] = useState<boolean>(true);
  const [botReady, setBotReady] = useState(false);
  
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
  
  // For tracking context to help parse symptoms and appointments
  const currentContextRef = useRef<string>("initial"); // "initial", "symptoms", "appointment"
  
  // WebSocket connection
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  // Add direct rendering of transcript arrays for debugging
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
      setBotReady(true);
    }
  };

  // Function to start the voice conversation
  const startVoiceConversation = async () => {
    try {
      setIsConnecting(true);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Configure gemini service
      const services = {
        stt: "deepgram",
        tts: "cartesia",
        llm: "gemini"
      };
      
      // Configuration based on your playground example
      const config = [
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
      ];
      
      // Call our API route to start the Daily bot
      const response = await fetch('/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ services, config })
      });
      
      if (!response.ok) {
        throw new Error('Failed to start bot');
      }
      
      const botData = await response.json();
      
      // Connect to the WebSocket
      if (botData.ws_url) {
        // Create WebSocket connection
        socketRef.current = new WebSocket(botData.ws_url);
        
        // Setup event handlers
        socketRef.current.onopen = () => {
          setIsRecording(true);
          setIsConnecting(false);
          
          // Setup MediaRecorder for streaming audio
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm'
          });
          
          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && socketRef.current?.readyState === WebSocket.OPEN) {
              socketRef.current.send(event.data);
            }
          };
          
          mediaRecorder.start(100); // Send data every 100ms
          mediaRecorderRef.current = mediaRecorder;
        };
        
        socketRef.current.onmessage = (event) => {
          // Handle incoming messages from the bot
          try {
            const data = JSON.parse(event.data);
            
            // Handle transcript data
            if (data.type === 'transcript' && data.role === 'bot') {
              const transcriptText = data.text || '';
              
              // Skip empty transcripts
              if (!transcriptText.trim()) return;
              
              // Infer the current context from the bot's message
              if (transcriptText.includes("discomfort") || transcriptText.includes("pain") || 
                  transcriptText.includes("severity") || transcriptText.includes("scale")) {
                currentContextRef.current = "symptoms";
              } else if (transcriptText.includes("appointment") || transcriptText.includes("consultation") ||
                         transcriptText.includes("online") || transcriptText.includes("in-person")) {
                currentContextRef.current = "appointment";
              }
              
              // Deduplicate identical messages
              const msgKey = `bot-${transcriptText}`;
              if (!sentMessages.current.has(msgKey)) {
                sentMessages.current.add(msgKey);
                const msgId = `bot-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                
                setBotTranscript(prev => [...prev, transcriptText]);
                setMessages(prev => [...prev, { 
                  role: "assistant", 
                  content: transcriptText,
                  id: msgId 
                }]);
              }
            }
            else if (data.type === 'transcript' && data.role === 'user') {
              const transcriptText = data.text || '';
              
              // Skip empty transcripts
              if (!transcriptText.trim()) return;
              
              // Parse user's message for symptoms or appointments based on context
              if (currentContextRef.current === "symptoms") {
                const detectedSymptoms = parseSymptoms(transcriptText);
                if (detectedSymptoms.length > 0) {
                  console.log("Detected symptoms:", detectedSymptoms);
                  setSymptoms(prev => {
                    // Merge with existing symptoms
                    const existing = [...prev];
                    detectedSymptoms.forEach(symptom => {
                      const existingIndex = existing.findIndex(s => s.location === symptom.location);
                      if (existingIndex >= 0) {
                        existing[existingIndex] = { ...existing[existingIndex], ...symptom };
                      } else {
                        existing.push(symptom);
                      }
                    });
                    return existing;
                  });
                }
              } else if (currentContextRef.current === "appointment") {
                const detectedAppointment = parseAppointment(transcriptText);
                if (detectedAppointment) {
                  console.log("Detected appointment:", detectedAppointment);
                  setAppointment(detectedAppointment);
                }
              }
              
              // Deduplicate identical messages
              const msgKey = `user-${transcriptText}`;
              if (!sentMessages.current.has(msgKey)) {
                sentMessages.current.add(msgKey);
                const msgId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                
                setUserTranscript(prev => [...prev, transcriptText]);
                setMessages(prev => [...prev, { 
                  role: "user", 
                  content: transcriptText,
                  id: msgId 
                }]);
              }
            }
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        };
        
        socketRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          setError('Connection error occurred');
          setIsRecording(false);
          setIsConnecting(false);
        };
        
        socketRef.current.onclose = () => {
          setIsRecording(false);
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
          stream.getTracks().forEach(track => track.stop());
        };
      }
    } catch (error) {
      console.error('Error starting voice conversation:', error);
      setError('Failed to start voice conversation');
      setIsConnecting(false);
    }
  };

  const stopVoiceConversation = () => {
    // Stop recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    // Close WebSocket
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    
    setIsRecording(false);
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
              {!isRecording && !isConnecting
                ? "Click the button below to start talking with Dr. Riya"
                : isConnecting
                  ? "Connecting to Dr. Riya..."
                  : isRecording 
                    ? "Dr. Riya is listening..."
                    : "Processing your request..."}
            </div>
            
            <button
              onClick={() => (isRecording ? stopVoiceConversation() : startVoiceConversation())}
              className={`relative inline-flex items-center justify-center rounded-full w-16 h-16 transition-all duration-300 ${
                isRecording 
                  ? "bg-red-500 hover:bg-red-600" 
                  : "bg-blue-600 hover:bg-blue-700"
              } shadow-lg hover:shadow-xl`}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              ) : isRecording ? (
                <MicOff className="h-6 w-6 text-white" />
              ) : (
                <Mic className="h-6 w-6 text-white" />
              )}
              
              <span className="absolute -bottom-8 text-sm font-medium text-gray-700">
                {isRecording ? "End Call" : "Start Call"}
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
