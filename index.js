const express = require('express');
const bodyParser = require('body-parser');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database/theater_booking.db',
});

sequelize
  .authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });

const Screen = sequelize.define('Screen', {
  name: Sequelize.STRING,
  capacity: Sequelize.INTEGER
});

const Show = sequelize.define('Show', {
  name: Sequelize.STRING,
  start_time: Sequelize.DATE,
  end_time: Sequelize.DATE,
});

const Seat = sequelize.define('Seat', {
  number: Sequelize.INTEGER,
  screen_id: Sequelize.INTEGER,
  show_id: Sequelize.INTEGER,
  is_booked: Sequelize.BOOLEAN
});

Screen.hasMany(Seat, { foreignKey: 'screen_id' });
Show.hasMany(Seat, { foreignKey: 'show_id' });

sequelize.sync({ force: true })
  .then(() => {
    return Screen.bulkCreate([
      { name: 'Screen 1', capacity: 45 },
      { name: 'Screen 2', capacity: 60 },
      { name: 'Screen 3', capacity: 75 }
    ]);
  })
  .then(() => {
    return Show.bulkCreate([
      { name: 'Show 1', start_time: new Date('2023-03-06T10:00:00Z'), end_time: new Date('2023-03-06T12:00:00Z') },
      { name: 'Show 2', start_time: new Date('2023-03-06T13:00:00Z'), end_time: new Date('2023-03-06T15:00:00Z') },
      { name: 'Show 3', start_time: new Date('2023-03-06T16:00:00Z'), end_time: new Date('2023-03-06T18:00:00Z') }
    ]);
  })
  .then(() => {
    const seats = [];
    Screen.findAll().then(screens => {
      Show.findAll().then(shows => {
        shows.forEach(show => {
          screens.forEach(screen => {
            for (let i = 1; i <= screen.capacity; i++) {
              seats.push({ number: i, screen_id: screen.id, show_id: show.id, is_booked: false });
            }
          });
        });
        Seat.bulkCreate(seats);
      });
    });
  });

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/shows', (req, res) => {
  Show.findAll().then(shows => {
    res.json(shows);
  });
});

app.get('/screens', (req, res) => {
  Screen.findAll().then(screens => {
    res.json(screens);
  });
});

app.get('/seats', (req, res) => {
  const show_id = req.query.show_id;
  const screen_id = req.query.screen_id;
  Seat.findAll({ where: { show_id, screen_id } }).then(seats => {
    res.json(seats);
  });
});

app.post('/book', (req, res) => {
  const { show_id, screen_id, seat_number } = req.body;
  Seat.findOne({ where: { show_id, screen_id, number: seat_number } }).then(seat => {
    if (seat) {
      if (seat.is_booked) {
        res.status(400).send('Seat is already booked');
      } else {
        Seat.update({ is_booked: true }, { where: { id: seat.id } }).then(() => {
          res.send('Seat booked successfully');
        });
      }
    } else {
      res.status(400).send('Seat not found');
    }
  });
});

app.post('/cancel', (req, res) => {
  const { show_id, screen_id, seat_number } = req.body;
  Seat.findOne({ where: { show_id, screen_id, number: seat_number } }).then(seat => {
    if (seat) {
      if (seat.is_booked) {
        Seat.update({ is_booked: false }, { where: { id: seat.id } }).then(() => {
          res.send('Seat cancelled successfully');
        });
      } else {
        res.status(400).send('Seat is not booked');
      }
    } else {
      res.status(400).send('Seat not found');
    }
  });
});

app.get('/available_seats', (req, res) => {
  const show_id = req.query.show_id;
  const screen_id = req.query.screen_id;
  Seat.findAll({ where: { show_id, screen_id, is_booked: false } }).then(seats => {
    if (seats.length > 0) {
      res.json(seats);
    } else {
      Show.findAll({ where: { id: show_id } }).then(shows => {
        const end_time = shows[0].end_time;
        Show.findAll({ where: { start_time: { [Op.gt]: end_time } }, limit: 1 }).then(next_shows => {
          if (next_shows.length > 0) {
            res.status(404).send(`No available seats. Next available show is ${next_shows[0].name} at ${next_shows[0].start_time}`);
          } else {
            res.status(404).send('No available seats. No shows scheduled after this time');
          }
        });
      });
    }
  });
});

app.listen(port, () => {
  console.log(`Theater booking app listening at http://localhost:${port}`);
});
