// lib/calComService.ts

const TEST_CONFIG = {
  apiKey: "cal_live_9fd6b017a51050b542dab625142d3c91",
  eventTypeId: "1694706",
  userId: "kushal-raju",
  apiUrl: "https://api.cal.com/v1",
};

export interface CalComBookingResponse {
  uid: string;
  responses: any;
  startTime: string;
  endTime: string;
  references?: Array<{
    type: string;
    meetingUrl?: string;
  }>;
}

export class CalComService {
  private static instance: CalComService;
  private apiKey: string;
  private readonly API_URL: string;
  private readonly EVENT_TYPE_ID: string;
  private readonly USER_ID: string;

  private constructor() {
    this.apiKey = TEST_CONFIG.apiKey;
    this.API_URL = TEST_CONFIG.apiUrl;
    this.EVENT_TYPE_ID = TEST_CONFIG.eventTypeId;
    this.USER_ID = TEST_CONFIG.userId;
  }

  public static getInstance(): CalComService {
    if (!CalComService.instance) {
      CalComService.instance = new CalComService();
    }
    return CalComService.instance;
  }

  public async createEvent(
    date: string,
    time: string,
    email: string,
    name: string,
    concerns: string = ""
  ): Promise<CalComBookingResponse> {
    try {
      // Convert IST to UTC
      const [hours, minutes] = time.split(":");
      const istDate = new Date(`${date}T${hours}:${minutes}:00+05:30`);
      const utcStartTime = istDate.toISOString().slice(0, 19);

      // Calculate UTC end time (30 minutes later)
      const utcEndDate = new Date(istDate.getTime() + 30 * 60000);
      const utcEndTime = utcEndDate.toISOString().slice(0, 19);

      const payload = {
        responses: {
          name: name, // Use the actual patient name
          email: email,
          location: {
            value: "integrations:google:meet",
            optionValue: "",
          },
          notes: concerns || "Mental health consultation appointment",
          guests: [],
        },
        user: this.USER_ID,
        start: utcStartTime,
        end: utcEndTime,
        eventTypeId: parseInt(this.EVENT_TYPE_ID),
        eventTypeSlug: "30min",
        timeZone: "Asia/Calcutta",
        language: "en",
        metadata: {},
        hasHashedBookingLink: false,
        routedTeamMemberIds: null,
        skipContactOwner: false,
        _isDryRun: false,
      };

      console.log("Booking payload:", payload);

      // In a client-side component, we need to make the request through our own API endpoint
      const response = await fetch("/api/cal/create-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Failed to create Cal.com booking: ${
            errorData.message || response.statusText
          }`
        );
      }

      const booking = await response.json();
      console.log("Cal.com booking created:", booking);
      return booking;
    } catch (error) {
      console.error("Error creating Cal.com booking:", error);
      throw error;
    }
  }
}
