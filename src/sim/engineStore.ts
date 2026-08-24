/**
 * Motor de simulación compartido por toda la aplicación.
 *
 * El Simulador y la vista 3D usan la MISMA instancia: lo que el alumno cambia
 * en una pestaña se refleja al instante en la otra.
 */

import { SimEngine } from './engine'

export const appEngine = new SimEngine()
