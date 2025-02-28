// lib/calendlyService.ts

export interface CalendlyEvent {
  id: string;
  start_time: string;
  end_time: string;
  location: {
    type: string;
    join_url?: string;
  };
  invitee: {
    email: string;
    name: string;
  };
  cancellation_url?: string;
  reschedule_url?: string;
}

export interface CalendlyEventResponse {
  event: CalendlyEvent;
  meetingUrl?: string;
}

class CalendlyService {
  private static instance: CalendlyService;
  private apiKey: string;
  private organizationUrl: string;
  private eventTypeUrl: string;

  private constructor() {
    this.apiKey = process.env.CALENDLY_API_KEY || '';
    this.organizationUrl = process.env.CALENDLY_ORGANIZATION_URL || '';
    this.eventTypeUrl = process.env.CALENDLY_EVENT_TYPE_URL || '';
  }

  public static getInstance(): CalendlyService {
    if (!CalendlyService.instance) {
      CalendlyService.instance = new CalendlyService();
    }
    return CalendlyService.instance;
  }

  public async createAppointment(
    date: string, 
    time: string, 
    email: string, 
    name: string, 
    concerns: string = ""
  ): Promise<CalendlyEventResponse> {
    try {
      // Convert date and time to UTC ISO format
      const appointmentDateTime = new Date(`${date}T${time}`);
      
      // Format for Calendly API
      const startTime = appointmentDateTime.toISOString();
      
      // Create appointment with Calendly
      const response = await fetch('/api/calendly/create-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          name,
          startTime,
          concerns
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create appointment: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        event: data.event,
        meetingUrl: data.event.location.join_url
      };
    } catch (error) {
      console.error('Error creating Calendly appointment:', error);
      throw error;
    }
  }
}

export default CalendlyService;
