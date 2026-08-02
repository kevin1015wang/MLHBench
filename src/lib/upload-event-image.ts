// Uploads an event image to the "event-images" Supabase Storage bucket and
// returns its public URL for storing in events.logo_url.
export async function uploadEventImage(file: File): Promise<string> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();

  const extension = file.name.split(".").pop() || "png";
  const path = `${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from("event-images")
    .upload(path, file, { contentType: file.type, upsert: true });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from("event-images").getPublicUrl(path);

  return publicUrl;
}
