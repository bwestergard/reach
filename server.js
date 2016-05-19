import express from 'express'
import bodyParser from 'body-parser'
import { merge, pipe} from 'ramda'
const app = express()
const jsonParser = bodyParser.json()

const s = (json) => JSON.stringify(json, null, 2)
const echo = (v) => console.log(v)
const ej = pipe(s, echo)

app.post('/webhook', jsonParser, (req, res) => {
  ej(req.body)
  res.send(JSON.stringify(merge(req.body, {'hello': 'world'}), null, 2))
})

app.listen(3000, () => {
  console.log('Example app listening on port 3000!')
})
