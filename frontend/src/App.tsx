import { AuthProvider } from "@/contexts/auth-context"
import { QueryProvider } from "@/providers/query-provider"
import { AppRoutes } from "@/routes/appRoutes"
import { BrowserRouter } from "react-router-dom"

export function App() {
  return (
    <BrowserRouter>
      <QueryProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </QueryProvider>
    </BrowserRouter>
  )
}
