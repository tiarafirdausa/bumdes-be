// backend/utils/sendEmail.js
const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    const { email, subject, message, smtpConfig } = options; 
    const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: process.env.NODE_ENV === 'production' ? true : false,
        auth: {
            user: smtpConfig.user,
            pass: smtpConfig.pass,
        },
    });

    const mailOptions = {
        from: smtpConfig.from, 
        to: email,
        subject: subject,
        html: message,
    };

    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;