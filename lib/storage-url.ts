/**
 * Public URLs for files in the Supabase Storage bucket. No secrets here: the bucket is public
 * and every key is a server-generated UUID path, so these URLs are safe to render anywhere.
 */
const base = () => {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error("SUPABASE_URL is not set.");
  return `${url}/storage/v1/object/public/${process.env.SUPABASE_BUCKET ?? "brand-assets"}`;
};

export const publicUrl = (key: string) => `${base()}/${key}`;

/** Same file, served with `Content-Disposition: attachment` so it saves as `name`. */
export const downloadUrl = (key: string, name: string) => `${publicUrl(key)}?download=${encodeURIComponent(name)}`;
