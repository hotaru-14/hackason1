import { NextRequest, NextResponse } from 'next/server';
import { mastra } from '@/mastra';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    console.log(`[Deep Paper API] Starting research for: "${message}"`);
    
    // Get the deep paper agent
    const agent = mastra.getAgent('deepPaperAgent');
    
    if (!agent) {
      return NextResponse.json(
        { error: 'Deep paper agent not found' },
        { status: 500 }
      );
    }

    // Start the research with streaming response
    const response = await agent.stream([
      {
        role: 'user',
        content: message,
      },
    ]);

    // Create a readable stream for the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response.textStream) {
            // Send chunk as Server-Sent Events format
            const data = `data: ${JSON.stringify({ chunk })}\n\n`;
            controller.enqueue(new TextEncoder().encode(data));
          }
          
          // Send completion signal
          const endData = `data: ${JSON.stringify({ done: true })}\n\n`;
          controller.enqueue(new TextEncoder().encode(endData));
          
          controller.close();
        } catch (error) {
          console.error('[Deep Paper API] Stream error:', error);
          const errorData = `data: ${JSON.stringify({ 
            error: error instanceof Error ? error.message : 'Unknown error' 
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(errorData));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('[Deep Paper API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 