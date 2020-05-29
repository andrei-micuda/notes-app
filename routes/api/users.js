const express = require('express');
const bcrypt = require('bcryptjs');
const uuid = require('uuid');
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'andrei.micuda.dev@gmail.com',
    pass: 'bxfvumcyoiluyvzf'
  }
});

const router = express.Router();
const saltRounds = 10;
const loginAttempts = 5;

const userData = require('../../Users');
let users;
async function readUsers() {
  users = await userData.getAll();
  // Get all users
  router.get('/', (req, res) => res.json(users));

  // Get single user ID
  /*// awaits email and password //*/
  router.post('/user/id', async (req, res) => {
    const found = users.some(user => user.email === req.body.email);
    if (found) {
      const user = users.filter(user => user.email === req.body.email)[0];
      if (bcrypt.compareSync(req.body.password, user.passHash)) {
        //! UPDATEAZA CHESTIILE INAINTE SA TRIMITA RESPONSE-UL
        const last = Object.assign({}, {
          found: true,
          id: user.id,
          lastIP: user.lastIP ? user.lastIP : null,
          lastTime: user.lastTime ? user.lastTime : null,
          logCount: user.logCount ? user.logCount : 0
        });

        console.table(last);
        res.json(last);

        //* if user succesfully logged in, update last login ip and time
        let ip = req.ip;
        if (ip.substr(0, 7) == "::ffff:") {
          ip = ip.substr(7)
        }
        user.lastIP = ip;

        user.lastTime = new Date();

        user.logCount = user.logCount ? user.logCount + 1 : 1;

        console.log(users);

        await userData.writeAll(users);
      } else {
        //* if the passwords don't match

        if (user.loginAttempts) {
          user.loginAttempts.push(new Date());
          if (user.loginAttempts.length == loginAttempts + 1) {
            user.loginAttempts.shift();
          }
        } else {
          user.loginAttempts = [new Date()]
        }
        //* get the number of failed logins in the last 5 minutes
        let failedAttempts = user.loginAttempts.filter(loginAtt => {
          return (new Date() - new Date(loginAtt)) / 1000 < (3 * 60)
        }).length;

        //* if no more login attempts left, send an email to the user to notify
        if (loginAttempts - failedAttempts === 0) {
          const mailOptions = {
            from: 'andrei.micuda.dev@gmail.com',
            to: user.email,
            subject: 'Looks like someone is trying to access your account',
            text: `Hello ${user.fullName}! We have detected multiple failed login attempts into your account, if this was you, please ignore this email.`
          };

          transporter.sendMail(mailOptions, (err, data) => {
            if (err) {
              console.log(err);
            } else {
              console.log('Email sent: ' + data.response);
            }
          });
        }

        res.json({
          found: false,
          attempts: loginAttempts - failedAttempts
        });

        userData.writeAll(users);
      }
    } else {
      res.status(400).json({
        user: null
      });
    }
  });

  // Get single user data
  /*// awaits userID //*/
  router.post('/user', (req, res) => {
    const found = users.some(user => user.id === req.body.id);
    if (found) {
      const user = users.filter(user => user.id === req.body.id)[0];
      res.json(user);
    } else {
      res.status(400).json({
        user: null
      });
    }
  });

  // Create user
  /*// expectes email, fullName, password //*/
  router.post('/', async (req, res) => {
    const newUser = {
      id: uuid.v4(),
      fullName: req.body.fullName,
      email: req.body.email,
      passHash: await bcrypt.hash(req.body.password, saltRounds)
    };
    if (!newUser.fullName || !newUser.email) {
      res.status(400).json({
        msg: 'Please include all the information needed...'
      });
    } else {
      console.log('User registered!');

      //* send confirmation email to user
      const mailOptions = {
        from: 'andrei.micuda.dev@gmail.com',
        to: req.body.email,
        subject: 'Your Notes App account has been created',
        text: `Hello ${req.body.fullName}! You account has been succesfully created. Now you can use the app to store all your notes!`
      };

      transporter.sendMail(mailOptions, (err, data) => {
        if (err) {
          console.log(err);
        } else {
          console.log('Email sent: ' + data.response);
        }
      });

      users.push(newUser);
      res.json({
        msg: 'User registered!'
      });
      // await writeUsers(users);
      await userData.writeAll(users);
    }
  });

}
// async function writeUsers(users) {
//   await userData.writeAll(users);
// }

readUsers();
module.exports = router;