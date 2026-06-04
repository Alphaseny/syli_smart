import { useAuthContext } from "@/contexts/auth-context"
import { useState } from "react"

export function usePasswordReset() {
  const [isLoading, setLoading] = useState(false)
  const { resetPassword } = useAuthContext()

  const requestPasswordReset = async (email: string) => {
    setLoading(true)
    try {
      void email
      return await resetPassword()
    } finally {
      setLoading(false)
    }
  }

  return { resetPassword: requestPasswordReset, isLoading }
}
