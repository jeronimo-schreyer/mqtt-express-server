const aedes = require('aedes')()
const mqtt = require('net').createServer(aedes.handle)
const http = require('express')()
const bodyParser = require('body-parser')
const { Liquid } = require('liquidjs')
const template = new Liquid({
  root: __dirname, // for layouts and partials
  extname: '.liquid'
})

const ports = {
  mqtt: 9000,
  http: 8080,
}


var _config = {"ts":0,"roulette_type":0,"skin":4,"openTime":{"ts":1704413599693,"left":0,"limit":300}}
var _status = {"table_state":0,"last_numbers":[],"statistics":[],"ts":0,"betConfig":{"max":10000,"min":500,"chip":50,"b36":250,"b18":500,"b12":750,"b9":1000,"b6":1500,"b7":0,"bCha1":2000,"bCha2":2500}}
var clients = {}
var server_id = ''


// Helper Functions
function findDeviceIdByClient(device_id) {
  return Object.keys(clients).find(key => clients[key] === device_id);
}

function mqtt_publish(topic, payload) {
  var t = Date.now()
  payload.ts = t
  aedes.publish({topic: topic, payload: JSON.stringify(payload), retain: true })
}


// HTTP initialization
http.engine('liquid', template.express())
http.set('view engine', 'liquid')
http.set('views', ['./'])
http.use(bodyParser.urlencoded({ extended: true }))
http.use(bodyParser.json())


// Start servers
http.listen(ports.http, () => {
  console.log('HTTP server running on URL: http://localhost:' + ports.http)
})
mqtt.listen(ports.mqtt, () => {
  console.log('MQTT broker running on port:', ports.mqtt)

  // Add some random data
  _status.statistics = Array(38).fill(0)
  for (let i = 0; i < 300; i++) {
    const winner = Math.floor(Math.random() * 38)
    _status.last_numbers = [].concat(winner, _status.last_numbers).slice(0, 30)
    _status.statistics[winner] += 1
  }

  mqtt_publish('sts/s/' + server_id + '/config', _config)
  mqtt_publish('sts/s/' + server_id + '/status', _status)
})


// Endpoints
http.get('/', (req, res) => {
  res.append('Refresh', 5)
  res.render('index', {
    title: "Simulador de ruleta MQTT",
    clients: clients,
    skin: _config.skin,
    winner: _status.last_numbers[0]
  })
})


http.get('/raffle', (req, res) => {
  _status.table_state = 1
  _status.ts = Date.now()
  mqtt_publish('sts/s/' + server_id + '/status', _status)

  setTimeout(() => {
    _status.ts = Date.now()
    _status.table_state = 0

    mqtt_publish('sts/s/' + server_id + '/status', _status)
  }, 1000)

  res.redirect('/')
})


http.get('/skin', (req, res) => {
  _config.skin = parseInt(req.query.s)
  _config.ts = Date.now()
  mqtt_publish('sts/s/' + server_id + '/config', _config)

  res.redirect('/')
})


http.get('/winner', (req, res) => {
  _status.last_numbers[0] = (req.query.w == "00") ? 37 : parseInt(req.query.w)
  _status.ts = Date.now()
  mqtt_publish('sts/s/' + server_id + '/status', _status)

  res.redirect('/')
})


// MQTT events
aedes.on('publish', function (packet, client) {
  if (client) {
    var data = JSON.parse(packet.payload.toString())
    if (data.status == "OK") {
      var device_id = packet.topic.match(/\/([^\/]+)\/alive$/)[1]
      clients[device_id] = client
    }
  }
})

aedes.on('clientDisconnect', function (client) {
  if (client) {
    delete clients[findDeviceIdByClient(client)]
  }
})