/**
 * Gera um número inteiro aleatório entre min (inclusive) e max (inclusive)
 * @param min Número mínimo (inclusive)
 * @param max Número máximo (inclusive)
 * @returns Número inteiro aleatório
 */
export function getRandomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
} 