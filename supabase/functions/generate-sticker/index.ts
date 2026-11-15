// Supabase Edge Function: Stil-Sabitli Anlık AI Çıkartma Üretici & Ortak Havuz Kaydedici
// Çalıştırma: supabase functions serve generate-sticker

const STYLE_LOCK_TEMPLATE = (conceptEn: string, departmentContext: string) =>
  `Educational hand-drawn illustration sticker of ${conceptEn} (${departmentContext}), bold clean dark ink outlines, vibrant marker and watercolor shading, isolated on pure solid white background, centered composition, zero text, zero letters, clean die-cut vector feel`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { conceptTr, conceptEn, department } = await req.json();
    const prompt = STYLE_LOCK_TEMPLATE(
      conceptEn || conceptTr || 'academic concept',
      department || 'general education'
    );

    const falKey = Deno.env.get('FAL_KEY');
    if (!falKey) {
      return new Response(
        JSON.stringify({
          error: 'FAL_KEY not configured on Edge Function',
          promptUsed: prompt,
        }),
        {
          status: 501,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const aiResponse = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        Authorization: `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: 'square',
        num_inference_steps: 4,
        num_images: 1,
      }),
    });

    const result = await aiResponse.json();
    const imageUrl = result?.images?.[0]?.url ?? null;

    return new Response(
      JSON.stringify({
        imageUrl,
        promptUsed: prompt,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
