import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react"
import { forwardRef, useEffect, useMemo, useState } from "react"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { z } from "zod"
import clsx from "clsx"
import { ArrowLeft } from "lucide-react"
import { Button } from "./ui/button"
import {
  confirmOrder,
  createOrder,
  getCustomers,
  getOrderById,
  getProducts,
  updateOrder,
  type Customer,
  type OrderResponse,
  type OrderStatus,
  type Product,
} from "../api/endpoints"

const dateString = z
  .string({ required_error: "La fecha es requerida" })
  .min(1, "La fecha es requerida")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), { message: "Fecha inválida" })

const orderSchema = z
  .object({
    customerId: z.string().min(1, "Selecciona un cliente"),
    orderDate: dateString,
    deliveryDate: dateString,
    lines: z
      .array(
        z.object({
          productId: z.string().min(1, "El producto es requerido"),
          quantity: z.coerce.number({ required_error: "Cantidad requerida" }).int().min(1, "Mínimo 1"),
          unitPrice: z.coerce.number({ required_error: "Precio requerido" }).gt(0, "Debe ser mayor que 0"),
          discountPct: z
            .coerce.number({ required_error: "Descuento requerido" })
            .min(0, "Mínimo 0")
            .max(100, "Máximo 100"),
        }),
      )
      .min(1, "Agrega al menos una línea"),
  })
  .superRefine((data, ctx) => {
    const deliveryDate = new Date(data.deliveryDate)
    const orderDate = new Date(data.orderDate)
    if (!Number.isNaN(deliveryDate.getTime()) && !Number.isNaN(orderDate.getTime()) && deliveryDate < orderDate) {
      ctx.addIssue({
        code: "custom",
        message: "La fecha de entrega no puede ser anterior a la fecha del pedido",
        path: ["deliveryDate"],
      })
    }
    const seen = new Set<string>()
    data.lines.forEach((line, idx) => {
      if (seen.has(line.productId)) {
        ctx.addIssue({
          code: "custom",
          message: "No se permiten productos duplicados",
          path: ["lines", idx, "productId"],
        })
      } else {
        seen.add(line.productId)
      }
    })
  })

type OrderFormValues = z.infer<typeof orderSchema>
type OrderFormProps = {
  orderIdToLoad?: string
  onBack?: () => void
  onSaved?: () => void
}

const today = () => new Date().toISOString().slice(0, 10)

const defaultValues: OrderFormValues = {
  customerId: "",
  orderDate: today(),
  deliveryDate: today(),
  lines: [
    {
      productId: "",
      quantity: 1,
      unitPrice: 0,
      discountPct: 0,
    },
  ],
}

type BadgeVariant = "neutral" | "success" | "warning"

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={clsx(
        "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100 disabled:text-slate-500",
        className,
      )}
      {...props}
    />
  )
})

const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={clsx(
          "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100 disabled:text-slate-500",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    )
  },
)

const Card = ({
  title,
  children,
  actions,
}: { title: string; actions?: ReactNode; children: ReactNode }) => (
  <div className="card p-5 sm:p-6 mb-4">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      </div>
      {actions}
    </div>
    {children}
  </div>
)

const Badge = ({ children, variant = "neutral" }: { children: ReactNode; variant?: BadgeVariant }) => {
  const styles: Record<BadgeVariant, string> = {
    neutral: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
  }
  return <span className={clsx("px-3 py-1 rounded-full text-xs font-semibold", styles[variant])}>{children}</span>
}

