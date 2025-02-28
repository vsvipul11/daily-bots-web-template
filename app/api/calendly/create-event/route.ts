// app/api/calendly/create-event/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { email, name, startTime, concerns } = await request.json();

  if (!email || !name || !startTime) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  try {
    const apiKey = process.env.CALENDLY_API_KEY;
    const eventTypeUrl = process.env.CALENDLY_EVENT_TYPE_URL;

    if (!apiKey || !eventTypeUrl) {
      throw new Error('Missing Calendly configuration');
    }

    // Create a scheduled event with Calendly API
    const response = await fetch('https://api.calendly.com/scheduled_events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        event_type_url: eventTypeUrl,
        start_time: startTime,
        event_memberships: [],
        invitee: {
          email,
          name
        },
        questions_and_answers: [
          {
            question: 'What are your main mental health concerns?',
            answer: concerns || 'Not specified'
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Calendly API error: ${errorText}`);
    }

    const data = await response.json();

    // Generate Google Meet link for the event
    const meetLink = await createGoogleMeetLink(email, name, startTime, concerns);

    // Add the meeting link to the response
    const eventData = {
      ...data,
      event: {
        ...data.event,
        location: {
          type: 'google_meet',
          join_url: meetLink
        }
      }
    };

    return NextResponse.json(eventData);
  } catch (error) {
    console.error('Error creating Calendly event:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create appointment' },
      { status: 500 }
    );
  }
}

// Function to create a Google Meet link
// In a real implementation, this would use Google Calendar API
async function createGoogleMeetLink(
  email: string,
  name: string,
  startTime: string,
  concerns: string
): Promise<string> {
  // In a production environment, you would use Google Calendar API to create a meeting
  // This is a placeholder that creates a dummy meet link
  const meetingId = Math.random().toString(36).substring(2, 12);
  return `https://meet.google.com/${meetingId}`;
}
