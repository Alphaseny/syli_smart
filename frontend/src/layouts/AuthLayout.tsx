import { Outlet } from "react-router-dom"

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex h-[500px] w-full max-w-[80%] items-center justify-center gap-5 overflow-hidden rounded-md border border-border/50 bg-card p-8 py-10 shadow-lg shadow-black/5">
        <div className="hidden flex-1 space-y-3 pb-6 text-center lg:block">
          <p className="text-sm font-bold tracking-[0.3em] text-primary uppercase">
            Smart Bureau
          </p>
          <h1 className="text-3xl font-bold text-foreground">Accès sécurisé</h1>
          <p className="text-sm font-semibold text-muted-foreground">
            Centralisez la gestion de votre bureau intelligent depuis une
            plateforme unique, sécurisée et accessible à tout moment.
          </p>
        </div>
        <div className="flex h-full w-full items-center lg:w-[450px]">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