export default function OrderForm({ orderIdToLoad, onBack, onSaved }: OrderFormProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [orderId, setOrderId] = useState<string>("")
  const [orderNumber, setOrderNumber] = useState<string>("")
  const [status, setStatus] = useState<OrderStatus | null>("DRAFT")
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState("")

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isValid },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    mode: 'onChange',
    defaultValues,
  })

  const fieldArray = useFieldArray({
    name: 'lines',
    control,
  })
  type LineField = OrderFormValues['lines'][number] & { id: string }
  const fields = fieldArray.fields as LineField[]
  const append = fieldArray.append
  const remove = fieldArray.remove

  const lines = (useWatch({ control, name: 'lines' }) as OrderFormValues['lines']) ?? []
  const orderTotals = useMemo(() => {
    const totals = lines.map((line: OrderFormValues['lines'][number]) => {
      const qty = Number(line.quantity || 0)
      const price = Number(line.unitPrice || 0)
      const discount = Number(line.discountPct || 0) / 100
      const total = qty * price * (1 - discount)
      return Number.isFinite(total) ? total : 0
    })
    const orderTotal = totals.reduce((acc: number, v: number) => acc + v, 0)
    return { lineTotals: totals, orderTotal }
  }, [lines])

  const isConfirmed = status === 'CONFIRMED'

  useEffect(() => {
    const loadCatalogs = async () => {
      setLoading(true)
      try {
        const [c, p] = await Promise.all([getCustomers(), getProducts()])
        setCustomers(c)
        setProducts(p)
      } catch (err) {
        setApiError('No se pudieron cargar los catálogos')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadCatalogs()
  }, [])

  useEffect(() => {
    if (!orderIdToLoad) {
      reset(defaultValues)
      setOrderId('')
      setOrderNumber('')
      setStatus('DRAFT')
      setApiError('')
      return
    }
    setStatus(null)
    setOrderNumber('')
    setApiError('')
    const load = async () => {
      setLoading(true)
      try {
        const order = await getOrderById(orderIdToLoad)
        reset(mapResponseToForm(order))
        setOrderId(order.id)
        setOrderNumber(order.orderNumber)
        setStatus(order.status)
      } catch (err) {
        setApiError(err instanceof Error ? err.message : 'No se pudo cargar el pedido')
      } finally {
        setLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderIdToLoad])

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId)
    if (product) {
      const currentQty = getValues(`lines.${index}.quantity`)
      if (!currentQty) {
        setValue(`lines.${index}.quantity`, 1, { shouldValidate: true, shouldDirty: true })
      }
      setValue(`lines.${index}.unitPrice`, product.basePrice, { shouldValidate: true, shouldDirty: true })
      setValue(`lines.${index}.discountPct`, 0, { shouldValidate: true, shouldDirty: true })
    }
  }

  const mapResponseToForm = (order: OrderResponse): OrderFormValues => ({
    customerId: order.customerId,
    orderDate: order.orderDate,
    deliveryDate: order.deliveryDate,
    lines: order.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountPct: line.discountPct,
    })),
  })

  const onSubmit = async (formData: OrderFormValues) => {
    setApiError('')
    const payload = {
      ...formData,
      orderDate: formData.orderDate,
      deliveryDate: formData.deliveryDate,
      lines: formData.lines.map((l) => ({
        productId: l.productId,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        discountPct: Number(l.discountPct),
      })),
    }
    setLoading(true)
    try {
      const response = orderId ? await updateOrder(orderId, payload) : await createOrder(payload)
      setOrderId(response.id)
      setOrderNumber(response.orderNumber)
      setStatus(response.status)
      reset(mapResponseToForm(response))
      toast.success(orderId ? 'Pedido actualizado' : 'Pedido creado')
      onSaved?.()
    } catch (err) {
      if ((err as { status?: number }).status === 409) {
        setApiError('Pedido confirmado, no se puede editar')
        setStatus('CONFIRMED')
      } else {
        setApiError(err instanceof Error ? err.message : 'Error al guardar el pedido')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!orderId) {
      setApiError('Primero guarda el pedido antes de confirmar')
      return
    }
    setApiError('')
    setLoading(true)
    try {
      const response = await confirmOrder(orderId)
      setStatus(response.status)
      reset(mapResponseToForm(response))
      toast.success('Pedido confirmado')
      onSaved?.()
      onBack?.()
    } catch (err) {
      if ((err as { status?: number }).status === 404) {
        setApiError('Pedido no encontrado')
      } else if ((err as { status?: number }).status === 409) {
        setApiError('Pedido confirmado, no se puede editar')
      } else {
        setApiError(err instanceof Error ? err.message : 'No se pudo confirmar el pedido')
      }
    } finally {
      setLoading(false)
    }
  }

  const addLine = () => append({ productId: '', quantity: 1, unitPrice: 0, discountPct: 0 })

  const renderLineErrors = (lineIndex: number, fieldName: keyof OrderFormValues['lines'][number]) => {
    const message = errors.lines?.[lineIndex]?.[fieldName]?.message
    return message ? <p className="text-xs text-red-600 mt-1">{String(message)}</p> : null
  }

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          {onBack && (
            <Button variant="secondary" className="gap-2" onClick={onBack} disabled={loading}>
              <ArrowLeft className="h-4 w-4" />
              Volver a pedidos
            </Button>
          )}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 justify-end">
          <Badge variant={status ? (isConfirmed ? 'success' : 'warning') : 'neutral'}>
            Estado: {!status ? 'Cargando...' : isConfirmed ? 'Confirmado (solo lectura)' : 'Borrador (editable)'}
          </Badge>
        </div>
      </div>
      {apiError && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">{apiError}</div>}

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Card
          title="Cabecera del pedido"
          actions={
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Rellena los datos principales del pedido</span>
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Cliente</label>
              <Select disabled={isConfirmed || loading} {...register('customerId')}>
                <option value="">Selecciona un cliente</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              {errors.customerId && <p className="text-xs text-red-600 mt-1">{errors.customerId.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Fecha pedido</label>
                <Input type="date" disabled={isConfirmed || loading} {...register('orderDate')} />
                {errors.orderDate && <p className="text-xs text-red-600 mt-1">{errors.orderDate.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Fecha entrega</label>
                <Input type="date" disabled={isConfirmed || loading} {...register('deliveryDate')} />
                {errors.deliveryDate && <p className="text-xs text-red-600 mt-1">{errors.deliveryDate.message}</p>}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Número de pedido</label>
              <Input value={orderNumber || 'Se genera al guardar'} disabled />
            </div>
          </div>
        </Card>

        <Card
          title="Líneas del pedido"
        >
          {errors.lines?.message && <p className="text-sm text-red-600 mb-2">{errors.lines.message}</p>}

          {/* Tarjetas móviles (iOS friendly) */}
          <div className="md:hidden space-y-3 touch-manipulation">
            {fields.map((field, index) => {
              return (
                <div key={field.id} className="rounded-lg border border-slate-200 p-3 bg-white shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-slate-800">Línea {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() => remove(index)}
                      disabled={isConfirmed || loading}
                    >
                      Eliminar
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-slate-700">Producto</label>
                      <Controller
                        control={control}
                        name={`lines.${index}.productId`}
                        render={({ field: productField }: { field: any }) => (
                          <Select
                            value={productField.value || ""}
                            disabled={isConfirmed || loading}
                            className="pointer-events-auto"
                            onChange={(e) => {
                              productField.onChange(e.target.value)
                              handleProductSelect(index, e.target.value)
                            }}
                            onBlur={productField.onBlur}
                            name={productField.name}
                            ref={productField.ref}
                          >
                            <option value="">Selecciona...</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.code} - {p.name}
                              </option>
                            ))}
                          </Select>
                        )}
                      />
                      {renderLineErrors(index, 'productId')}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium text-slate-700">Cantidad</label>
                        <Controller
                          control={control}
                          name={`lines.${index}.quantity`}
                          render={({ field: quantityField }: { field: any }) => (
                            <Input
                              type="number"
                              min="1"
                              disabled={isConfirmed || loading}
                              className="pointer-events-auto"
                              value={quantityField.value ?? ""}
                              onChange={(e) => quantityField.onChange(e.target.value)}
                              onBlur={quantityField.onBlur}
                              name={quantityField.name}
                              ref={quantityField.ref}
                            />
                          )}
                        />
                        {renderLineErrors(index, 'quantity')}
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-700">Precio unitario</label>
                        <p className="text-slate-900">${Number(lines[index]?.unitPrice ?? 0).toFixed(2)}</p>
                        <input type="hidden" {...register(`lines.${index}.unitPrice`)} />
                        {renderLineErrors(index, 'unitPrice')}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 items-center">
                      <div>
                        <label className="text-xs font-medium text-slate-700">% Descuento</label>
                        <Controller
                          control={control}
                          name={`lines.${index}.discountPct`}
                          render={({ field: discountField }: { field: any }) => (
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              disabled={isConfirmed || loading}
                              className="pointer-events-auto"
                              value={discountField.value ?? ""}
                              onChange={(e) => discountField.onChange(e.target.value)}
                              onBlur={discountField.onBlur}
                              name={discountField.name}
                              ref={discountField.ref}
                            />
                          )}
                        />
                        {renderLineErrors(index, 'discountPct')}
                      </div>
                      <div className="text-sm text-slate-700">
                        <p className="font-medium">Total línea</p>
                        <p className="text-slate-900 font-semibold">
                          ${orderTotals.lineTotals[index]?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Tabla desktop / tablets */}
          <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2 w-24">Cantidad</th>
                  <th className="px-3 py-2 w-32">Precio unit.</th>
                  <th className="px-3 py-2 w-28">% Desc.</th>
                  <th className="px-3 py-2 w-28">Total línea</th>
                  <th className="px-3 py-2 w-24" />
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => {
                  return (
                    <tr key={field.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <Controller
                          control={control}
                          name={`lines.${index}.productId`}
                          render={({ field: productField }: { field: any }) => (
                            <Select
                              value={productField.value || ""}
                              disabled={isConfirmed || loading}
                              onChange={(e) => {
                                productField.onChange(e.target.value)
                                handleProductSelect(index, e.target.value)
                              }}
                              onBlur={productField.onBlur}
                              name={productField.name}
                              ref={productField.ref}
                            >
                              <option value="">Selecciona...</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.code} - {p.name}
                                </option>
                              ))}
                            </Select>
                          )}
                        />
                        {renderLineErrors(index, 'productId')}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Controller
                          control={control}
                          name={`lines.${index}.quantity`}
                          render={({ field: quantityField }: { field: any }) => (
                            <Input
                              type="number"
                              min="1"
                              disabled={isConfirmed || loading}
                              value={quantityField.value ?? ""}
                              onChange={(e) => quantityField.onChange(e.target.value)}
                              onBlur={quantityField.onBlur}
                              name={quantityField.name}
                              ref={quantityField.ref}
                            />
                          )}
                        />
                        {renderLineErrors(index, 'quantity')}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <p className="text-slate-900">${Number(lines[index]?.unitPrice ?? 0).toFixed(2)}</p>
                        <input type="hidden" {...register(`lines.${index}.unitPrice`)} />
                        {renderLineErrors(index, 'unitPrice')}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Controller
                          control={control}
                          name={`lines.${index}.discountPct`}
                          render={({ field: discountField }: { field: any }) => (
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              disabled={isConfirmed || loading}
                              value={discountField.value ?? ""}
                              onChange={(e) => discountField.onChange(e.target.value)}
                              onBlur={discountField.onBlur}
                              name={discountField.name}
                              ref={discountField.ref}
                            />
                          )}
                        />
                        {renderLineErrors(index, 'discountPct')}
                      </td>
                      <td className="px-3 py-2 align-middle text-slate-900 font-semibold">
                        ${orderTotals.lineTotals[index]?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-xs px-2 py-1"
                          onClick={() => remove(index)}
                          disabled={isConfirmed || loading}
                        >
                          Eliminar
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mt-4">
            <div className="flex items-center gap-3">
              <Button type="button" onClick={addLine} disabled={isConfirmed || loading}>
                Agregar línea
              </Button>
            </div>
            <div className="text-right ml-auto">
              <p className="text-sm text-slate-600">Total del pedido</p>
              <p className="text-2xl font-bold text-slate-900">${orderTotals.orderTotal.toFixed(2)}</p>
            </div>
          </div>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Button type="submit" disabled={!isValid || isSubmitting || loading || isConfirmed}>
            {orderId ? 'Guardar cambios' : 'Crear pedido'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={handleConfirm}
            disabled={isConfirmed || loading || !orderId}
          >
            Confirmar
          </Button>
        </div>
      </form>

    </>
  )
}
