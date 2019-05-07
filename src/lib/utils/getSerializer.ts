import { CustomError } from '../CustomError'

export const SerializationError = CustomError<
  'SerializationError',
  { readonly originalError: Error }
>({
  name: 'SerializationError',
})

export type Serializer<T> = (t: T) => string

export function getSerializer<T>(
  serializer?: Serializer<T>,
  errorMessage?: string
): Serializer<T> {
  const serialize = serializer || JSON.stringify
  return (t: T) => {
    try {
      return serialize(t)
    } catch (e) {
      throw SerializationError(errorMessage || e.message, { originalError: e })
    }
  }
}
