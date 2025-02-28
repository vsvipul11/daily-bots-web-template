import axios from "axios";

export class CalComService {
  private static instance: CalComService;
  private api: any;

  private constructor() {
    this.api = axios.create({
      baseURL: "https://cal.com/api",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer YOUR_CALCOM_API_KEY`, // Replace with your Cal.com API key
      },
    });
  }

  public static getInstance(): CalComService {
    if (!CalComService.instance) {
      CalComService.instance = new CalComService();
    }
    return CalComService.instance;
  }

  public async createEvent(date: string, time: string, email: string, name: string, concerns: string) {
    try {
      const response = await this.api.post("/bookings", {
        date,
        time,
        email,
        name,
        concerns,
      });
      return response.data;
    } catch (error) {
      console.error("Error creating event:", error);
      throw error;
    }
  }
}
