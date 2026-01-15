const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080"

type RequestOptions = RequestInit & {
  headers?: Record<string, string>
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  }

  const response = await fetch(`${baseURL}${path}`, { ...options, headers })

  let data: unknown = null
  try {
    data = await response.json()
  } catch (_err) {
    data = null
  }

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message || "Error inesperado"
    const error = new Error(message) as Error & { status?: number; body?: unknown }
    error.status = response.status
    error.body = data
    throw error
  }

  return data as T
}
