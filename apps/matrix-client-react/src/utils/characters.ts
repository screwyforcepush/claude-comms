export const matrixChars = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '~', '!', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+',
  '{', '}', ':', ';', '"', '<', '>', '?', ',', '.', '/',
  '[', ']', '\\', "'"
];

export const getRandomChar = (): string => {
  return matrixChars[Math.floor(Math.random() * matrixChars.length)];
};

export const getRandomNumber = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

export const getRandomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};