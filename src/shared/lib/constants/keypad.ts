export type KeyId =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '00'
  | 'dot'
  | 'clear'
  | 'backspace'
  | 'save'
  | 'up'
  | 'down'
  | 'ok'

export const DIGIT_KEYS: Partial<Record<KeyId, string>> = {
  '0': '0',
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '00': '00',
  dot: '.',
}

export const DISABLED_ON_HISTORY: ReadonlySet<KeyId> = new Set<KeyId>([
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '00',
  'dot',
  'save',
])

export function isDigitKey(id: KeyId): id is keyof typeof DIGIT_KEYS {
  return id in DIGIT_KEYS
}
