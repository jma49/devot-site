import { afterAll } from 'vitest'
import { removeTempDirs } from './temp-dirs.ts'

afterAll(removeTempDirs)
