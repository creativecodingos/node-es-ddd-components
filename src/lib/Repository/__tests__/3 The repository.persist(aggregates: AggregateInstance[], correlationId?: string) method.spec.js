import 'jest'
import { left, right } from 'fp-ts/lib/Either'
import { noop, pick } from 'lodash'

import {
  Aggregate,
  DomainEvent,
  Repository,
  InMemoryEventStore,
  InMemorySnapshotService,
  RepositoryBadAggregatesListProvided,
  RepositoryWriteError,
  RepositoryWriteConcurrencyError,
  STRICT_CONSISTENCY_POLICY,
  SOFT_CONSISTENCY_POLICY,
  NO_CONSISTENCY_POLICY,
} from 'lib-export'

import TodoList, { definition as todoListDefinition } from 'lib-tests/TodoList'

const getDefinition = () => ({
  eventStore: InMemoryEventStore(),
  snapshotService: InMemorySnapshotService(),
})

describe('Throwing cases', () => {
  it('throws `RepositoryBadAggregatesListProvided` if `aggregates` is not a list of valid aggregate instances unique by context, type and identity', () => {
    const definition = getDefinition()
    const repository = Repository(definition)
    const todoListX = TodoList('x')
    const todoListY = TodoList('y')

    expect(() => repository.persist(1)).toThrowError(
      RepositoryBadAggregatesListProvided
    )
    expect(() => repository.persist([1])).toThrowError(
      RepositoryBadAggregatesListProvided
    )
    expect(() => repository.persist([todoListX, null])).toThrowError(
      RepositoryBadAggregatesListProvided
    )
    expect(() => repository.persist([todoListX, todoListX])).toThrowError(
      RepositoryBadAggregatesListProvided
    )

    expect(() => repository.persist([todoListX, todoListY])).not.toThrow()
  })
})

describe('Returned value', () => {
  it('is a promise', () => {
    const definition = getDefinition()
    const repository = Repository(definition)
    const todoList = TodoList('x')
    todoList.execute.CreateList({ identity: 'x', name: 'A list' })

    const result = repository.persist([todoList])
    expect(typeof result.then).toBe('function')
    expect(typeof result.catch).toBe('function')
  })
  it('promised value is an Either', async () => {
    const definition = getDefinition()
    const repository = Repository(definition)
    const todoList = TodoList('x')
    todoList.execute.CreateList({ identity: 'x', name: 'A list' })

    const result = await repository.persist([todoList])
    expect(typeof result.isRight).toBe('function')
    expect(typeof result.isLeft).toBe('function')
  })
  it('"right" value is an object with `.aggregates` and `.persistedEvents` keys', async () => {
    const definition = getDefinition()
    const repository = Repository(definition)

    const todoList = TodoList('x')
    todoList.execute.CreateList({ identity: 'x', name: 'A list' })

    const result = await repository.persist([todoList])
    expect(Object.keys(result.value)).toEqual(['aggregates', 'persistedEvents'])
  })
  it('`.aggregates` is a list of reloaded instances. The order of entities is preserved', async () => {
    const definition = getDefinition()
    const repository = Repository(definition)

    const result = await repository.persist([TodoList('x'), TodoList('y')])
    const [todoListX, todoListY] = result.value.aggregates
    expect(todoListX instanceof TodoList).toBe(true)
    expect(todoListX.identity).toBe('x')
    expect(todoListY instanceof TodoList).toBe(true)
    expect(todoListY.identity).toBe('y')
  })
  it('`.persistedEvents` is the value returned by the call to eventStore.appendEventsToAggregates()', async () => {
    const definition = getDefinition()
    const repository = Repository(definition)

    const list = []
    jest
      .spyOn(definition.eventStore, 'appendEventsToAggregates')
      .mockImplementation(() => Promise.resolve(right(list)))

    const todoList = TodoList('x')
    todoList.execute.CreateList({ identity: 'x', name: 'A list' })

    const result = await repository.persist([todoList])

    expect(result.value.persistedEvents).toBe(list)
  })
})

