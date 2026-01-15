import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import clsx from "clsx"
import { Button } from "./ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"
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
import { createCustomer, deleteCustomer, getCustomers, updateCustomer, type Customer, type CustomerPayload } from "../api/endpoints"

const customerSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  contactName: z.string().min(2, "Contacto requerido"),
  email: z.string().email("Correo inválido"),
  phone: z.string().min(7, "Teléfono requerido"),
  address: z.string().optional(),
  city: z.string().optional(),
  taxId: z.string().optional(),
})

type CustomerFormValues = z.infer<typeof customerSchema>

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={clsx(
      "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100 disabled:text-slate-500",
      className,
    )}
    {...props}
  />
)

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="text-sm font-medium text-slate-700">{children}</label>
)

export default function CustomerView() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null)
  const [search, setSearch] = useState("")
  const filteredCustomers = useMemo(
    () =>
      customers.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.contactName.toLowerCase().includes(search.toLowerCase()),
      ),
    [customers, search],
  )

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      contactName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      taxId: "",
    },
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const list = await getCustomers()
        setCustomers(list)
      } catch (err) {
        setError("No se pudieron cargar los clientes")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const onSubmit = async (data: CustomerFormValues) => {
    setError("")
    setLoading(true)
    try {
      const payload: CustomerPayload = data
      if (selectedCustomer) {
        const updated = await updateCustomer(selectedCustomer.id, payload)
        setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        toast.success("Cliente actualizado")
      } else {
        const created = await createCustomer(payload)
        setCustomers((prev) => [created, ...prev])
        toast.success("Cliente creado")
      }
      reset()
      setSelectedCustomer(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el cliente")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}

      <div className="card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{selectedCustomer ? "Editar cliente" : "Crear cliente"}</h2>
            <p className="text-sm text-slate-600">Datos alineados al rubro de repuestos: contacto, impuestos y logística.</p>
          </div>
          {selectedCustomer && (
            <Button
              variant="ghost"
              onClick={() => {
                reset()
                setSelectedCustomer(null)
              }}
              disabled={loading}
            >
              Nuevo cliente
            </Button>
          )}
        </div>

        <form className="grid grid-cols-1 sm:grid-cols-2 gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <Label>RUC</Label>
            <Input placeholder="20123456789" disabled={loading} {...register("taxId")} />
          </div>
          <div>
            <Label>Razón social</Label>
            <Input placeholder="Autopartes Norte" disabled={loading} {...register("name")} />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <Label>Nombre contacto</Label>
            <Input placeholder="Laura Gómez" disabled={loading} {...register("contactName")} />
            {errors.contactName && <p className="text-xs text-red-600 mt-1">{errors.contactName.message}</p>}
          </div>
          <div>
            <Label>Correo</Label>
            <Input placeholder="contacto@empresa.com" disabled={loading} {...register("email")} />
            {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input placeholder="+57 3001234567" disabled={loading} {...register("phone")} />
            {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone.message}</p>}
          </div>
          <div>
            <Label>Dirección</Label>
            <Input placeholder="Av. Central 123" disabled={loading} {...register("address")} />
          </div>
          <div>
            <Label>Ciudad</Label>
            <Input placeholder="Bogotá" disabled={loading} {...register("city")} />
          </div>
          <div className="flex items-end justify-end">
            <Button type="submit" disabled={!isValid || isSubmitting || loading}>
              Guardar cliente
            </Button>
          </div>
        </form>
      </div>

      <div className="card p-5 sm:p-6 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Input
              placeholder="Buscar por cliente o contacto"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={loading}
            />
          </div>
          <span className="text-sm text-slate-500">{customers.length} registros</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>RUC</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((c) => (
                <TableRow key={c.id} className="bg-white">
                  <TableCell className="font-semibold text-slate-900">{c.name}</TableCell>
                  <TableCell>{c.contactName}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell>{c.city || "-"}</TableCell>
                  <TableCell>{c.taxId || "-"}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          Acciones
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Cliente</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedCustomer(c)
                            reset({
                              name: c.name,
                              contactName: c.contactName,
                              email: c.email,
                              phone: c.phone,
                              address: c.address || "",
                              city: c.city || "",
                              taxId: c.taxId || "",
                            })
                          }}
                        >
                          Ver / Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => setConfirmDelete(c)}>
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filteredCustomers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500 py-4">
                    Sin clientes aún
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {loading && <p className="text-sm text-slate-500 mt-2">Cargando clientes...</p>}
        </div>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar cliente</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que deseas eliminar este cliente? Si tiene pedidos relacionados, no podrá eliminarse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDelete) return
                try {
                  await deleteCustomer(confirmDelete.id)
                  setCustomers((prev) => prev.filter((c) => c.id !== confirmDelete.id))
                  toast.success("Cliente eliminado")
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "No se pudo eliminar el cliente")
                } finally {
                  setConfirmDelete(null)
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
