import { resolve } from 'bluebird'
import { pipeP } from 'ramda'

export default (...functions) => pipeP(resolve, ...functions)