describe('Interaction with `eventStore`', () => {
  describe('The call to eventStore.appendEventsToAggregates(insertions: EventStoreInsertion[], correlationId: string)', () => {
    it('the length of the insertions list is equal to the number of aggregates, even if they are not dirty', async () => {
      const definition = getDefinition()
      const spyAppendEventsToAggregates = jest.spyOn(
        definition.eventStore,
        'appendEventsToAggregates'
      )

      const repository = Repository(definition)
      const todoList = TodoList('x')
      todoList.execute.CreateList({ identity: 'A', name: 'A list' })

      const cleanAggregate = TodoList('y')
      await repository.persist([todoList, cleanAggregate])

      const insertions = spyAppendEventsToAggregates.mock.calls[0][0]
      expect(insertions.length).toBe(2)
    })
    it('correlationId is passed', async () => {
      const definition = getDefinition()
      const spyAppendEventsToAggregates = jest.spyOn(
        definition.eventStore,
        'appendEventsToAggregates'
      )

      const repository = Repository(definition)
      const todoList = TodoList('x')
      todoList.execute.CreateList({ identity: 'A', name: 'A list' })

      const firstPersistenceResult = await repository.persist(
        [todoList],
        'a correlation'
      )
      const [list] = firstPersistenceResult.value.aggregates
      list.execute.ChangeListName({ name: 'Another' })
      await repository.persist([list])

      const firstCorrelationId = spyAppendEventsToAggregates.mock.calls[0][1]
      expect(firstCorrelationId).toBe('a correlation')
      const secondCorrelationId = spyAppendEventsToAggregates.mock.calls[1][1]
      expect(secondCorrelationId).toBe('')
    })

    describe('The insertion: EventStoreInsertion object', () => {
      it('insertion.aggregate is an object to identify the aggregate: {context, type, identity}', async () => {
        const definition = getDefinition()
        const spyAppendEventsToAggregates = jest.spyOn(
          definition.eventStore,
          'appendEventsToAggregates'
        )

        const repository = Repository(definition)
        const todoList = TodoList('A')
        todoList.execute.CreateList({ identity: 'A', name: 'A list' })

        const TodoListSingleton = Aggregate({
          ...todoListDefinition,
          singleton: true,
        })
        const todoListSingleton = TodoListSingleton()
        todoListSingleton.execute.CreateList({
          identity: 'single',
          name: 'A list',
        })

        await repository.persist([todoList, todoListSingleton])

        const insertions = spyAppendEventsToAggregates.mock.calls[0][0]

        expect(insertions.map(({ aggregate }) => aggregate)).toEqual([
          pick(todoList, ['context', 'type', 'identity']),
          pick(todoListSingleton, ['context', 'type', 'identity']),
        ])
      })
      it("insertion.eventsToAppend is the list of aggregate.getNewEvents(), but each event's `.payload` is serialized", async () => {
        const definition = getDefinition()
        const spyAppendEventsToAggregates = jest.spyOn(
          definition.eventStore,
          'appendEventsToAggregates'
        )

        const repository = Repository(definition)
        const todoList = TodoList('A')
        todoList.execute.CreateList({ identity: 'A', name: 'A list' })
        todoList.execute.ChangeListName({ name: 'Another list' })

        await repository.persist([todoList])

        const [insertion] = spyAppendEventsToAggregates.mock.calls[0][0]
        expect(insertion.eventsToAppend).toEqual(
          todoList.getNewEvents().map(({ name, getSerializedPayload }) => ({
            name,
            payload: getSerializedPayload(),
          }))
        )
      })
      describe('insertion.expectedAggregateVersion', () => {
        it('=== aggregate.version if aggregate.getConsistencyPolicy === STRICT_CONSISTENCY_POLICY', async () => {
          const definition = getDefinition()
          const spyAppendEventsToAggregates = jest.spyOn(
            definition.eventStore,
            'appendEventsToAggregates'
          )

          const repository = Repository(definition)
          const AggregateType = Aggregate({
            ...todoListDefinition,
            events: [
              DomainEvent({
                name: 'Event',
                reducer: () => {},
              }),
            ],
            commands: [
              {
                name: 'DoIt',
                raisableErrors: [],
                emittableEvents: ['Event'],
                handler: (_, { emit }) => {
                  emit.Event()
                },
              },
            ],
          })
          const aggregate = AggregateType('x', {
            version: Math.ceil(Math.random() * 20),
            serializedState: JSON.stringify(todoListDefinition.initialState),
          })
          aggregate.execute.DoIt()

          expect(aggregate.getConsistencyPolicy()).toBe(
            STRICT_CONSISTENCY_POLICY
          )

          await repository.persist([aggregate]).catch(noop)

          const [insertion] = spyAppendEventsToAggregates.mock.calls[0][0]
          expect(insertion.expectedAggregateVersion).toBe(aggregate.version)
        })
        it('=== -1 if aggregate.getConsistencyPolicy === SOFT_CONSISTENCY_POLICY', async () => {
          const definition = getDefinition()
          const spyAppendEventsToAggregates = jest.spyOn(
            definition.eventStore,
            'appendEventsToAggregates'
          )

          const repository = Repository(definition)
          const AggregateType = Aggregate({
            ...todoListDefinition,
            events: [
              DomainEvent({
                name: 'Event',
                reducer: () => {},
              }),
            ],
            commands: [
              {
                name: 'DoIt',
                raisableErrors: [],
                emittableEvents: ['Event'],
                handler: (_, { emit }) => {
                  emit.Event(null, SOFT_CONSISTENCY_POLICY)
                },
              },
            ],
          })
          const aggregate = AggregateType('x', {
            version: Math.ceil(Math.random() * 20),
            serializedState: JSON.stringify(todoListDefinition.initialState),
          })
          aggregate.execute.DoIt()

          expect(aggregate.getConsistencyPolicy()).toBe(SOFT_CONSISTENCY_POLICY)

          await repository.persist([aggregate]).catch(noop)

          const [insertion] = spyAppendEventsToAggregates.mock.calls[0][0]
          expect(insertion.expectedAggregateVersion).toBe(-1)
        })
        it('=== -2 if aggregate.getConsistencyPolicy === NO_CONSISTENCY_POLICY', async () => {
          const definition = getDefinition()
          const spyAppendEventsToAggregates = jest.spyOn(
            definition.eventStore,
            'appendEventsToAggregates'
          )

          const repository = Repository(definition)
          const AggregateType = Aggregate({
            ...todoListDefinition,
            events: [
              DomainEvent({
                name: 'Event',
                reducer: () => {},
              }),
            ],
            commands: [
              {
                name: 'DoIt',
                raisableErrors: [],
                emittableEvents: ['Event'],
                handler: (_, { emit }) => {
                  emit.Event(null, NO_CONSISTENCY_POLICY)
                },
              },
            ],
          })
          const aggregate = AggregateType('x', {
            version: Math.ceil(Math.random() * 20),
            serializedState: JSON.stringify(todoListDefinition.initialState),
          })
          aggregate.execute.DoIt()

          expect(aggregate.getConsistencyPolicy()).toBe(NO_CONSISTENCY_POLICY)

          await repository.persist([aggregate]).catch(noop)

          const [insertion] = spyAppendEventsToAggregates.mock.calls[0][0]
          expect(insertion.expectedAggregateVersion).toBe(-2)
        })
      })
    })
  })
})

describe('Behaviour in case of eventStore.appendEventsToAggregates() failure', () => {
  it('FAILS. The eventStore error is passed', async () => {
    const definition = getDefinition()
    const error = new Error()
    jest
      .spyOn(definition.eventStore, 'appendEventsToAggregates')
      .mockImplementation(() => Promise.resolve(left(error)))

    const repository = Repository(definition)
    const todoList = TodoList('A')
    todoList.execute.CreateList({ identity: 'A', name: 'A list' })

    const result = await repository.persist([todoList])

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBe(error)
  })
})

describe('Behaviour in case of eventStore.getEventsOfAggregate() failure with `error`', () => {
  it('DOES NOT fail but result.aggregates is undefined', async () => {
    const definition = getDefinition()
    const error = new Error()
    jest
      .spyOn(definition.eventStore, 'getEventsOfAggregate')
      .mockImplementation(() => Promise.resolve(left(error)))

    const repository = Repository(definition)
    const todoList = TodoList('A')
    todoList.execute.CreateList({ identity: 'A', name: 'A list' })

    const result = await repository.persist([todoList])
    expect(result.isRight()).toBe(true)
    expect(result.value.aggregates).toBe(undefined)
    expect(result.value.persistedEvents.length > 0).toBe(true)
  })
})
