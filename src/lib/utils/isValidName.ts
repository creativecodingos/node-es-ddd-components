import { isString } from 'lodash'

export function isValidName(x: any): x is string {
  return isString(x) && /^[a-zA-Z]\w*$/.test(x)
}

export const validNameDescription = `string starting with a letter and composed by letters, numbers and underscores only`
