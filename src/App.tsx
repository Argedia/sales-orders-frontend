import { useState } from "react"
import CustomerView from "./components/CustomerView"
import OrdersView from "./components/OrdersView"
import { NavigationMenu } from "./components/NavigationMenu"
import { Toaster } from "./components/ui/sonner"

function App() {
  const [tab, setTab] = useState<"orders" | "customers">("orders")
  const title = tab === "orders" ? "Gestión de pedidos" : "Gestión de clientes"
  const subtitle =
    tab === "orders"
      ? "Crea, edita y cancela pedidos de repuestos."
      : "Agrega, edita y consulta clientes."

  return (
    <div className="min-h-screen px-4 py-8 sm:px-8 lg:px-16">
      <header className="max-w-5xl mx-auto mb-6">
        <p className="text-sm uppercase tracking-[0.18em] text-sky-700 font-semibold">Panel de ventas</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-2">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">{title}</h1>
            <p className="text-slate-600 mt-2 max-w-3xl">{subtitle}</p>
          </div>
          <NavigationMenu active={tab} onChange={setTab} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto">
        {tab === "orders" ? <OrdersView /> : <CustomerView />}
      </main>
      <Toaster position="bottom-center" richColors />
    </div>
  )
}

export default App
