import { Button } from "./ui/button"

type NavKey = "orders" | "customers"

export function NavigationMenu({ active, onChange }: { active: NavKey; onChange: (key: NavKey) => void }) {
  return (
    <nav className="flex gap-2 bg-white border border-slate-200 rounded-full p-1 shadow-sm">
      <Button
        variant={active === "orders" ? "secondary" : "ghost"}
        size="sm"
        className="rounded-full px-4"
        onClick={() => onChange("orders")}
      >
        Pedidos
      </Button>
      <Button
        variant={active === "customers" ? "secondary" : "ghost"}
        size="sm"
        className="rounded-full px-4"
        onClick={() => onChange("customers")}
      >
        Clientes
      </Button>
    </nav>
  )
}
