import { Todo } from './Todo.js';
import { Calculation } from './Calculation.js';

export type TodoAppSchema = {
  Todo: Todo;
  Calculation: Calculation;
};

export const schema = [Todo, Calculation];

