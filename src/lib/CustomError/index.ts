import {
  CustomErrorData,
  CustomErrorName,
  CustomErrorTypeDefinition,
  CustomErrorTypeFactory,
} from './types'
import validateDefinition from './validateDefinition'

export function CustomError<
  Name extends CustomErrorName = CustomErrorName,
  Data extends CustomErrorData = void
>(
  definition: CustomErrorTypeDefinition<Name>
): CustomErrorTypeFactory<Name, Data> {
  // tslint:disable no-expression-statement
  try {
    validateDefinition(definition)
  } catch (e) {
    throw new TypeError(e.message)
  }
  // tslint:enable

  const { name: errorName } = definition
  const ErrorType = (message?: string, data?: Data) => {
    const error = new Error(message || errorName)
    return Object.defineProperties(error, {
      __factory: { value: ErrorType },
      name: { enumerable: true, value: errorName },
      stack: {
        enumerable: true,
        value:
          error.stack && parseErrorStack(errorName, error.stack.split('\n')),
      },
      ...(data !== undefined
        ? { data: { enumerable: true, value: data } }
        : {}),
    })
  }

  return Object.defineProperties(ErrorType, {
    name: { enumerable: true, value: errorName },
    [Symbol.hasInstance]: {
      value: (e: any) => !!e && e.__factory && e.__factory === ErrorType,
    },
  }) as CustomErrorTypeFactory<Name, Data>
}

export const parseErrorStack = (
  errorName: string,
  stack: ReadonlyArray<string>
): string => {
  const [first, ...rest] = stack.filter((_, i) => i !== 1)
  return [`${errorName}${first.slice(5)}`, ...rest].join('\n')
}
