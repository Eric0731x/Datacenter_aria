import { v4 as uuidv4 } from 'uuid';

export function generateId(): string {
  return uuidv4().replace(/-/g, '');
}

export function generateUUID(): string {
  return uuidv4();
}
