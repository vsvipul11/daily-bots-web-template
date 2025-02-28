// app/api/cal/create-booking/route.ts
import { NextResponse } from 'next/server';

const TEST_CONFIG = {
  apiKey: "cal_live_9fd6b017a51050b542dab625142d3c91",
  eventTypeId: "1694706",
  userId: "kushal-raju",
  apiUrl: "https://api.cal.com/v1",
};

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    // Log the received request for debugging
    console.log("Creating Cal.com booking with payload:", payload);

    // Make the actual request to Cal.com API
    const response = await fetch(
      `${TEST_CONFIG.apiUrl}/bookings?apiKey=${TEST_CONFIG.apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Cal.com API error: ${errorText}`);
      return NextResponse.json(
        { error: `Cal.com API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    // Parse the response and add a Google Meet link if not present
    const booking = await response.json();
    
    // Check if there's already a meeting URL in the booking
    let meetingUrl = null;
    if (booking.references) {
      const meetingRef = booking.references.find(
        (ref: any) => ref.type === "google_meet_video"
      );
      if (meetingRef && meetingRef.meetingUrl) {
        meetingUrl = meetingRef.meetingUrl;
      }
    }
    
    // If no meeting URL is provided by Cal.com, generate a placeholder
    if (!meetingUrl) {
      const meetingId = Math.random().toString(36).substring(2, 12);
      meetingUrl = `https://meet.google.com/${meetingId}`;
      
      // Add the meeting URL to the booking response
      if (!booking.references) {
        booking.references = [];
      }
      
      booking.references.push({
        type: "google_meet_video",
        meetingUrl: meetingUrl
      });
    }
    
    console.log("Cal.com booking created successfully:", booking);
    return NextResponse.json(booking);
  } catch (error: unknown) {
    console.error("Error in Cal.com booking API route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create booking" },
      { status: 500 }
    );
  }
}
