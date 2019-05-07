import { tuple } from '../../../lib'

import AListWithUndoneTodosCannotBeClosed from './AListWithUndoneTodosCannotBeClosed'
import ATodoCannotBeAddedToAClosedList from './ATodoCannotBeAddedToAClosedList'
import ATodoCannotBeRemovedFromAClosedList from './ATodoCannotBeRemovedFromAClosedList'
import TheListAlreadyExists from './TheListAlreadyExists'
import TheListDoesNotExist from './TheListDoesNotExist'
import TheTodoAlreadyExists from './TheTodoAlreadyExists'
import TheTodoDoesNotExist from './TheTodoDoesNotExist'

export const errors = tuple(
  AListWithUndoneTodosCannotBeClosed,
  ATodoCannotBeAddedToAClosedList,
  ATodoCannotBeRemovedFromAClosedList,
  TheListAlreadyExists,
  TheListDoesNotExist,
  TheTodoAlreadyExists,
  TheTodoDoesNotExist
)

export type Error = typeof errors[number]
