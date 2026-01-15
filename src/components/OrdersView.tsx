import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Badge as UiBadge } from "./ui/badge"
import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog"
import { Separator } from "./ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"
import { Input } from "./ui/input"
import OrderForm from "./OrderForm"
import { cancelOrder, listOrders, type OrderResponse, type OrderStatus } from "../api/endpoints"
import { toast } from "sonner"

type ViewMode = "list" | "form"

const statusVariant: Record<OrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  CONFIRMED: "default",
  CANCELLED: "destructive",
}

const statusLabel: Record<OrderStatus, string> = {
  DRAFT: "Borrador",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
}

export default function OrdersView() {
  const [orders, setOrders] = useState<OrderResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [mode, setMode] = useState<ViewMode>("list")
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [cancelTarget, setCancelTarget] = useState<OrderResponse | null>(null)
  const [search, setSearch] = useState("")
  const [searchField, setSearchField] = useState<"order" | "customer">("order")
  const [cancelReason, setCancelReason] = useState<import("../api/endpoints").CancelReason | "">("")
  const [cancelNote, setCancelNote] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [includeCancelled, setIncludeCancelled] = useState(false)

  const loadOrders = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await listOrders(includeCancelled)
      setOrders(data)
    } catch (err) {
      setError("No se pudieron cargar los pedidos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [includeCancelled])

  const handleOpenForm = (id?: string) => {
    setSelectedId(id)
    setMode("form")
  }

  const handleCancelOrder = async () => {
    if (!cancelTarget || !cancelReason) return
    try {
      await cancelOrder(cancelTarget.id, { reason: cancelReason, note: cancelNote || undefined })
      toast.success("Pedido cancelado")
      setCancelTarget(null)
      setCancelReason("")
      setCancelNote("")
      await loadOrders()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cancelar el pedido")
    }
  }

  const rows = useMemo(
    () =>
      orders
        .filter((o) => {
          const term = search.toLowerCase()
          if (!term) return true
          return searchField === "order"
            ? o.orderNumber.toLowerCase().includes(term)
            : o.customerName.toLowerCase().includes(term)
        })
        .map((order) => ({
          ...order,
          formattedDate: format(new Date(order.orderDate), "dd MMM yyyy", { locale: es }),
          formattedDelivery: order.deliveryDate ? format(new Date(order.deliveryDate), "dd MMM yyyy", { locale: es }) : "-",
        })),
    [orders, search],
  )

  if (mode === "form") {
    return (
      <OrderForm
        orderIdToLoad={selectedId}
        onBack={() => setMode("list")}
        onSaved={async () => {
          await loadOrders()
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-80"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-36 justify-between">
                  {searchField === "order" ? "Por orden" : "Por cliente"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setSearchField("order")}>Por orden</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSearchField("customer")}>Por cliente</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex items-center gap-3 justify-end">
          <Button variant="outline" onClick={() => setShowFilters((v) => !v)}>
            {showFilters ? "Ocultar filtros" : "Mostrar filtros"}
          </Button>
          <Button onClick={() => handleOpenForm(undefined)}>Crear pedido</Button>
        </div>
      </div>

      {showFilters && (
        <>
          <Separator className="my-3" />
          <div className="card p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <input
                  id="include-cancelled"
                  type="checkbox"
                  checked={includeCancelled}
                  onChange={(e) => setIncludeCancelled(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="include-cancelled" className="text-sm text-slate-700">
                  Incluir cancelados
                </label>
              </div>
            </div>
          </div>
        </>
      )}

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}

      <div className="card p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Orden</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Entrega</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Total</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((order) => (
              <TableRow key={order.id} className="bg-white">
                <TableCell className="font-semibold text-slate-900">{order.orderNumber}</TableCell>
                <TableCell>{order.customerName}</TableCell>
                <TableCell>{order.formattedDate}</TableCell>
                <TableCell>{order.formattedDelivery}</TableCell>
                <TableCell>
                  <UiBadge variant={statusVariant[order.status]}>{statusLabel[order.status]}</UiBadge>
                </TableCell>
                <TableCell className="font-semibold">${order.orderTotal.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">Acciones</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Pedido</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleOpenForm(order.id)}>Ver / Editar</DropdownMenuItem>
                      {order.status !== "CANCELLED" && (
                        <DropdownMenuItem className="text-red-600" onClick={() => setCancelTarget(order)}>
                          Eliminar (cancelar)
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-500 py-6">
                  No hay pedidos aún
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {loading && <p className="text-sm text-slate-500 mt-2">Cargando pedidos...</p>}
      </div>

      <AlertDialog open={!!cancelTarget} onOpenChange={() => setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pedido</AlertDialogTitle>
            <AlertDialogDescription>
            El pedido quedará cancelado y oculto de la lista principal. Elige un motivo y, si es “Otro”, agrégalo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Motivo</label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value as typeof cancelReason)}
              >
                <option value="">Selecciona un motivo</option>
                <option value="CUSTOMER_REQUEST">Solicitud del cliente</option>
                <option value="STOCK_ISSUE">Sin stock disponible</option>
                <option value="PRICING_ERROR">Error de precio</option>
                <option value="DUPLICATE">Pedido duplicado</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>
            {cancelReason === "OTHER" && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Detalle</label>
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  placeholder="Describe el motivo"
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                />
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelOrder}
              className="bg-red-600 hover:bg-red-700"
              disabled={!cancelReason}
            >
              Cancelar pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
