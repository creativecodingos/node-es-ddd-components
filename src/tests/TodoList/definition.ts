import { AggregateDefinition } from '../../lib'

import { Command, commands } from './commands'
import { Error, errors } from './errors'
import { Event, events } from './events'
import queries, { Query } from './queries'
import { initialState, TodoListState } from './state'

export const definition: AggregateDefinition<
  'TodosManagement',
  'TodoList',
  false,
  TodoListState,
  Query,
  Error,
  Event,
  Command
> = {
  context: 'TodosManagement',
  type: 'TodoList',

  initialState,

  singleton: false,

  commands,
  errors,
  events,
  queries,
}
