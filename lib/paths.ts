// Storage object paths: profile/<file>  or  projects/<project-uuid>/<file>
const FILE = "[A-Za-z0-9_-]{1,80}\\.(webp|jpe?g|png|avif)";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const VALID = new RegExp(`^(profile/${FILE}|projects/${UUID}/${FILE})$`);

export const isValidObjectPath = (p: string) => VALID.test(p);

/** Public URL for an image, served through the /media route (which enforces visibility rules). */
export const mediaUrl = (path: string) => `/media/${path}`;

export function newObjectName(ext = "webp") {
  return `${crypto.randomUUID().replace(/-/g, "")}.${ext}`;
}
