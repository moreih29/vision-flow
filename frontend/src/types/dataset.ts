export interface Dataset {
  id: number
  name: string
  description: string | null
  project_id: number
  created_at: string
  updated_at: string
  image_count: number
}
