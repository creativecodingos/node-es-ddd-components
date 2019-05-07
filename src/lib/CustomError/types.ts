/**
 * The name of a custom error type
 */
export type CustomErrorName = string

/**
 * The `data` payload that could be exposed
 * by a custom error instance
 */
export type CustomErrorData = any

/**
 * An instance of a custom error type
 */
export interface CustomErrorInstance<
  Name extends CustomErrorName,
  Data extends CustomErrorData
> extends Error {
  readonly name: Name
  readonly data: Data
}

/**
 * An object describing a custom error type
 */
export interface CustomErrorTypeDefinition<Name extends CustomErrorName> {
  /**
   * The name of the custom error type
   */
  readonly name: Name
}

interface ErrorConstructor<Name extends CustomErrorName> {
  (message?: string): CustomErrorInstance<Name, void>
  readonly name: Name
}

interface ErrorWithPayloadConstructor<
  Name extends CustomErrorName,
  Data extends CustomErrorData
> {
  (message: string | undefined, data: Data): CustomErrorInstance<Name, Data>
  readonly name: Name
}

/**
 * A factory to generate an instance of a custom error type
 * @param message The error message
 * @param data A paylod to expose through `error.data`
 */
export type CustomErrorTypeFactory<
  Name extends CustomErrorName,
  Data extends CustomErrorData
> = Data extends void
  ? ErrorConstructor<Name>
  : ErrorWithPayloadConstructor<Name, Data>
