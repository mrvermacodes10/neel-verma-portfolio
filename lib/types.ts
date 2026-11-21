export type Layout = "full" | "left" | "right";

export interface Profile {
  id: number;
  name: string;
  intro: string;
  email: string | null;
  photo_path: string | null;
  photo_width: number | null;
  photo_height: number | null;
  photo_blur: string | null;
  updated_at: string;
}

export interface ProjectImage {
  id: string;
  project_id: string;
  path: string;
  width: number | null;
  height: number | null;
  blur: string | null;
  alt: string;
  position: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  url: string | null;
  github_url: string | null;
  layout: Layout;
  cover_path: string | null;
  cover_width: number | null;
  cover_height: number | null;
  cover_blur: string | null;
  position: number;
  published: boolean;
  created_at: string;
  updated_at: string;
  project_images: ProjectImage[];
}
