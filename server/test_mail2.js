const nodemailer = require('nodemailer');

const config = {
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "readingroomlibrary.official@gmail.com",
    pass: "ujmyslmtzrtqwbsg"
  }
};

const transporter = nodemailer.createTransport(config);

transporter.verify(function (error, success) {
  if (error) {
    console.log("Email Config Error:");
    console.log(error);
  } else {
    console.log("Server is ready to take our messages. Config is valid!");
  }
});