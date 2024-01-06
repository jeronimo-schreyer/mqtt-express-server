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
const _config = {"ts":0,"roulette_type":2,"skin":4,"openTime":{"ts":1704413599693,"left":0,"limit":300}}
const _status = {"table_state":0,"last_numbers":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29],"statistics":[7,7,7,7,7,7,6,6,6,6,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5],"ts":0,"betConfig":{"max":10000,"min":500,"chip":50,"b36":250,"b18":500,"b12":750,"b9":1000,"b6":1500,"b7":0,"bCha1":2000,"bCha2":2500}}


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

  // Start publishing
  mqtt_publish('sts/s/' + server_id + '/config', _config)
  mqtt_publish('sts/s/' + server_id + '/status', _status)
})


// Endpoints
http.get('/', (req, res) => {
  res.append('Refresh', 5)
  res.render('index', {
    title: "Simulador de ruleta MQTT",
    clients: clients,
  })
})


http.get('/raffle', (req, res) => {
  var status = _status
  status.table_state = 1
  mqtt_publish('sts/s/' + server_id + '/status', status)

  setTimeout(() => {
    status.table_state = 0
    mqtt_publish('sts/s/' + server_id + '/status', status)
    res.redirect('/')
  }, 1000)
})


http.get('/skin', (req, res) => {
  var config = _config
  config.skin = parseInt(req.query.s)
  mqtt_publish('sts/s/' + server_id + '/config', config)
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