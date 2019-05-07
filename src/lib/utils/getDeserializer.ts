import { CustomError } from '../CustomError'

export const DeserializationError = CustomError<
  'DeserializationError',
  { readonly originalError: Error }
>({
  name: 'DeserializationError',
})

export type Deserializer<T> = (str: string) => T

export function getDeserializer<T>(
  deserializer?: Deserializer<T>,
  errorMessage?: string
): Deserializer<T> {
  const deserialize = deserializer || JSON.parse
  return (s: string): T => {
    try {
      return deserialize(s)
    } catch (e) {
      throw DeserializationError(errorMessage || e.message, {
        originalError: e,
      })
    }
  }
}
