import { request } from "./client"

export type OrderStatus = "DRAFT" | "CONFIRMED" | "CANCELLED"

export type CancelReason = "CUSTOMER_REQUEST" | "STOCK_ISSUE" | "PRICING_ERROR" | "DUPLICATE" | "OTHER"

export type Customer = {
  id: string
  name: string
  contactName: string
  email: string
  phone: string
  address?: string
  city?: string
  taxId?: string
}

export type Product = {
  id: string
  code: string
  name: string
  basePrice: number
}

export type OrderLinePayload = {
  productId: string
  quantity: number
  unitPrice: number
  discountPct: number
}

export type CustomerPayload = Omit<Customer, "id">

export type OrderPayload = {
  customerId: string
  orderDate: string
  deliveryDate: string
  lines: OrderLinePayload[]
}

export type OrderResponse = OrderPayload & {
  id: string
  orderNumber: string
  status: OrderStatus
  customerName: string
  customerId: string
  cancelReason?: CancelReason
  cancelNote?: string
  orderSubtotal: number
  orderDiscountTotal: number
  orderTotal: number
}

export const getCustomers = () => request<Customer[]>("/api/customers")
export const getProducts = () => request<Product[]>("/api/products")

export const createCustomer = (payload: CustomerPayload) =>
  request<Customer>("/api/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  })

export const updateCustomer = (id: string, payload: CustomerPayload) =>
  request<Customer>(`/api/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })

export const deleteCustomer = (id: string) =>
  request<void>(`/api/customers/${id}`, {
    method: "DELETE",
  })

export const listOrders = (includeCancelled = false) =>
  request<OrderResponse[]>(`/api/orders?includeCancelled=${includeCancelled}`)

export const createOrder = (payload: OrderPayload) =>
  request<OrderResponse>("/api/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  })

export const updateOrder = (id: string, payload: OrderPayload) =>
  request<OrderResponse>(`/api/orders/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })

export const getOrderById = (id: string) => request<OrderResponse>(`/api/orders/${id}`)

export const confirmOrder = (id: string) =>
  request<OrderResponse>(`/api/orders/${id}/confirm`, {
    method: "POST",
  })

export const cancelOrder = (id: string, payload: { reason: CancelReason; note?: string }) =>
  request<OrderResponse>(`/api/orders/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
