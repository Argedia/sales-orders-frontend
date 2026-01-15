declare module "react-hook-form" {
  export type FieldValues = Record<string, unknown>

  export type Control<TFieldValues = FieldValues> = unknown

  export type UseFormReturn<TFieldValues = FieldValues> = {
    control: Control<TFieldValues>
    register: (name: string) => any
    handleSubmit: (cb: (data: TFieldValues) => any) => any
    reset: (values?: Partial<TFieldValues>) => void
    setValue: (name: string, value: any, options?: any) => void
    getValues: (name?: string) => any
    formState: {
      errors: any
      isSubmitting: boolean
      isValid: boolean
    }
  }

  export function useForm<TFieldValues = FieldValues>(props?: any): UseFormReturn<TFieldValues>

  export type UseFieldArrayReturn<TFieldValues = FieldValues> = {
    fields: Array<any>
    append: (value: any) => void
    remove: (index: number) => void
  }

  export function useFieldArray<TFieldValues = FieldValues>(props: {
    control: Control<TFieldValues>
    name: string
  }): UseFieldArrayReturn<TFieldValues>

  export function useWatch<TFieldValues = FieldValues>(props: {
    control: Control<TFieldValues>
    name: string
  }): any

  export const Controller: any
}
