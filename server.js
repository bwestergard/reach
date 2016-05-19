import express from 'express'
import bodyParser from 'body-parser'
import pipeP from './lib/pipeP'
import { pipe, path, tap, prop, match, complement, isEmpty, filter, map, split, join } from 'ramda'
import { all } from 'bluebird'
import http from 'http-as-promised'
const app = express()
const jsonParser = bodyParser.json()

const s = (json) => JSON.stringify(json, null, 2)
const echo = (v) => console.log(v)
const ej = pipe(s, echo)

const getBodyFromHttp = (url) =>
http(url, {
  headers: {
    'User-Agent': 'reachbot' //,
    // 'Host': 'api.github.com',
    // 'Authorization': 'Basic ' + new Buffer(
    //   process.env.REACHBOT_USERNAME + ':' + process.env.REACHBOT_PASSWORD
    // ).toString('base64')
  },
  resolve: 'body'
})

const getJsonFromHttp = (url) => getBodyFromHttp(url).then(JSON.parse)

const filterJsFiles = filter(
  pipe(
      prop('filename'),
      match(/\.js$/),
      complement(isEmpty)
  )
)

const commentOutEverything = pipe(
  split('\n'),
  map((s) => '// ' + s),
  join('\n')
)

app.post('/webhook', jsonParser, async (req, res) => {
  const prUrl = path(['pull_request', 'url'], req.body)

  ej({prUrl})

  const prFilesMetadata = await getJsonFromHttp(prUrl + '/files')
  const jsFilesMetadata = filterJsFiles(prFilesMetadata)

  ej({jsFilesMetadata})

  const processedContents = await pipeP(
    pipe(
      map(
        (jsFileMetaData) => pipeP(
          prop('contents_url'),
          getJsonFromHttp,
          tap(ej),
          prop('download_url'),
          tap(ej),
          getBodyFromHttp,
          commentOutEverything
        )(jsFileMetaData)
      ),
      all
    )
  )(jsFilesMetadata)

  ej({processedContents})

  res.send(s(req.body))
})

app.listen(3000, () => {
  console.log('Example app listening on port 3000!')
})
