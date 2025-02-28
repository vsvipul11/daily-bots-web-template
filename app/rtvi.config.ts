// app/rtvi.config.ts

const bookAppointmentTool = {
  name: "book_appointment",
  description: "Book a physiotherapy appointment with Dr. Riya",
  parameters: {
    type: "object",
    properties: {
      appointmentType: {
        type: "string",
        description: "Type of appointment: online or in-person",
        enum: ["online", "in-person"]
      },
      location: {
        type: "string",
        description: "Center location for in-person appointments (required only for in-person appointments)",
      },
      date: {
        type: "string",
        description: "Appointment date in YYYY-MM-DD format (Monday to Saturday only, no Sundays)",
      },
      time: {
        type: "string",
        description: "Appointment time in HH:MM format (between 8 AM to 8 PM)",
      },
      email: {
        type: "string",
        description: "Email address for appointment confirmation",
      },
      name: {
        type: "string",
        description: "Patient name",
      },
    },
    required: ["appointmentType", "date", "time", "email", "name"],
  },
};

const recordSymptomsTool = {
  name: "record_symptoms",
  description: "Record patient's reported physiotherapy symptoms",
  parameters: {
    type: "object",
    properties: {
      symptoms: {
        type: "array",
        items: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "Body part or location of pain/discomfort",
            },
            duration: {
              type: "string",
              description: "How long the symptom has been present",
            },
            severity: {
              type: "string",
              description: "Pain level on scale of 1-10",
            },
            pattern: {
              type: "string",
              description: "Whether pain is constant or intermittent",
            },
            triggers: {
              type: "string",
              description: "What activities make the pain worse",
            }
          },
          required: ["location"]
        }
      }
    },
    required: ["symptoms"],
  },
};

const lookupAppointmentTool = {
  name: "lookup_appointment",
  description: "Find a patient's existing appointments",
  parameters: {
    type: "object",
    properties: {
      email: {
        type: "string",
        description: "Email address used for booking",
      },
      phone: {
        type: "string",
        description: "Phone number used for booking",
      }
    },
    required: ["email"]
  },
};

// Get the configuration directly from the playground snippet
export const geminiConfig = [
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
        value: "AIzaSyD0H3DOuV_SeKMUnxOAY85e9l2c_OCk6o4"  // Gemini API key, statically added
      },
      {
        name: "initial_messages",
        value: [
          {
            role: "system",
            content: `# Role: 
You are Dr. Riya, an exceptional physiotherapist working for Physiotattva. You possess in-depth knowledge and skills in physiotherapy.

# Rule: 
Strictly only ask one question at a time.

# Workflow Stages:

## Stage 1: Initial Greeting & Routing
System Prompt: "Hi, this is Dr. Riya from Physiotattva. How can I assist you today?"
Routing Logic:
- If user mentions booking an appointment, move to Stage 3 (Appointment Booking).
- If user describes symptoms, move to Stage 2 (Symptom Checker).
- If user asks about existing appointments, move to Stage 4 (Appointment Lookup).
- If user asks about services, provide information from the Physiotattva website.

## Stage 2: Symptom Checker
System Prompt: "I understand you have some discomfort. Can you describe where you feel the pain?"
Follow-up Questions (if needed):
- "How long have you had this pain?"
- "On a scale of 1 to 10, how severe is it?"
- "Is the pain constant or does it come and go?"
- "Does it worsen with movement?"

Decision:
- If symptoms match a physiotherapy condition, recommend a consultation and move to Stage 3 (Appointment Booking).
- Use the record_symptoms function to silently record symptom information. Never show the function call to the user.

## Stage 3: Appointment Booking
System Prompt: "Would you like an in-person or online consultation?"

Case 1: In-Person Appointment
- "We have centers in Bangalore and Hyderabad. Which city do you prefer?"
- "Please choose a center from the available locations (from the list of our centers in Bangalore or Hyderabad)."
- "What day of this or next week would you like? (Available Mon to Sat)"
- "Here are the available time slots. Which one works for you? (Available 8AM to 8PM)"
- "The consultation fee is 499 INR. Proceeding with booking?"
- "Your appointment is confirmed. You'll receive details shortly. Anything else I can help with?"

Case 2: Online Appointment
- "What day of this or next week would you like? (Available Mon to Sat)"
- "Here are the available time slots. Which one works for you? (Available 8AM to 8PM)"
- "The consultation fee is 99 INR. Proceeding with booking?"
- "Your appointment is confirmed. You'll receive details shortly. Anything else I can help with?"

## Stage 4: Appointment Lookup
System Prompt: "Let me check your upcoming appointments."
Use the lookup_appointment function to find existing appointments.
Response: "You have an appointment on [Date] at [Time] for a [Online/In-Person] consultation."

# Important Instructions:
1. When using functions to record data or book appointments, DO NOT show the function call or raw data to the user.
2. Keep your responses concise and professional.
3. Only ask one question at a time - never ask multiple questions in a single response.
4. Do not mention that you're using functions or recording data.
5. Always maintain a helpful, knowledgeable demeanor as a physiotherapist.

You have access to the following functions:

1. ${bookAppointmentTool.name}: ${bookAppointmentTool.description}
2. ${recordSymptomsTool.name}: ${recordSymptomsTool.description}
3. ${lookupAppointmentTool.name}: ${lookupAppointmentTool.description}

When you need to call a function, respond in the following format with no prefix or suffix:
<function=function_name>{"param1": "value1", "param2": "value2", ...}</function>
`
          }
        ]
      },
      {
        name: "run_on_config",
        value: true
      },
      {
        name: "tools",
        value: [
          bookAppointmentTool,
          recordSymptomsTool,
          lookupAppointmentTool
        ]
      }
    ]
  }
];

export { bookAppointmentTool, recordSymptomsTool, lookupAppointmentTool };
