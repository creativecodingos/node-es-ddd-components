import { tuple } from '../../../lib'

import AddTodo from './AddTodo'
import ChangeListName from './ChangeListName'
import CloseList from './CloseList'
import CreateList from './CreateList'
import MarkTodoAsDone from './MarkTodoAsDone'
import MarkTodoAsUndone from './MarkTodoAsUndone'
import RemoveTodo from './RemoveTodo'

export const commands = tuple(
  AddTodo,
  ChangeListName,
  CloseList,
  CreateList,
  MarkTodoAsDone,
  MarkTodoAsUndone,
  RemoveTodo
)

export type Command = typeof commands[number]
