/**
 * طريق الأثرياء - السيرفر والواجهة المدمجة
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { ExpressPeerServer } = require('peer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/'
});
app.use('/peerjs', peerServer);

let database = {
  users: {},
  friends: {},
  rooms: {}
};

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>لعبة طريق الأثرياء - النسخة السعودية</title>
        <script src="/socket.io/socket.io.js"></script>
        <script src="https://unpkg.com/peerjs@1.4.7/dist/peerjs.min.js"></script>
        <style>
            body { font-family: 'Tahoma', sans-serif; background: #0f172a; color: #fff; text-align: center; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: auto; background: #1e293b; padding: 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
            button { background: #10b981; color: white; border: none; padding: 10px 20px; font-size: 16px; border-radius: 8px; cursor: pointer; margin: 5px; }
            button:hover { background: #059669; }
            input { padding: 10px; width: 80%; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; margin-bottom: 10px; }
            ul { list-style: none; padding: 0; }
            li { background: #334155; margin: 5px 0; padding: 8px; border-radius: 6px; }
        </style>
    </head>
    <body>

    <div class="container">
        <h1>طريق الأثرياء 🏙️</h1>
        <p>السيرفر السحابي المجاني: متصل بنجاح ✅</p>
        
        <div id="lobby">
            <input type="text" id="username" placeholder="أدخل اسمك المستعار..."><br>
            <button onclick="connectUser()">تسجيل الدخول وبدء اللعب</button>
        </div>

        <div id="game-controls" style="display:none;">
            <h3 id="welcome-msg"></h3>
            <button onclick="createGameRoom()">إنشاء غرفة جديدة للأصدقاء</button>
            <br>
            <input type="text" id="room-id-input" placeholder="أدخل كود الغرفة للانضمام">
            <button onclick="joinGameRoom()">انضمام للغرفة</button>
            
            <h4>إضافة صديق</h4>
            <input type="text" id="friend-name-input" placeholder="اسم الصديق...">
            <button onclick="addFriend()">إضافة للقائمة</button>

            <h4>قائمة الأصدقاء المحفوظة</h4>
            <ul id="friends-list">لا توجد أصدقاء مضافين</ul>
        </div>
    </div>

    <script>
        const socket = io();
        let myPeer, peerId, currentUsername;

        function connectUser() {
            currentUsername = document.getElementById('username').value;
            if(!currentUsername) return alert('الرجاء إدخال الاسم!');

            myPeer = new Peer({
                host: window.location.hostname,
                port: window.location.port || (window.location.protocol === 'https:' ? 443 : 80),
                path: '/peerjs'
            });

            myPeer.on('open', (id) => {
                peerId = id;
                document.getElementById('lobby').style.display = 'none';
                document.getElementById('game-controls').style.display = 'block';
                document.getElementById('welcome-msg').innerText = \`أهلاً بك، \${currentUsername}\`;
                socket.emit('register_user', { username: currentUsername, peerId });
            });
        }

        function createGameRoom() {
            const roomId = 'ROOM_' + Math.floor(10000 + Math.random() * 90000);
            socket.emit('create_room', { roomId, host: currentUsername });
            alert(\`تم إنشاء الغرفة بنجاح! كود الغرفة: \${roomId}\`);
        }

        function joinGameRoom() {
            const roomId = document.getElementById('room-id-input').value;
            if(!roomId) return alert('أدخل كود الغرفة أولاً!');
            socket.emit('join_room', { roomId, username: currentUsername });
        }

        function addFriend() {
            const friendName = document.getElementById('friend-name-input').value;
            if(!friendName) return alert('أدخل اسم الصديق!');
            socket.emit('add_friend', { username: currentUsername, friendName });
        }

        socket.on('update_friends_list', (friends) => {
            const listEl = document.getElementById('friends-list');
            listEl.innerHTML = '';
            if(friends.length === 0) {
                listEl.innerHTML = '<li>لا توجد أصدقاء مضافين</li>';
            } else {
                friends.forEach(f => {
                    const li = document.createElement('li');
                    li.innerText = f;
                    listEl.appendChild(li);
                });
            }
        });

        socket.on('room_joined_success', (roomId) => {
            alert(\`تم الانضمام بنجاح إلى الغرفة: \${roomId}\`);
        });
    </script>

    </body>
    </html>
  `);
});

io.on('connection', (socket) => {
  let currentUser = null;

  socket.on('register_user', (data) => {
    currentUser = data.username;
    database.users[currentUser] = data.peerId;
    if (!database.friends[currentUser]) {
      database.friends[currentUser] = [];
    }
    socket.emit('update_friends_list', database.friends[currentUser]);
  });

  socket.on('add_friend', (data) => {
    if (database.friends[data.username]) {
      database.friends[data.username].push(data.friendName);
      socket.emit('update_friends_list', database.friends[data.username]);
    }
  });

  socket.on('create_room', (data) => {
    database.rooms[data.roomId] = [data.host];
    socket.join(data.roomId);
  });

  socket.on('join_room', (data) => {
    socket.join(data.roomId);
    if (!database.rooms[data.roomId]) database.rooms[data.roomId] = [];
    database.rooms[data.roomId].push(data.username);
    socket.emit('room_joined_success', data.roomId);
    io.to(data.roomId).emit('player_joined_room', data.username);
  });

  socket.on('disconnect', () => {
    console.log('انقطع اتصال مستخدم');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`سيرفر طريق الأثرياء يعمل بكفاءة على البورت ${PORT}`);
});
