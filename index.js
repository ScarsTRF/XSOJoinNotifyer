const fetch = require("node-fetch");
const dgram = require("dgram");
const sharp = require("sharp");
const fs = require("fs");
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json())

function getSound(type) {
  const files = ['default.ogg', 'warning.ogg', 'error.ogg', 'join.ogg', 'leave.ogg', 'spawned.ogg']
  const soundBackup = ['default', 'warning', 'error', 'default', 'default', 'default']

  if (fs.existsSync(`./sounds/${files[type]}`)) {
    return path.resolve(`./sounds/${files[type]}`)
  } else {
    return soundBackup[type]
  }
}

function jsonMaker(audio, icon, title) {
  let useICON = true

  if (icon == null) {
    icon = 'default'
    useICON = false
  }

  var json = JSON.stringify({
    messageType: 1,
    index: 0,
    timeout: 3,
    height: 135,
    opacity: 1,
    volume: 0.5,
    audioPath: audio,
    useBase64Icon: useICON,
    icon: icon,
    sourceApp: "XSOverlayNeosJoinNotif",
    title: title,
  })

  return json
}

function sendUDP(json, res, req, soundTypes) {
  let server = dgram.createSocket('udp4');
  server.send(json, 42069, 'localhost', function () {
    server.close();
    if (req.body.infotype >= 3 && soundTypes[req.body.infotype] == 'default' || soundTypes[req.body.infotype] == 'warning' || soundTypes[req.body.infotype] == 'error') {
      res.status(200).send({message: 'Success, but no sound was played because the file was not found.'});
    } else {
      res.status(200).send({message: 'Success!'});
    }
  });
}

app.post('/notify', function(req, res, err) {
  var soundTypes = ['default', 'warning', 'error', getSound(0), getSound(1), getSound(2), getSound(3), getSound(4), getSound(5)];

  if (req.body.UID != '') {
    fetch(`https://api.resonite.com/users/${req.body.UID}`).then(res => res.json()).then(data => {
      if (data.profile !== undefined) {
        if (data.profile.iconUrl.includes(".")) {
          var url = data.profile.iconUrl.replace("resdb:///", "");
          url = url.substring(0, url.lastIndexOf("."));
        } else {
          var url = data.profile.iconUrl.replace("resdb:///", "");
        }
        fetch(`https://assets.resonite.com/${url}`).then(response => response.arrayBuffer()).then(result => {
          try {
            sharp(Buffer.from(result)).toFile('./icon.jpg').then(
              setTimeout(function(){
                fs.readFile("icon.jpg", (err, data)=> {
                  if (err) {console.error(err)} else {
                    sendUDP(jsonMaker(soundTypes[req.body.infotype], data.toString('base64'), req.body.title), res, req, soundTypes)
                    fs.unlink('icon.jpg', (err) => {
                      if (err) {
                          throw err;
                      }
                    });
                  }
                })
              }, 50)
            )
          } catch (err) {
            sendUDP(jsonMaker(soundTypes[req.body.infotype], null, req.body.title), res, req, soundTypes)
            console.log(err)
          } 
        })
      } else {
        sendUDP(jsonMaker(soundTypes[req.body.infotype], null, req.body.title), res, req, soundTypes)
      }
    }).catch(err => console.log(err));
  } else {
    sendUDP(jsonMaker(soundTypes[req.body.infotype], null, req.body.title), res, req, soundTypes)
  }
})

app.listen(3700, () => {
  console.log(`App listneing at http://localhost:${3700}`)
});